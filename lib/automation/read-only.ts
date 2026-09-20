import type { AstraInputContext } from "@/lib/agent/types";
import type {
  AstraBrain,
  AstraBrainChatResult,
} from "@/lib/brain/types";
import { astraBrain } from "@/lib/brain/adapter";
import type { AstraAutomationDefinition } from "./contracts";
import type { AstraAutomationExecutor } from "./runner";
import { automationOccurrenceBrainInput } from "./approval";

const AUTOMATION_INPUT_CONTEXT: AstraInputContext = {
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

function maxPlanPermission(result: AstraBrainChatResult) {
  return (result.brain.plan?.steps ?? []).reduce(
    (max, step) => Math.max(max, step.permissionLevel),
    0,
  );
}

export async function executeReadOnlyAutomationWithBrain(
  automation: AstraAutomationDefinition,
  context: {
    scheduledFor: string;
    signal: AbortSignal;
  },
  brain: Pick<AstraBrain, "execute"> = astraBrain,
) {
  if (automation.requiredPermissionLevel > 1) {
    return {
      status: "failed" as const,
      detail:
        "Unattended automation executor refuses work above Permission Level 1.",
    };
  }

  const input = automationOccurrenceBrainInput(
    automation,
    context.scheduledFor,
  );

  const result = await brain.execute(
    {
      input,
      approved: false,
    },
    {
      provider: "ollama",
      inputContext: AUTOMATION_INPUT_CONTEXT,
      requirePlan: true,
      permissionCeiling: automation.requiredPermissionLevel,
      signal: context.signal,
    },
  );

  const plannedPermission = maxPlanPermission(result);
  if (plannedPermission > automation.requiredPermissionLevel) {
    return {
      status: "failed" as const,
      detail:
        "ASTRA Brain returned a plan above the automation permission ceiling. " +
        "No unattended escalation is allowed.",
      output: result.message.slice(0, 8000),
    };
  }

  if (result.ok && result.state === "completed") {
    return {
      status: "completed" as const,
      detail:
        "Read-only scheduled occurrence completed through bounded ASTRA Brain execution.",
      output: result.message.slice(0, 8000),
    };
  }

  return {
    status: "failed" as const,
    detail:
      result.message ||
      "Read-only scheduled occurrence was blocked by ASTRA Brain.",
    output: result.message.slice(0, 8000),
  };
}

export function createReadOnlyAutomationExecutor(
  brain: Pick<AstraBrain, "execute"> = astraBrain,
): AstraAutomationExecutor {
  return (automation, context) =>
    executeReadOnlyAutomationWithBrain(
      automation,
      context,
      brain,
    );
}
