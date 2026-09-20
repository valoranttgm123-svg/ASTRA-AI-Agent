import type { AstraAgentKey } from "@/lib/agent/types";
import type { AstraPermissionLevel } from "@/lib/agent/capabilities";
import type {
  AstraPlan,
  AstraPlanStep,
} from "./contracts";
import {
  runnablePlanSteps,
  updatePlanStepStatus,
} from "./planner";

export type AstraPlanStepExecutionOutcome =
  | {
      status: "completed";
      detail: string;
      output?: string;
      provider?: string;
    }
  | {
      status: "failed";
      detail: string;
      output?: string;
      provider?: string;
    }
  | {
      status: "waiting_approval";
      detail: string;
      provider?: string;
    };

export type AstraPlanExecutionEventType =
  | "plan.step.started"
  | "plan.step.progress"
  | "plan.step.completed"
  | "plan.step.failed"
  | "plan.completed"
  | "plan.cancelled";

export type AstraPlanExecutionEvent = {
  type: AstraPlanExecutionEventType;
  planId: string;
  stepId?: string;
  stepTitle?: string;
  agent?: AstraAgentKey;
  provider?: string;
  attempt?: number;
  detail: string;
};

export type AstraPlanExecutionResult = {
  plan: AstraPlan;
  outcome: "completed" | "failed" | "waiting_approval" | "cancelled";
  outputs: Record<string, string>;
  detail: string;
  blockedStepId?: string;
};

export type AstraPlanStepExecutor = (
  step: AstraPlanStep,
  context: {
    goal: string;
    projectId?: string;
    outputs: Readonly<Record<string, string>>;
    signal: AbortSignal;
  },
) => Promise<AstraPlanStepExecutionOutcome>;

function abortError(message = "Plan execution cancelled.") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function emit(
  callback: ((event: AstraPlanExecutionEvent) => void) | undefined,
  event: AstraPlanExecutionEvent,
) {
  callback?.(event);
}

function withPlanStatus(
  plan: AstraPlan,
  status: AstraPlan["status"],
): AstraPlan {
  return {
    ...plan,
    status,
  };
}

async function runWithTimeout<T>(
  timeoutMs: number,
  externalSignal: AbortSignal | undefined,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Plan step timed out.", "TimeoutError")),
    timeoutMs,
  );

  const onExternalAbort = () =>
    controller.abort(externalSignal?.reason ?? abortError());

  if (externalSignal?.aborted) {
    onExternalAbort();
  } else {
    externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

function cleanOutput(value: string | undefined) {
  return value?.trim().slice(0, 8000) || "";
}

export async function executeBoundedPlan(
  initialPlan: AstraPlan,
  options: {
    executeStep: AstraPlanStepExecutor;
    approvedPermissionLevel?: AstraPermissionLevel;
    signal?: AbortSignal;
    onEvent?: (event: AstraPlanExecutionEvent) => void;
  },
): Promise<AstraPlanExecutionResult> {
  let plan = withPlanStatus(initialPlan, "running");
  const outputs: Record<string, string> = {};
  const approvedPermissionLevel = options.approvedPermissionLevel ?? 1;

  while (true) {
    if (options.signal?.aborted) {
      plan = withPlanStatus(plan, "cancelled");
      emit(options.onEvent, {
        type: "plan.cancelled",
        planId: plan.id,
        detail: "Plan execution was cancelled before the next step.",
      });
      return {
        plan,
        outcome: "cancelled",
        outputs,
        detail: "Plan execution cancelled.",
      };
    }

    const pending = plan.steps.filter((step) => step.status === "pending");
    if (pending.length === 0) {
      const failed = plan.steps.find((step) => step.status === "failed");
      const waiting = plan.steps.find(
        (step) => step.status === "waiting_approval",
      );

      if (waiting) {
        return {
          plan: withPlanStatus(plan, "planned"),
          outcome: "waiting_approval",
          outputs,
          blockedStepId: waiting.id,
          detail: "Plan is waiting for approval at step " + waiting.id + ".",
        };
      }

      if (failed) {
        return {
          plan: withPlanStatus(plan, "failed"),
          outcome: "failed",
          outputs,
          blockedStepId: failed.id,
          detail: "Plan failed at step " + failed.id + ".",
        };
      }

      plan = withPlanStatus(plan, "completed");
      emit(options.onEvent, {
        type: "plan.completed",
        planId: plan.id,
        detail:
          "All " +
          plan.steps.length +
          " plan step" +
          (plan.steps.length === 1 ? "" : "s") +
          " completed.",
      });
      return {
        plan,
        outcome: "completed",
        outputs,
        detail: "Plan completed successfully.",
      };
    }

    const runnable = runnablePlanSteps(plan);
    if (runnable.length === 0) {
      plan = withPlanStatus(plan, "failed");
      emit(options.onEvent, {
        type: "plan.step.failed",
        planId: plan.id,
        detail:
          "No runnable step remains while pending dependencies still exist.",
      });
      return {
        plan,
        outcome: "failed",
        outputs,
        detail: "Plan dependency state is not runnable.",
      };
    }

    const step = runnable[0];

    if (step.permissionLevel > approvedPermissionLevel) {
      plan = updatePlanStepStatus(plan, step.id, "waiting_approval");
      emit(options.onEvent, {
        type: "plan.step.progress",
        planId: plan.id,
        stepId: step.id,
        stepTitle: step.title,
        agent: step.agent,
        detail:
          "Waiting for permission level " +
          step.permissionLevel +
          "; current approval level is " +
          approvedPermissionLevel +
          ".",
      });
      return {
        plan: withPlanStatus(plan, "planned"),
        outcome: "waiting_approval",
        outputs,
        blockedStepId: step.id,
        detail:
          "Step " +
          step.id +
          " requires permission level " +
          step.permissionLevel +
          ".",
      };
    }

    plan = updatePlanStepStatus(plan, step.id, "running");
    emit(options.onEvent, {
      type: "plan.step.started",
      planId: plan.id,
      stepId: step.id,
      stepTitle: step.title,
      agent: step.agent,
      attempt: 1,
      detail: "Started plan step: " + step.title,
    });

    let completed = false;

    for (let attempt = 0; attempt <= step.maxRetries; attempt += 1) {
      if (options.signal?.aborted) {
        plan = updatePlanStepStatus(plan, step.id, "cancelled");
        plan = withPlanStatus(plan, "cancelled");
        emit(options.onEvent, {
          type: "plan.cancelled",
          planId: plan.id,
          stepId: step.id,
          stepTitle: step.title,
          agent: step.agent,
          detail: "Plan execution cancelled during step " + step.id + ".",
        });
        return {
          plan,
          outcome: "cancelled",
          outputs,
          blockedStepId: step.id,
          detail: "Plan execution cancelled.",
        };
      }

      if (attempt > 0) {
        emit(options.onEvent, {
          type: "plan.step.progress",
          planId: plan.id,
          stepId: step.id,
          stepTitle: step.title,
          agent: step.agent,
          attempt: attempt + 1,
          detail:
            "Retrying step " +
            step.id +
            " (attempt " +
            (attempt + 1) +
            " of " +
            (step.maxRetries + 1) +
            ").",
        });
      }

      try {
        const outcome = await runWithTimeout(
          step.timeoutMs,
          options.signal,
          (signal) =>
            options.executeStep(step, {
              goal: plan.goal,
              projectId: plan.projectId,
              outputs,
              signal,
            }),
        );

        if (outcome.status === "waiting_approval") {
          plan = updatePlanStepStatus(plan, step.id, "waiting_approval");
          emit(options.onEvent, {
            type: "plan.step.progress",
            planId: plan.id,
            stepId: step.id,
            stepTitle: step.title,
            agent: step.agent,
            provider: outcome.provider,
            attempt: attempt + 1,
            detail: outcome.detail,
          });
          return {
            plan: withPlanStatus(plan, "planned"),
            outcome: "waiting_approval",
            outputs,
            blockedStepId: step.id,
            detail: outcome.detail,
          };
        }

        if (outcome.status === "completed") {
          const output = cleanOutput(outcome.output);
          if (output) outputs[step.id] = output;
          plan = updatePlanStepStatus(plan, step.id, "completed");
          emit(options.onEvent, {
            type: "plan.step.completed",
            planId: plan.id,
            stepId: step.id,
            stepTitle: step.title,
            agent: step.agent,
            provider: outcome.provider,
            attempt: attempt + 1,
            detail: outcome.detail,
          });
          completed = true;
          break;
        }

        if (attempt >= step.maxRetries) {
          const output = cleanOutput(outcome.output);
          if (output) outputs[step.id] = output;
          plan = updatePlanStepStatus(plan, step.id, "failed");
          plan = withPlanStatus(plan, "failed");
          emit(options.onEvent, {
            type: "plan.step.failed",
            planId: plan.id,
            stepId: step.id,
            stepTitle: step.title,
            agent: step.agent,
            provider: outcome.provider,
            attempt: attempt + 1,
            detail: outcome.detail,
          });
          return {
            plan,
            outcome: "failed",
            outputs,
            blockedStepId: step.id,
            detail: outcome.detail,
          };
        }
      } catch (error) {
        const isParentAbort = options.signal?.aborted;
        const name = error instanceof Error ? error.name : "";

        if (isParentAbort || name === "AbortError") {
          plan = updatePlanStepStatus(plan, step.id, "cancelled");
          plan = withPlanStatus(plan, "cancelled");
          emit(options.onEvent, {
            type: "plan.cancelled",
            planId: plan.id,
            stepId: step.id,
            stepTitle: step.title,
            agent: step.agent,
            detail: "Plan execution cancelled during step " + step.id + ".",
          });
          return {
            plan,
            outcome: "cancelled",
            outputs,
            blockedStepId: step.id,
            detail: "Plan execution cancelled.",
          };
        }

        const detail =
          name === "TimeoutError"
            ? "Plan step timed out."
            : error instanceof Error
              ? error.message
              : "Plan step failed.";

        if (attempt >= step.maxRetries) {
          plan = updatePlanStepStatus(plan, step.id, "failed");
          plan = withPlanStatus(plan, "failed");
          emit(options.onEvent, {
            type: "plan.step.failed",
            planId: plan.id,
            stepId: step.id,
            stepTitle: step.title,
            agent: step.agent,
            attempt: attempt + 1,
            detail,
          });
          return {
            plan,
            outcome: "failed",
            outputs,
            blockedStepId: step.id,
            detail,
          };
        }
      }
    }

    if (!completed) {
      plan = updatePlanStepStatus(plan, step.id, "failed");
      plan = withPlanStatus(plan, "failed");
      emit(options.onEvent, {
        type: "plan.step.failed",
        planId: plan.id,
        stepId: step.id,
        stepTitle: step.title,
        agent: step.agent,
        detail: "Step exhausted its bounded attempts.",
      });
      return {
        plan,
        outcome: "failed",
        outputs,
        blockedStepId: step.id,
        detail: "Step exhausted its bounded attempts.",
      };
    }
  }
}
