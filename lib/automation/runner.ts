import type { AstraAutomationDefinition } from "./contracts";
import type {
  AstraAutomationLifecycleEvent,
  AstraAutomationQueueItem,
  AstraAutomationTickPlan,
} from "./queue";
import { planAutomationTick } from "./queue";
import {
  claimAutomationOccurrence,
  loadAutomationStore,
} from "./store";

export type AstraAutomationExecutionOutcome =
  | {
      status: "completed";
      detail: string;
      output?: string;
    }
  | {
      status: "failed";
      detail: string;
      output?: string;
    };

export type AstraAutomationExecutor = (
  automation: AstraAutomationDefinition,
  context: {
    scheduledFor: string;
    signal: AbortSignal;
  },
) => Promise<AstraAutomationExecutionOutcome>;

export type AstraAutomationRunRecord = {
  automationId: string;
  scheduledFor: string;
  status: "completed" | "failed" | "cancelled" | "skipped";
  detail: string;
  output?: string;
};

export type AstraAutomationTickResult = {
  source: string;
  available: boolean;
  detail: string;
  plan?: AstraAutomationTickPlan;
  waitingApproval: AstraAutomationQueueItem[];
  runs: AstraAutomationRunRecord[];
  stopped: boolean;
};

function bounded(value: string | undefined, max: number) {
  return value?.trim().slice(0, max) || "";
}

function emit(
  callback: ((event: AstraAutomationLifecycleEvent) => void) | undefined,
  event: AstraAutomationLifecycleEvent,
) {
  callback?.(event);
}

function abortError(message = "Automation run cancelled.") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

async function runWithTimeout<T>(
  timeoutMs: number,
  externalSignal: AbortSignal | undefined,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () =>
      controller.abort(
        new DOMException("Automation run timed out.", "TimeoutError"),
      ),
    timeoutMs,
  );

  const onExternalAbort = () =>
    controller.abort(externalSignal?.reason ?? abortError());

  if (externalSignal?.aborted) {
    onExternalAbort();
  } else {
    externalSignal?.addEventListener("abort", onExternalAbort, {
      once: true,
    });
  }

  try {
    const result = await run(controller.signal);

    if (controller.signal.aborted) {
      const reason = controller.signal.reason;
      if (reason instanceof Error) {
        throw reason;
      }
      throw abortError(
        "Automation run completed after cancellation.",
      );
    }

    return result;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

function findAutomation(
  automations: readonly AstraAutomationDefinition[],
  id: string,
) {
  return automations.find(
    (automation) => automation.id.toLowerCase() === id.toLowerCase(),
  );
}

export async function runAutomationTickFromStore(options: {
  execute: AstraAutomationExecutor;
  now?: Date;
  signal?: AbortSignal;
  onEvent?: (event: AstraAutomationLifecycleEvent) => void;
}): Promise<AstraAutomationTickResult> {
  const now = options.now ?? new Date();
  const store = await loadAutomationStore();

  if (!store.enabled || !store.available) {
    return {
      source: store.source,
      available: false,
      detail: store.detail,
      waitingApproval: [],
      runs: [],
      stopped: options.signal?.aborted === true,
    };
  }

  const plan = planAutomationTick(store.automations, now);
  const runs: AstraAutomationRunRecord[] = [];

  for (const item of plan.waitingApproval) {
    emit(options.onEvent, {
      type: "automation.waiting_approval",
      automationId: item.automationId,
      at: now.toISOString(),
      scheduledFor: item.scheduledFor,
      detail:
        "Scheduled occurrence requires Permission Level-" +
        item.requiredPermissionLevel +
        " approval.",
    });
  }

  for (const item of plan.ready) {
    if (options.signal?.aborted) break;

    const automation = findAutomation(
      store.automations,
      item.automationId,
    );
    if (!automation) {
      runs.push({
        automationId: item.automationId,
        scheduledFor: item.scheduledFor,
        status: "skipped",
        detail: "Automation definition disappeared before execution.",
      });
      continue;
    }

    if (automation.requiredPermissionLevel > 1) {
      runs.push({
        automationId: item.automationId,
        scheduledFor: item.scheduledFor,
        status: "skipped",
        detail:
          "Automation runner refuses unattended work above Permission Level 1.",
      });
      continue;
    }

    emit(options.onEvent, {
      type: "automation.due",
      automationId: item.automationId,
      at: now.toISOString(),
      scheduledFor: item.scheduledFor,
      detail: "Scheduled read-only occurrence is due.",
    });

    const claim = await claimAutomationOccurrence({
      automationId: item.automationId,
      scheduledFor: item.scheduledFor,
      now,
    });

    if (!claim.claimed || !claim.automation) {
      runs.push({
        automationId: item.automationId,
        scheduledFor: item.scheduledFor,
        status: "skipped",
        detail: claim.detail,
      });
      continue;
    }

    emit(options.onEvent, {
      type: "automation.claimed",
      automationId: item.automationId,
      at: now.toISOString(),
      scheduledFor: item.scheduledFor,
      detail: claim.detail,
    });

    if (options.signal?.aborted) {
      emit(options.onEvent, {
        type: "automation.cancelled",
        automationId: item.automationId,
        at: new Date().toISOString(),
        scheduledFor: item.scheduledFor,
        detail: "Global STOP arrived after the occurrence was claimed.",
      });
      runs.push({
        automationId: item.automationId,
        scheduledFor: item.scheduledFor,
        status: "cancelled",
        detail: "Automation occurrence cancelled before executor start.",
      });
      break;
    }

    emit(options.onEvent, {
      type: "automation.started",
      automationId: item.automationId,
      at: new Date().toISOString(),
      scheduledFor: item.scheduledFor,
      detail: "Automation executor started.",
    });

    try {
      const outcome = await runWithTimeout(
        claim.automation.maxRuntimeMs,
        options.signal,
        (signal) =>
          options.execute(claim.automation as AstraAutomationDefinition, {
            scheduledFor: item.scheduledFor,
            signal,
          }),
      );

      const detail = bounded(outcome.detail, 2000) || "Automation finished.";
      const output = bounded(outcome.output, 8000) || undefined;

      if (outcome.status === "completed") {
        emit(options.onEvent, {
          type: "automation.completed",
          automationId: item.automationId,
          at: new Date().toISOString(),
          scheduledFor: item.scheduledFor,
          detail,
        });
        runs.push({
          automationId: item.automationId,
          scheduledFor: item.scheduledFor,
          status: "completed",
          detail,
          output,
        });
      } else {
        emit(options.onEvent, {
          type: "automation.failed",
          automationId: item.automationId,
          at: new Date().toISOString(),
          scheduledFor: item.scheduledFor,
          detail,
        });
        runs.push({
          automationId: item.automationId,
          scheduledFor: item.scheduledFor,
          status: "failed",
          detail,
          output,
        });
      }
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const cancelled =
        options.signal?.aborted === true || name === "AbortError";
      const detail =
        cancelled
          ? "Automation execution cancelled by global STOP."
          : name === "TimeoutError"
            ? "Automation execution timed out."
            : error instanceof Error
              ? bounded(error.message, 2000)
              : "Automation execution failed.";

      emit(options.onEvent, {
        type: cancelled ? "automation.cancelled" : "automation.failed",
        automationId: item.automationId,
        at: new Date().toISOString(),
        scheduledFor: item.scheduledFor,
        detail,
      });
      runs.push({
        automationId: item.automationId,
        scheduledFor: item.scheduledFor,
        status: cancelled ? "cancelled" : "failed",
        detail,
      });

      if (cancelled) break;
    }
  }

  return {
    source: store.source,
    available: true,
    detail:
      "Automation tick planned " +
      plan.ready.length +
      " read-only runnable occurrence" +
      (plan.ready.length === 1 ? "" : "s") +
      " and " +
      plan.waitingApproval.length +
      " approval-gated occurrence" +
      (plan.waitingApproval.length === 1 ? "." : "s."),
    plan,
    waitingApproval: plan.waitingApproval,
    runs,
    stopped: options.signal?.aborted === true,
  };
}
