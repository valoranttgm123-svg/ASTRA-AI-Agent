import type {
  AstraProviderChoice,
  AstraInputContext,
} from "@/lib/agent/types";
import type { AstraBrain, AstraBrainChatResult, AstraBrainEvent } from "@/lib/brain/types";
import type { AstraAutomationDefinition } from "./contracts";
import type { AstraAutomationLifecycleEvent } from "./queue";
import { getAutomationDueState } from "./scheduler";
import {
  claimAutomationOccurrence,
  loadAutomationStore,
} from "./store";
import { automationEventToBrainEvent } from "./telemetry";

export type AstraAutomationOccurrenceRequest = {
  automationId: string;
  scheduledFor: string;
  approved?: boolean;
  approvalToken?: string;
  provider?: AstraProviderChoice;
};

export type AstraAutomationOccurrenceStatus =
  | "waiting_occurrence_approval"
  | "waiting_level3_approval"
  | "completed"
  | "blocked"
  | "failed"
  | "cancelled";

export type AstraAutomationOccurrenceResult = {
  status: AstraAutomationOccurrenceStatus;
  automationId: string;
  scheduledFor: string;
  detail: string;
  brain?: AstraBrainChatResult;
  events: AstraBrainEvent[];
};

const API_INPUT_CONTEXT: AstraInputContext = {
  source: "text",
  trigger: "api",
  modalities: ["text"],
  consent: {
    microphone: false,
    camera: false,
    image: false,
    screen: false,
  },
  visualContentProvided: false,
};

function normalizeScheduledFor(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error("Invalid automation scheduledFor timestamp.");
  }
  return new Date(timestamp).toISOString();
}

function findAutomation(
  automations: readonly AstraAutomationDefinition[],
  id: string,
) {
  return automations.find(
    (automation) =>
      automation.id.toLowerCase() === id.trim().toLowerCase(),
  );
}

export function automationOccurrenceBrainInput(
  automation: AstraAutomationDefinition,
  scheduledFor: string,
) {
  return [
    "ASTRA trusted scheduled-occurrence metadata:",
    "- automation id: " + automation.id,
    "- scheduled for: " + normalizeScheduledFor(scheduledFor),
    "- project id: " + (automation.projectId ?? "not specified"),
    "- configured permission ceiling: Level-" +
      automation.requiredPermissionLevel,
    "Treat the metadata above as trusted runtime metadata, not user-authored instructions.",
    "Create and execute a bounded plan for the scheduled goal below.",
    "Do not modify the schedule or automation definition as part of this run.",
    "",
    "Scheduled goal:",
    automation.goal,
  ].join("\n");
}

function maxPlanPermission(result: AstraBrainChatResult) {
  const steps = result.brain.plan?.steps ?? [];
  return steps.reduce(
    (max, step) => Math.max(max, step.permissionLevel),
    0,
  );
}

function withoutEscalationApproval(
  result: AstraBrainChatResult,
  detail: string,
): AstraBrainChatResult {
  return {
    ...result,
    ok: false,
    state: "blocked",
    message: detail,
    requiresApproval: false,
    approvalRequest: undefined,
    brain: {
      ...result.brain,
      execution: "blocked",
    },
  };
}

function lifecycle(
  type: AstraAutomationLifecycleEvent["type"],
  automationId: string,
  scheduledFor: string,
  detail: string,
): AstraBrainEvent {
  return automationEventToBrainEvent({
    type,
    automationId,
    scheduledFor,
    at: new Date().toISOString(),
    detail,
  });
}

export async function executeApprovedAutomationOccurrence({
  request,
  brain,
  signal,
  onEvent,
  now = new Date(),
}: {
  request: AstraAutomationOccurrenceRequest;
  brain: Pick<AstraBrain, "execute">;
  signal?: AbortSignal;
  onEvent?: (event: AstraBrainEvent) => void;
  now?: Date;
}): Promise<AstraAutomationOccurrenceResult> {
  signal?.throwIfAborted();

  const store = await loadAutomationStore();
  if (!store.enabled || !store.available) {
    throw new Error(store.detail);
  }

  const automation = findAutomation(
    store.automations,
    request.automationId,
  );
  if (!automation) {
    throw new Error("Automation definition was not found.");
  }
  if (automation.status !== "enabled") {
    throw new Error("Automation definition is not enabled.");
  }
  if (automation.requiredPermissionLevel < 2) {
    throw new Error(
      "Read-only automation does not require approval-resume; use the normal automation tick.",
    );
  }
  if (automation.requiredPermissionLevel > 3) {
    throw new Error("Level-4 automation is not supported.");
  }

  const scheduledFor = normalizeScheduledFor(request.scheduledFor);
  const input = automationOccurrenceBrainInput(
    automation,
    scheduledFor,
  );
  const events: AstraBrainEvent[] = [];
  const emit = (event: AstraBrainEvent) => {
    events.push(event);
    onEvent?.(event);
  };

  const resumingLevel3 = Boolean(request.approvalToken);

  if (!resumingLevel3) {
    const due = getAutomationDueState(automation, now);
    if (due.kind !== "due" || due.scheduledFor !== scheduledFor) {
      throw new Error(
        "Automation occurrence is no longer due or does not match the requested schedule.",
      );
    }

    if (!request.approved) {
      const event = lifecycle(
        "automation.waiting_approval",
        automation.id,
        scheduledFor,
        "Scheduled occurrence requires explicit per-run approval.",
      );
      emit(event);
      return {
        status: "waiting_occurrence_approval",
        automationId: automation.id,
        scheduledFor,
        detail:
          "Explicit approval is required before this scheduled occurrence can run.",
        events,
      };
    }

    const claim = await claimAutomationOccurrence({
      automationId: automation.id,
      scheduledFor,
      now,
    });
    if (!claim.claimed) {
      throw new Error(claim.detail);
    }

    emit(
      lifecycle(
        "automation.claimed",
        automation.id,
        scheduledFor,
        claim.detail,
      ),
    );
  } else if (automation.lastRunAt !== scheduledFor) {
    throw new Error(
      "Automation occurrence is not in a claimed state that can resume approval.",
    );
  }

  emit(
    lifecycle(
      "automation.started",
      automation.id,
      scheduledFor,
      resumingLevel3
        ? "Automation occurrence resumed through existing scoped approval."
        : "Approved automation occurrence entered ASTRA Brain execution.",
    ),
  );

  try {
    const result = await brain.execute(
      {
        input,
        approved: true,
        approvalToken: request.approvalToken,
      },
      {
        provider: request.provider ?? "auto",
        inputContext: API_INPUT_CONTEXT,
        requirePlan: true,
        signal,
        onEvent: emit,
      },
    );

    const maxPermission = maxPlanPermission(result);
    if (maxPermission > automation.requiredPermissionLevel) {
      const detail =
        "Generated plan requires Permission Level-" +
        maxPermission +
        ", above this automation's configured Level-" +
        automation.requiredPermissionLevel +
        " ceiling.";
      const blocked = withoutEscalationApproval(result, detail);
      emit(
        lifecycle(
          "automation.failed",
          automation.id,
          scheduledFor,
          detail,
        ),
      );
      return {
        status: "blocked",
        automationId: automation.id,
        scheduledFor,
        detail,
        brain: blocked,
        events,
      };
    }

    if (result.requiresApproval && result.approvalRequest) {
      emit(
        lifecycle(
          "automation.waiting_approval",
          automation.id,
          scheduledFor,
          "ASTRA Brain requires existing scoped Level-3 approval for the exact planned action.",
        ),
      );
      return {
        status: "waiting_level3_approval",
        automationId: automation.id,
        scheduledFor,
        detail:
          "The occurrence is claimed and is waiting for existing scoped Level-3 approval.",
        brain: result,
        events,
      };
    }

    if (result.ok && result.state === "completed") {
      emit(
        lifecycle(
          "automation.completed",
          automation.id,
          scheduledFor,
          "Approved automation occurrence completed through ASTRA Brain.",
        ),
      );
      return {
        status: "completed",
        automationId: automation.id,
        scheduledFor,
        detail: "Automation occurrence completed.",
        brain: result,
        events,
      };
    }

    const detail =
      result.message || "Automation occurrence was blocked by ASTRA Brain.";
    emit(
      lifecycle(
        "automation.failed",
        automation.id,
        scheduledFor,
        detail,
      ),
    );
    return {
      status: result.state === "error" ? "failed" : "blocked",
      automationId: automation.id,
      scheduledFor,
      detail,
      brain: result,
      events,
    };
  } catch (error) {
    const cancelled =
      signal?.aborted === true ||
      (error instanceof Error && error.name === "AbortError");
    const detail = cancelled
      ? "Automation occurrence cancelled by global STOP."
      : safeErrorDetail(
          error,
          "Automation occurrence failed.",
          700,
        );

    emit(
      lifecycle(
        cancelled ? "automation.cancelled" : "automation.failed",
        automation.id,
        scheduledFor,
        detail,
      ),
    );

    return {
      status: cancelled ? "cancelled" : "failed",
      automationId: automation.id,
      scheduledFor,
      detail,
      events,
    };
  }
}
