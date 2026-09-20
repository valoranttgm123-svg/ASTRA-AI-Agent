import { ASTRA_AGENT_MAP } from "@/lib/agent/roster";
import type {
  AstraAgentKey,
  AstraProviderChoice,
} from "@/lib/agent/types";
import type { AstraProjectRecord } from "@/lib/projects/contracts";
import type { AstraPlan, AstraPlanStep } from "@/lib/planner/contracts";
import {
  executeBoundedPlan,
  type AstraPlanExecutionEvent,
  type AstraPlanExecutionResult,
  type AstraPlanStepExecutionOutcome,
} from "@/lib/planner/executor";
import {
  chatWithCodex,
  getCodexStatus,
} from "./codex";
import { chatWithOllama } from "./ollama";
import { permissionPolicyPrompt } from "./policy";
import { getUnifiedMemoryContext } from "./unified-memory";
import type { AstraBrainPermissionSnapshot } from "./types";
import type { AstraToolLifecycleEvent } from "@/lib/tools/contracts";
import { astraNativeToolRuntime, createDefaultToolRuntime } from "@/lib/tools/runtime";

type BrainPlanExecutorOptions = {
  plan: AstraPlan;
  project?: AstraProjectRecord;
  baseContext?: string;
  policy: AstraBrainPermissionSnapshot;
  providerChoice: AstraProviderChoice;
  approvedPermissionLevel: 0 | 1 | 2 | 3 | 4;
  approvedStepIds?: readonly string[];
  signal?: AbortSignal;
  onEvent?: (event: AstraPlanExecutionEvent) => void;
  onToolEvent?: (event: AstraToolLifecycleEvent) => void;
};

function cleanOutput(value: string | undefined) {
  return value?.trim().slice(0, 6000) || "";
}

function priorOutputsText(outputs: Readonly<Record<string, string>>) {
  const entries = Object.entries(outputs).slice(-4);
  if (entries.length === 0) return "";
  return [
    "Prior verified step outputs:",
    ...entries.map(([id, output]) => "- " + id + ": " + output.slice(0, 1200)),
  ].join("\n");
}

function stepAgent(step: AstraPlanStep): AstraAgentKey {
  return step.agent ?? "chief_of_staff";
}

function isEngineeringAgent(agent: AstraAgentKey) {
  return (
    agent === "developer" ||
    agent === "github" ||
    agent === "files" ||
    agent === "computer"
  );
}

function readOnlyPolicy(
  policy: AstraBrainPermissionSnapshot,
): AstraBrainPermissionSnapshot {
  return {
    ...policy,
    allowFileWrite: false,
    allowExternalActions: false,
  };
}

async function reasonWithLocalModel({
  step,
  goal,
  context,
  signal,
}: {
  step: AstraPlanStep;
  goal: string;
  context: string;
  signal: AbortSignal;
}): Promise<AstraPlanStepExecutionOutcome> {
  const agent = ASTRA_AGENT_MAP[stepAgent(step)];
  const result = await chatWithOllama({
    input:
      "PLAN STEP\nGoal: " +
      goal +
      "\nStep: " +
      step.title +
      "\nRespond only with the result of this reasoning step. Do not claim external actions.",
    agent,
    context,
    policyText:
      "This is a reasoning-only plan step. No external action or file modification is permitted.",
    signal,
  });

  return {
    status: "completed",
    provider: "ollama",
    detail: "Reasoning step completed with local Ollama.",
    output: result.message,
  };
}

async function inspectWithNativeProjectTool({
  step,
  project,
  policy,
  approvedPermissionLevel,
  signal,
  onToolEvent,
}: {
  step: AstraPlanStep;
  project?: AstraProjectRecord;
  policy: AstraBrainPermissionSnapshot;
  approvedPermissionLevel: 0 | 1 | 2 | 3 | 4;
  signal: AbortSignal;
  onToolEvent?: (event: AstraToolLifecycleEvent) => void;
}): Promise<AstraPlanStepExecutionOutcome | null> {
  if (!project) return null;

  const result = await astraNativeToolRuntime.execute(
    "project.context.search",
    {
      projectId: project.id,
      query: step.title,
      limit: 6,
    },
    {
      approvedPermissionLevel,
      policy: {
        allowShell: policy.allowShell,
        allowFileWrite: policy.allowFileWrite,
        allowExternalActions: policy.allowExternalActions,
      },
      signal,
      onEvent: onToolEvent,
    },
  );

  if (result.status !== "completed" || result.verified !== true) {
    return null;
  }

  let output = "";
  try {
    output = JSON.stringify(result.output).slice(0, 6000);
  } catch {
    output = result.detail;
  }

  return {
    status: "completed",
    provider: result.provider || "native-project-context",
    detail: result.detail,
    output,
  };
}

async function inspectWithCodex({
  step,
  goal,
  context,
  policy,
  signal,
}: {
  step: AstraPlanStep;
  goal: string;
  context: string;
  policy: AstraBrainPermissionSnapshot;
  signal: AbortSignal;
}): Promise<AstraPlanStepExecutionOutcome | null> {
  const agentKey = stepAgent(step);
  if (!isEngineeringAgent(agentKey)) return null;

  const safePolicy = readOnlyPolicy(policy);
  const status = await getCodexStatus(safePolicy);
  if (!status.available) return null;

  const result = await chatWithCodex({
    input:
      "READ-ONLY PLAN INSPECTION\nGoal: " +
      goal +
      "\nStep: " +
      step.title +
      "\nInspect only. Do not modify files or perform external actions.",
    agent: ASTRA_AGENT_MAP[agentKey],
    context,
    policyText: permissionPolicyPrompt(safePolicy),
    policy: safePolicy,
    executionRequested: false,
    signal,
  });

  return {
    status: "completed",
    provider: "codex",
    detail: "Read-only inspection completed through Codex.",
    output: result.message,
  };
}

async function inspectMemory({
  step,
  project,
  signal,
}: {
  step: AstraPlanStep;
  project?: AstraProjectRecord;
  signal: AbortSignal;
}): Promise<AstraPlanStepExecutionOutcome> {
  const memory = await getUnifiedMemoryContext(
    step.title,
    project,
    signal,
  );

  if (!memory.available) {
    return {
      status: "failed",
      provider: "memory",
      detail: "Memory/project context is unavailable for this inspection step.",
    };
  }

  return {
    status: "completed",
    provider: "memory",
    detail:
      "Inspected bounded registered context; selected " +
      memory.records.length +
      " record" +
      (memory.records.length === 1 ? "" : "s") +
      ".",
    output: memory.text || memory.detail,
  };
}

async function executeResearchStep({
  step,
  goal,
  policy,
  approvedPermissionLevel,
  signal,
  onToolEvent,
}: {
  step: AstraPlanStep;
  goal: string;
  policy: AstraBrainPermissionSnapshot;
  approvedPermissionLevel: 0 | 1 | 2 | 3 | 4;
  signal: AbortSignal;
  onToolEvent?: (event: AstraToolLifecycleEvent) => void;
}): Promise<AstraPlanStepExecutionOutcome> {
  const runtime = await createDefaultToolRuntime(signal);
  const definition = runtime.get("research.web");

  if (!definition || definition.availability !== "READY") {
    return {
      status: "failed",
      provider: definition?.provider,
      detail:
        "Real web research is not configured. Configure a READY research transport (for example local SearXNG via ASTRA_SEARXNG_URL) before this step can complete.",
    };
  }

  const query = [step.title, goal]
    .filter(Boolean)
    .join(" — ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);

  const result = await runtime.execute(
    "research.web",
    {
      query,
      searchLimit: 8,
      fetchLimit: 3,
    },
    {
      approvedPermissionLevel,
      policy: {
        allowShell: policy.allowShell,
        allowFileWrite: policy.allowFileWrite,
        allowExternalActions: policy.allowExternalActions,
      },
      signal,
      onEvent: onToolEvent,
    },
  );

  let output = "";
  if (result.output !== undefined) {
    try {
      output = JSON.stringify(result.output).slice(0, 12_000);
    } catch {
      output = "";
    }
  }

  if (result.status === "completed" && result.verified) {
    return {
      status: "completed",
      provider: result.provider || definition.provider,
      detail: result.detail,
      output,
    };
  }

  if (result.status === "blocked") {
    return {
      status: "waiting_approval",
      provider: result.provider || definition.provider,
      detail: result.detail,
    };
  }

  return {
    status: "failed",
    provider: result.provider || definition.provider,
    detail: result.detail,
    output,
  };
}

async function executeStructuredTool({
  step,
  project,
  policy,
  approvedPermissionLevel,
  signal,
  onToolEvent,
}: {
  step: AstraPlanStep;
  project?: AstraProjectRecord;
  policy: AstraBrainPermissionSnapshot;
  approvedPermissionLevel: 0 | 1 | 2 | 3 | 4;
  signal: AbortSignal;
  onToolEvent?: (event: AstraToolLifecycleEvent) => void;
}): Promise<AstraPlanStepExecutionOutcome | null> {
  if (!step.toolId) return null;

  const runtime = await createDefaultToolRuntime(signal);
  const definition = runtime.get(step.toolId);
  if (!definition) {
    return {
      status: "failed",
      detail: "Plan referenced an unknown ASTRA tool: " + step.toolId,
    };
  }

  const input: Record<string, unknown> = {
    ...(step.toolInput ?? {}),
  };

  if (project) {
    const requestedProject =
      typeof input.projectId === "string" ? input.projectId.trim() : "";
    if (
      requestedProject &&
      requestedProject.toLowerCase() !== project.id.toLowerCase()
    ) {
      return {
        status: "failed",
        detail:
          "Tool step attempted to target project " +
          requestedProject +
          " while the bounded plan is scoped to " +
          project.id +
          ".",
      };
    }
    input.projectId = project.id;
  }

  const result = await runtime.execute(step.toolId, input, {
    approvedPermissionLevel,
    policy: {
      allowShell: policy.allowShell,
      allowFileWrite: policy.allowFileWrite,
      allowExternalActions: policy.allowExternalActions,
    },
    signal,
    onEvent: onToolEvent,
  });

  let output = "";
  if (result.output !== undefined) {
    try {
      output = JSON.stringify(result.output).slice(0, 6000);
    } catch {
      output = "";
    }
  }

  if (result.status === "completed" && result.verified) {
    return {
      status: "completed",
      provider: result.provider || definition.provider,
      detail: result.detail,
      output,
    };
  }

  if (result.status === "blocked") {
    return {
      status: "waiting_approval",
      provider: result.provider || definition.provider,
      detail: result.detail,
    };
  }

  return {
    status: "failed",
    provider: result.provider || definition.provider,
    detail: result.detail,
    output,
  };
}

async function executeCodexTool({
  step,
  goal,
  context,
  policy,
  signal,
}: {
  step: AstraPlanStep;
  goal: string;
  context: string;
  policy: AstraBrainPermissionSnapshot;
  signal: AbortSignal;
}): Promise<AstraPlanStepExecutionOutcome> {
  const agentKey = stepAgent(step);

  if (!["developer", "files", "computer"].includes(agentKey)) {
    return {
      status: "failed",
      detail:
        "No real executable tool handler is configured for " +
        agentKey +
        " yet.",
    };
  }

  if (!policy.allowFileWrite && agentKey !== "computer") {
    return {
      status: "waiting_approval",
      provider: "codex",
      detail: "This local action requires ASTRA_ALLOW_FILE_WRITE=true.",
    };
  }

  if (agentKey === "computer" && !policy.allowShell) {
    return {
      status: "waiting_approval",
      provider: "codex",
      detail: "Computer actions require ASTRA_ALLOW_SHELL=true.",
    };
  }

  const status = await getCodexStatus(policy);
  if (!status.available) {
    return {
      status: "failed",
      provider: "codex",
      detail: status.detail,
    };
  }

  if (status.sandbox === "read-only") {
    return {
      status: "waiting_approval",
      provider: "codex",
      detail:
        "Codex is available but its effective sandbox is read-only.",
    };
  }

  const result = await chatWithCodex({
    input:
      "BOUNDED PLAN STEP\nGoal: " +
      goal +
      "\nExecute only this step: " +
      step.title,
    agent: ASTRA_AGENT_MAP[agentKey],
    context,
    policyText: permissionPolicyPrompt(policy),
    policy,
    executionRequested: true,
    signal,
  });

  if (result.executionStatus === "completed") {
    return {
      status: "completed",
      provider: "codex",
      detail: "Codex reported verified completion for this bounded step.",
      output: result.message,
    };
  }

  if (result.executionStatus === "blocked") {
    return {
      status: "waiting_approval",
      provider: "codex",
      detail: result.message || "Codex blocked this step.",
    };
  }

  return {
    status: "failed",
    provider: "codex",
    detail: result.message || "Codex did not verify this step as completed.",
  };
}

async function verifyWithCodex({
  step,
  goal,
  context,
  policy,
  signal,
}: {
  step: AstraPlanStep;
  goal: string;
  context: string;
  policy: AstraBrainPermissionSnapshot;
  signal: AbortSignal;
}): Promise<AstraPlanStepExecutionOutcome> {
  const agentKey = stepAgent(step);
  if (!isEngineeringAgent(agentKey)) {
    return {
      status: "failed",
      detail:
        "No evidence-producing verification handler is configured for " +
        agentKey +
        " yet.",
    };
  }

  const verifyPolicy = readOnlyPolicy(policy);
  const status = await getCodexStatus(verifyPolicy);
  if (!status.available) {
    return {
      status: "failed",
      provider: "codex",
      detail: status.detail,
    };
  }

  const result = await chatWithCodex({
    input:
      "VERIFY ONLY\nGoal: " +
      goal +
      "\nVerification step: " +
      step.title +
      "\nDo not modify files. Run read-only checks and report concrete evidence.",
    agent: ASTRA_AGENT_MAP[agentKey],
    context,
    policyText: permissionPolicyPrompt(verifyPolicy),
    policy: verifyPolicy,
    verificationRequested: true,
    signal,
  });

  if (result.executionStatus !== "completed") {
    return {
      status: "failed",
      provider: "codex",
      detail:
        result.message ||
        "Codex did not provide a verified successful verification marker.",
    };
  }

  return {
    status: "completed",
    provider: "codex",
    detail: "Read-only verification completed with evidence through Codex.",
    output: result.message,
  };
}

export async function executeBrainPlan(
  options: BrainPlanExecutorOptions,
): Promise<AstraPlanExecutionResult> {
  return executeBoundedPlan(options.plan, {
    approvedPermissionLevel: options.approvedPermissionLevel,
    approvedStepIds: options.approvedStepIds,
    signal: options.signal,
    onEvent: options.onEvent,
    executeStep: async (step, stepContext) => {
      const context = [
        options.baseContext || "",
        priorOutputsText(stepContext.outputs),
      ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 12000);

      switch (step.kind) {
        case "memory":
          return inspectMemory({
            step,
            project: options.project,
            signal: stepContext.signal,
          });

        case "reason":
          return reasonWithLocalModel({
            step,
            goal: stepContext.goal,
            context,
            signal: stepContext.signal,
          });

        case "inspect": {
          const native = await inspectWithNativeProjectTool({
            step,
            project: options.project,
            policy: options.policy,
            approvedPermissionLevel: options.approvedPermissionLevel,
            signal: stepContext.signal,
            onToolEvent: options.onToolEvent,
          });
          if (native) return native;

          if (options.providerChoice !== "ollama") {
            const codex = await inspectWithCodex({
              step,
              goal: stepContext.goal,
              context,
              policy: options.policy,
              signal: stepContext.signal,
            });
            if (codex) return codex;
          }

          return inspectMemory({
            step,
            project: options.project,
            signal: stepContext.signal,
          });
        }

        case "research":
          return executeResearchStep({
            step,
            goal: stepContext.goal,
            policy: options.policy,
            approvedPermissionLevel: options.approvedPermissionLevel,
            signal: stepContext.signal,
            onToolEvent: options.onToolEvent,
          });

        case "tool": {
          const structured = await executeStructuredTool({
            step,
            project: options.project,
            policy: options.policy,
            approvedPermissionLevel: options.approvedPermissionLevel,
            signal: stepContext.signal,
            onToolEvent: options.onToolEvent,
          });
          if (structured) return structured;

          if (options.providerChoice === "ollama") {
            return {
              status: "failed",
              provider: "ollama",
              detail:
                "This tool step has no registered toolId. Ollama is reasoning-only and cannot execute an unstructured action.",
            };
          }

          return executeCodexTool({
            step,
            goal: stepContext.goal,
            context,
            policy: options.policy,
            signal: stepContext.signal,
          });
        }

        case "verify":
          if (options.providerChoice === "ollama") {
            return {
              status: "failed",
              provider: "ollama",
              detail:
                "Ollama cannot provide execution evidence for verification.",
            };
          }
          return verifyWithCodex({
            step,
            goal: stepContext.goal,
            context,
            policy: options.policy,
            signal: stepContext.signal,
          });

        case "approval":
          return {
            status: "waiting_approval",
            detail: "This plan explicitly requires an approval checkpoint.",
          };
      }
    },
  });
}
