import { runAgent, selectAgent } from "@/lib/agent/orchestrator";
import { ASTRA_AGENT_MAP } from "@/lib/agent/roster";
import {
  visualNodeForAgent,
  visualNodeForSkill,
  type AstraCapabilityNodeKey,
  type AstraCapabilityState,
} from "@/lib/agent/capabilities";
import type {
  AstraAgentKey,
  AstraApprovalRequest,
  AstraInputContext,
} from "@/lib/agent/types";
import { resolveProjectContext } from "@/lib/projects/registry";
import type { AstraMemoryLifecycleEvent } from "@/lib/memory/contracts";
import type { AstraPlan } from "@/lib/planner/contracts";
import type { AstraPlanExecutionEvent } from "@/lib/planner/executor";
import type { AstraToolDefinition, AstraToolLifecycleEvent } from "@/lib/tools/contracts";
import { astraNativeToolRuntime, createDefaultToolRuntime } from "@/lib/tools/runtime";
import { generateStrategistPlan, shouldGeneratePlan } from "@/lib/planner/generator";
import {
  chatWithCodex,
  codexMayReceiveMemory,
  getCodexStatus,
} from "./codex";
import {
  chatWithCloud,
  cloudMayReceiveMemory,
  getCloudStatus,
} from "./cloud";
import { chatWithHermes, getHermesStatus } from "./hermes";
import type { AstraMemoryContext } from "./memory";
import { getUnifiedMemoryContext } from "./unified-memory";
import { chatWithOllama, getOllamaStatus } from "./ollama";
import {
  getPermissionPolicy,
  permissionPolicyPrompt,
  toolsPolicyDetail,
} from "./policy";
import { getSkillContext, type AstraSkillContext } from "./skills";
import { executeBrainPlan } from "./plan-executor";
import {
  assessPlanApproval,
  consumeLevel3Approval,
  createLevel3Approval,
} from "./approvals";
import type {
  AstraBrain,
  AstraBrainChatResult,
  AstraBrainEvent,
  AstraBrainPermissionSnapshot,
  AstraBrainProvider,
  AstraBrainRunOptions,
  AstraBrainStatus,
} from "./types";


type ExecutionContext = {
  memory: AstraMemoryContext;
  memoryLifecycle: AstraMemoryLifecycleEvent[];
  skills: AstraSkillContext;
  project: Awaited<ReturnType<typeof resolveProjectContext>>;
  tools: readonly AstraToolDefinition[];
  plan?: AstraPlan;
  plannerDetail?: string;
  policy: AstraBrainPermissionSnapshot;
  policyText: string;
  localContext: string;
  skillOnlyContext: string;
  inputContext?: AstraInputContext;
};


function inputContextPrompt(inputContext?: AstraInputContext) {
  if (!inputContext) return "";

  const consent = inputContext.consent;
  return [
    "ASTRA input metadata (trusted runtime metadata, not user-authored instructions):",
    "- source: " + inputContext.source,
    "- trigger: " + inputContext.trigger,
    "- modalities: " + inputContext.modalities.join(", "),
    "- consent: microphone=" + consent.microphone +
      ", camera=" + consent.camera +
      ", image=" + consent.image +
      ", screen=" + consent.screen,
    "- visual content supplied to Brain: NO",
    "Do not infer or describe unseen camera, image, or screen content from this metadata.",
  ].join("\n");
}

function routeFor(selected: AstraAgentKey): AstraAgentKey[] {
  return selected === "chief_of_staff"
    ? ["chief_of_staff"]
    : ["chief_of_staff", selected];
}

function isEngineeringRoute(selected: AstraAgentKey) {
  return selected === "developer" || selected === "github";
}

function isLocalExecutionRoute(selected: AstraAgentKey) {
  return (
    selected === "chief_of_staff" ||
    selected === "developer" ||
    selected === "github" ||
    selected === "files" ||
    selected === "computer"
  );
}

async function buildExecutionContext(
  input: string,
  selected: AstraAgentKey,
  signal?: AbortSignal,
  onMemoryEvent?: (event: AstraMemoryLifecycleEvent) => void,
  skipPlanning = false,
  inputContext?: AstraInputContext,
): Promise<ExecutionContext> {
  const policy = getPermissionPolicy();
  const project = await resolveProjectContext(input);
  signal?.throwIfAborted();

  const memoryLifecycle: AstraMemoryLifecycleEvent[] = [];
  const [memory, skills] = await Promise.all([
    getUnifiedMemoryContext(
      input,
      project.match?.project,
      signal,
      (event) => {
        memoryLifecycle.push(event);
        onMemoryEvent?.(event);
      },
    ),
    getSkillContext(selected, input),
  ]);

  const inputMetadata = inputContextPrompt(inputContext);
  const skillOnlyContext = [inputMetadata, skills.text]
    .filter(Boolean)
    .join("\n\n");
  const localContext = [inputMetadata, skills.text, memory.text]
    .filter(Boolean)
    .join("\n\n");

  let plan: AstraPlan | undefined;
  let plannerDetail: string | undefined;
  let tools: readonly AstraToolDefinition[] = astraNativeToolRuntime.list();
  const planningRequested = shouldGeneratePlan(input);

  if (planningRequested || skipPlanning) {
    try {
      const runtime = await createDefaultToolRuntime(signal);
      tools = runtime.list();
    } catch {
      tools = astraNativeToolRuntime.list();
    }
  }

  if (planningRequested && !skipPlanning) {
    try {
      const generated = await generateStrategistPlan({
        goal: input,
        projectId: project.match?.project.id,
        context: localContext,
        tools,
        signal,
      });
      plan = generated.plan;
      plannerDetail =
        "Strategist generated " +
        generated.plan.steps.length +
        " bounded step" +
        (generated.plan.steps.length === 1 ? "" : "s") +
        " with local Ollama model " +
        generated.model +
        ".";
    } catch (error) {
      signal?.throwIfAborted();
      plannerDetail =
        error instanceof Error
          ? "Strategist planning unavailable: " + error.message
          : "Strategist planning unavailable.";
    }
  }

  return {
    memory,
    memoryLifecycle,
    skills,
    project,
    tools,
    plan,
    plannerDetail,
    policy,
    policyText: permissionPolicyPrompt(policy),
    localContext,
    skillOnlyContext,
    inputContext,
  };
}

function baseEvents(selected: AstraAgentKey, now = Date.now()): AstraBrainEvent[] {
  const events: AstraBrainEvent[] = [
    {
      id: `${now}-request`,
      type: "request.received",
      at: now,
      agent: "chief_of_staff",
      visualNode: "chief_of_staff",
      label: "Request received",
      detail: "ASTRA Core accepted the request.",
    },
  ];

  if (selected !== "chief_of_staff") {
    events.push({
      id: `${now}-route`,
      type: "router.selected",
      at: now + 1,
      agent: selected,
      visualNode: visualNodeForAgent(selected),
      label: "Route selected",
      detail: `Chief routed the request to ${selected}.`,
    });
  }

  return events;
}

function contextEvents(
  selected: AstraAgentKey,
  context: ExecutionContext,
  now: number,
): AstraBrainEvent[] {
  const events: AstraBrainEvent[] = [];
  let offset = 2;

  if (context.project.match) {
    events.push({
      id: `${now}-project`,
      type: "project.selected",
      at: now + offset,
      agent: "chief_of_staff",
      visualNode: "chief_of_staff",
      label: "Project selected",
      detail:
        context.project.match.project.name +
        " (" +
        context.project.match.reason +
        ")",
    });
    offset += 1;
  }

  for (const memoryEvent of context.memoryLifecycle) {
    events.push(
      memoryLifecycleBrainEvent(
        memoryEvent,
        `${now}-memory-lifecycle-${offset}`,
        now + offset,
      ),
    );
    offset += 1;
  }

  if (context.memory.entries.length > 0) {
    events.push({
      id: `${now}-memory`,
      type: "memory.loaded",
      at: now + offset,
      agent: "memory",
      visualNode: "memory",
      label: "Memory loaded",
      detail: `Retrieved ${context.memory.records.length} relevant memory record${context.memory.records.length === 1 ? "" : "s"}.`,
    });
    offset += 1;
  }

  if (context.plan) {
    events.push({
      id: `${now}-plan`,
      type: "plan.created",
      at: now + offset,
      agent: "chief_of_staff",
      visualNode: "strategist",
      label: "Plan created",
      detail:
        "Strategist created " +
        context.plan.steps.length +
        " bounded step" +
        (context.plan.steps.length === 1 ? "" : "s") +
        ". No plan step has executed yet.",
    });
    offset += 1;
  }

  if (context.skills.skills.length > 0) {
    const specialist =
      context.skills.skills.find(
        (skill) =>
          skill.id !== "business-analysis" &&
          skill.id !== "chief-orchestration",
      ) ?? context.skills.skills[0];

    events.push({
      id: `${now}-skills`,
      type: "skill.selected",
      at: now + offset,
      agent: selected,
      visualNode: visualNodeForSkill(specialist.id, selected),
      label: "Skills loaded",
      detail: context.skills.skills.map((skill) => skill.id).join(", "),
    });
    offset += 1;
  }

  events.push({
    id: `${now}-policy`,
    type: "policy.applied",
    at: now + offset,
    agent: selected,
    label: "Permission policy applied",
    detail: toolsPolicyDetail(context.policy),
  });

  return events;
}

function memoryLifecycleBrainEvent(
  event: AstraMemoryLifecycleEvent,
  id: string,
  at: number,
): AstraBrainEvent {
  switch (event.type) {
    case "search.started":
      return {
        id,
        type: "memory.search.started",
        at,
        agent: "memory",
        visualNode: "memory",
        label: "Memory search started",
        detail:
          "Querying " +
          event.sourceCount +
          " memory source" +
          (event.sourceCount === 1 ? "" : "s") +
          (event.project ? " for " + event.project + "." : "."),
      };
    case "source.queried":
      return {
        id,
        type: "memory.source.queried",
        at,
        agent: "memory",
        visualNode: "memory",
        label: "Memory source queried",
        detail:
          event.source +
          " (" +
          event.sourceType +
          ") " +
          (event.available ? "returned " + event.recordCount + " record" + (event.recordCount === 1 ? "" : "s") : "is unavailable") +
          ".",
      };
    case "graph.matched":
      return {
        id,
        type: "memory.graph.matched",
        at,
        agent: "memory",
        visualNode: "memory",
        label: "Knowledge graph matched",
        detail:
          event.source +
          " returned " +
          event.recordCount +
          " graph-backed record" +
          (event.recordCount === 1 ? "." : "s."),
      };
    case "context.selected":
      return {
        id,
        type: "memory.context.selected",
        at,
        agent: "memory",
        visualNode: "memory",
        label: "Memory context selected",
        detail:
          "Selected " +
          event.recordCount +
          " bounded record" +
          (event.recordCount === 1 ? "" : "s") +
          (event.sourceTypes.length > 0
            ? " from " + event.sourceTypes.join(", ") + "."
            : "."),
      };
    case "search.completed":
      return {
        id,
        type: "memory.search.completed",
        at,
        agent: "memory",
        visualNode: "memory",
        label: "Memory search completed",
        detail:
          "Selected " +
          event.selectedCount +
          " record" +
          (event.selectedCount === 1 ? "" : "s") +
          "; " +
          event.availableSources +
          " source" +
          (event.availableSources === 1 ? "" : "s") +
          " available, " +
          event.unavailableSources +
          " unavailable.",
      };
  }
}

function providerLabel(provider: AstraBrainProvider) {
  switch (provider) {
    case "hermes":
      return "Hermes";
    case "ollama":
      return "Ollama";
    case "codex":
      return "Codex";
    case "cloud":
      return "Cloud";
    default:
      return "Routing";
  }
}

let liveEventSequence = 0;

function emitLiveEvent(
  options: AstraBrainRunOptions | undefined,
  event: Omit<AstraBrainEvent, "id" | "at">,
) {
  const at = Date.now();
  liveEventSequence += 1;
  const live: AstraBrainEvent = {
    ...event,
    id: `live-${at}-${liveEventSequence}-${event.type}`,
    at,
  };
  options?.onEvent?.(live);
  return live;
}

function emitLiveMemoryLifecycle(
  event: AstraMemoryLifecycleEvent,
  options?: AstraBrainRunOptions,
) {
  const brainEvent = memoryLifecycleBrainEvent(
    event,
    "unused",
    Date.now(),
  );
  return emitLiveEvent(options, {
    type: brainEvent.type,
    agent: brainEvent.agent,
    visualNode: brainEvent.visualNode,
    provider: brainEvent.provider,
    label: brainEvent.label,
    detail: brainEvent.detail,
  });
}

function emitLiveStart(
  selected: AstraAgentKey,
  options?: AstraBrainRunOptions,
) {
  emitLiveEvent(options, {
    type: "request.received",
    agent: "chief_of_staff",
    visualNode: "chief_of_staff",
    label: "Request received",
    detail: "ASTRA Brain accepted the request.",
  });

  if (selected !== "chief_of_staff") {
    emitLiveEvent(options, {
      type: "router.selected",
      agent: selected,
      visualNode: visualNodeForAgent(selected),
      label: "Route selected",
      detail: `Chief routed the request to ${selected}.`,
    });
  }
}

function emitLiveContext(
  selected: AstraAgentKey,
  context: ExecutionContext,
  options?: AstraBrainRunOptions,
) {
  if (context.project.match) {
    emitLiveEvent(options, {
      type: "project.selected",
      agent: "chief_of_staff",
      visualNode: "chief_of_staff",
      label: "Project selected",
      detail:
        context.project.match.project.name +
        " (" +
        context.project.match.reason +
        ")",
    });
  }

  if (context.memory.entries.length > 0) {
    emitLiveEvent(options, {
      type: "memory.loaded",
      agent: "memory",
      visualNode: "memory",
      label: "Memory loaded",
      detail: `Retrieved ${context.memory.records.length} relevant memory record${context.memory.records.length === 1 ? "" : "s"}.`,
    });
  }

  if (context.plan) {
    emitLiveEvent(options, {
      type: "plan.created",
      agent: "chief_of_staff",
      visualNode: "strategist",
      label: "Plan created",
      detail:
        "Strategist created " +
        context.plan.steps.length +
        " bounded step" +
        (context.plan.steps.length === 1 ? "" : "s") +
        ". No plan step has executed yet.",
    });
  }

  if (context.skills.skills.length > 0) {
    emitLiveEvent(options, {
      type: "skill.selected",
      agent: selected,
      visualNode: visualNodeForAgent(selected),
      label: "Skills loaded",
      detail: context.skills.skills.map((skill) => skill.id).join(", "),
    });
  }

  emitLiveEvent(options, {
    type: "policy.applied",
    agent: selected,
    visualNode: visualNodeForAgent(selected),
    label: "Permission policy applied",
    detail: toolsPolicyDetail(context.policy),
  });
}

function emitLiveProviderStart(
  selected: AstraAgentKey,
  provider: Exclude<AstraBrainProvider, "routing_only">,
  options?: AstraBrainRunOptions,
) {
  const label = providerLabel(provider);
  emitLiveEvent(options, {
    type: "provider.selected",
    provider,
    agent: selected,
    visualNode: provider === "codex" ? "developer" : visualNodeForAgent(selected),
    label: `${label} selected`,
    detail:
      provider === "codex"
        ? "ASTRA selected the local authenticated Codex CLI engineering specialist."
        : provider === "cloud"
          ? "ASTRA selected the explicitly opted-in cloud fallback."
          : `ASTRA Brain selected the local ${label} provider.`,
  });
  emitLiveEvent(options, {
    type: "agent.started",
    provider,
    agent: selected,
    visualNode: visualNodeForAgent(selected),
    label: "Agent started",
    detail: `${ASTRA_AGENT_MAP[selected].name} started execution through ${label}.`,
  });
}

function emitLiveProviderUnavailable(
  selected: AstraAgentKey,
  provider: Exclude<AstraBrainProvider, "routing_only">,
  detail: string,
  options?: AstraBrainRunOptions,
) {
  emitLiveEvent(options, {
    type: "provider.unavailable",
    provider,
    agent: selected,
    visualNode: provider === "codex" ? "developer" : visualNodeForAgent(selected),
    label: `${providerLabel(provider)} unavailable`,
    detail,
  });
}

function emitLiveProviderComplete(
  selected: AstraAgentKey,
  provider: Exclude<AstraBrainProvider, "routing_only">,
  options?: AstraBrainRunOptions,
) {
  const label = providerLabel(provider);
  emitLiveEvent(options, {
    type: "agent.completed",
    provider,
    agent: selected,
    visualNode: visualNodeForAgent(selected),
    label: "Agent completed",
    detail: `${ASTRA_AGENT_MAP[selected].name} completed the ${label} turn.`,
  });
  emitLiveEvent(options, {
    type: "response.ready",
    provider,
    agent: selected,
    visualNode: "chief_of_staff",
    label: "Response ready",
    detail: `${label} returned the final response to ASTRA Runtime.`,
  });
}

function emitLiveBlocked(
  selected: AstraAgentKey,
  detail: string,
  options?: AstraBrainRunOptions,
) {
  emitLiveEvent(options, {
    type: "agent.blocked",
    provider: "routing_only",
    agent: selected,
    visualNode: visualNodeForAgent(selected),
    label: "Execution blocked",
    detail,
  });
  emitLiveEvent(options, {
    type: "response.ready",
    provider: "routing_only",
    agent: selected,
    visualNode: "chief_of_staff",
    label: "Response ready",
    detail: "ASTRA returned a blocked/routing-only result.",
  });
}

function providerEvents(
  selected: AstraAgentKey,
  provider: Exclude<AstraBrainProvider, "routing_only">,
  context: ExecutionContext,
): AstraBrainEvent[] {
  const now = Date.now();
  const label = providerLabel(provider);
  const contextTrace = contextEvents(selected, context, now);
  const startAt = now + 2 + contextTrace.length;

  return [
    ...baseEvents(selected, now),
    ...contextTrace,
    {
      id: `${now}-provider`,
      type: "provider.selected",
      at: startAt,
      agent: selected,
      visualNode: provider === "codex" ? "developer" : visualNodeForAgent(selected),
      label: `${label} selected`,
      detail:
        provider === "codex"
          ? "ASTRA selected the local authenticated Codex CLI engineering specialist."
          : provider === "cloud"
            ? "ASTRA selected the explicitly opted-in cloud fallback."
            : `ASTRA Brain selected the local ${label} provider.`,
    },
    {
      id: `${now}-started`,
      type: "agent.started",
      at: startAt + 1,
      agent: selected,
      visualNode: visualNodeForAgent(selected),
      label: "Agent started",
      detail: `${ASTRA_AGENT_MAP[selected].name} started execution through ${label}.`,
    },
    {
      id: `${now}-completed`,
      type: "agent.completed",
      at: startAt + 2,
      agent: selected,
      visualNode: visualNodeForAgent(selected),
      label: "Agent completed",
      detail: `${ASTRA_AGENT_MAP[selected].name} completed the ${label} turn.`,
    },
    {
      id: `${now}-response`,
      type: "response.ready",
      at: startAt + 3,
      agent: selected,
      visualNode: "chief_of_staff",
      label: "Response ready",
      detail: `${label} returned the final response to ASTRA Runtime.`,
    },
  ];
}

function routingOnlyEvents(
  selected: AstraAgentKey,
  state: AstraBrainChatResult["state"],
  context: ExecutionContext,
  providerDetail?: string,
): AstraBrainEvent[] {
  const now = Date.now();
  const contextTrace = contextEvents(selected, context, now);
  const events: AstraBrainEvent[] = [
    ...baseEvents(selected, now),
    ...contextTrace,
  ];
  let offset = 2 + contextTrace.length;

  if (providerDetail) {
    events.push({
      id: `${now}-provider-unavailable`,
      type: "provider.unavailable",
      at: now + offset,
      agent: selected,
      visualNode: visualNodeForAgent(selected),
      label: "Execution providers unavailable",
      detail: providerDetail,
    });
    offset += 1;
  }

  if (state === "needs_provider" || state === "blocked") {
    events.push({
      id: `${now}-blocked`,
      type: "agent.blocked",
      at: now + offset,
      agent: selected,
      visualNode: visualNodeForAgent(selected),
      label: state === "blocked" ? "Execution blocked" : "Execution waiting",
      detail:
        providerDetail ||
        (state === "blocked"
          ? "ASTRA permission policy blocked this execution request."
          : "No permitted execution provider is currently available."),
    });
    offset += 1;
  }

  events.push({
    id: `${now}-response`,
    type: "response.ready",
    at: now + offset,
    agent: selected,
    visualNode: "chief_of_staff",
    label: "Response ready",
    detail:
      state === "needs_provider"
        ? "Routing and context retrieval completed; execution did not run."
        : state === "blocked"
          ? "Execution was blocked by approval or permission policy."
          : "ASTRA completed the request.",
  });

  return events;
}

function planExecutionEventFields(
  event: AstraPlanExecutionEvent,
): Omit<AstraBrainEvent, "id" | "at"> {
  const agent = event.agent ?? "chief_of_staff";
  const provider =
    event.provider === "codex" ||
    event.provider === "ollama" ||
    event.provider === "hermes" ||
    event.provider === "cloud"
      ? event.provider
      : undefined;

  const visualNode =
    event.type === "plan.completed" || event.type === "plan.cancelled"
      ? "strategist"
      : visualNodeForAgent(agent);

  const label =
    event.type === "plan.step.started"
      ? "Plan step started"
      : event.type === "plan.step.progress"
        ? "Plan step progress"
        : event.type === "plan.step.completed"
          ? "Plan step completed"
          : event.type === "plan.step.failed"
            ? "Plan step failed"
            : event.type === "plan.completed"
              ? "Plan completed"
              : "Plan cancelled";

  return {
    type: event.type,
    agent,
    visualNode,
    provider,
    label,
    detail: event.detail,
  };
}

function toolLifecycleEventFields(
  event: AstraToolLifecycleEvent,
): Omit<AstraBrainEvent, "id" | "at"> {
  let agent: AstraAgentKey = "chief_of_staff";
  let visualNode = "chief_of_staff";

  switch (event.category) {
    case "filesystem":
    case "drive":
      agent = "files";
      visualNode = "drive";
      break;
    case "github":
      agent = "github";
      visualNode = "developer";
      break;
    case "research":
    case "browser":
      agent = "researcher";
      visualNode = "researcher";
      break;
    case "shell":
    case "computer":
      agent = "computer";
      visualNode = "ops";
      break;
    case "email":
      agent = "communication";
      visualNode = "email";
      break;
    case "calendar":
      agent = "communication";
      visualNode = "calendar";
      break;
    case "crm":
      agent = "business";
      visualNode = "crm";
      break;
    case "analytics":
      agent = "business";
      visualNode = "analytics";
      break;
    case "design":
      agent = "chief_of_staff";
      visualNode = "design";
      break;
    case "database":
      agent = "business";
      visualNode = "ops";
      break;
    case "mcp":
      agent = "chief_of_staff";
      visualNode = "ops";
      break;
  }

  return {
    type: event.type,
    agent,
    visualNode,
    label:
      event.type === "tool.started"
        ? event.toolName + " started"
        : event.type === "tool.completed"
          ? event.toolName + " completed"
          : event.toolName + " failed",
    detail: event.detail,
  };
}

function providerFromPlanEvents(events: AstraBrainEvent[]): AstraBrainProvider {
  if (events.some((event) => event.provider === "codex")) return "codex";
  if (events.some((event) => event.provider === "hermes")) return "hermes";
  if (events.some((event) => event.provider === "ollama")) return "ollama";
  if (events.some((event) => event.provider === "cloud")) return "cloud";
  return "routing_only";
}

function routeFromPlan(
  selected: AstraAgentKey,
  plan: AstraPlan,
): AstraAgentKey[] {
  const route: AstraAgentKey[] = ["chief_of_staff"];
  if (selected !== "chief_of_staff") route.push(selected);
  for (const step of plan.steps) {
    if (step.agent && !route.includes(step.agent)) route.push(step.agent);
  }
  return route;
}

function envelopeContext(context: ExecutionContext) {
  return {
    context: {
      memoryEntries: context.memory.entries.length,
      memorySources: [...new Set(context.memory.records.map((record) => record.provenance.sourceType))],
      project: context.project.match
        ? {
            id: context.project.match.project.id,
            name: context.project.match.project.name,
            reason: context.project.match.reason,
          }
        : undefined,
      skills: context.skills.skills.map((skill) => skill.id),
      input: context.inputContext,
    },
    plan: context.plan,
    permissions: context.policy,
  };
}

class RoutingOnlyBrainAdapter implements AstraBrain {
  async chat(
    input: string,
    options?: AstraBrainRunOptions,
  ): Promise<AstraBrainChatResult> {
    const response = await runAgent(input);
    const route = routeFor(response.agent);
    const context = await buildExecutionContext(
      input,
      response.agent,
      options?.signal,
      undefined,
      false,
      options?.inputContext,
    );
    const events = routingOnlyEvents(response.agent, response.state, context);
    for (const event of events) options?.onEvent?.(event);

    return {
      ...response,
      brain: {
        provider: "routing_only",
        execution: response.state === "completed" ? "executed" : "routing_only",
        route,
        visualNodes: route.map(visualNodeForAgent),
        events,
        ...envelopeContext(context),
      },
    };
  }

  async execute(
    task: { input: string; approved?: boolean; approvalToken?: string },
    options?: AstraBrainRunOptions,
  ): Promise<AstraBrainChatResult> {
    const response = await this.chat(task.input, options);
    return {
      ...response,
      brain: {
        ...response.brain,
        requestedMode: "execute" as const,
      },
    };
  }

  async cancel() {
    // Routing-only mode has no long-running backend process to cancel.
  }

  async status(): Promise<AstraBrainStatus> {
    const policy = getPermissionPolicy();
    return {
      ready: true,
      provider: "routing_only",
      mode: "routing_only",
      detail: "ASTRA routing-only fallback is ready.",
      permissions: policy,
    };
  }
}

class LocalPreferredBrainAdapter implements AstraBrain {
  private readonly fallback = new RoutingOnlyBrainAdapter();

  async chat(
    input: string,
    options?: AstraBrainRunOptions,
  ): Promise<AstraBrainChatResult> {
    options?.signal?.throwIfAborted();
    const selected = selectAgent(input);
    const agent = ASTRA_AGENT_MAP[selected];
    const route = routeFor(selected);
    emitLiveStart(selected, options);
    const context = await buildExecutionContext(
      input,
      selected,
      options?.signal,
      (event) => emitLiveMemoryLifecycle(event, options),
      false,
      options?.inputContext,
    );
    emitLiveContext(selected, context, options);
    const failures: string[] = [];
    const preferredProvider = options?.provider ?? "auto";

    if (preferredProvider === "codex" || (preferredProvider === "auto" && isEngineeringRoute(selected))) {
      emitLiveProviderStart(selected, "codex", options);
      try {
        const codexContext = [
          context.skillOnlyContext,
          codexMayReceiveMemory() ? context.memory.text : "",
        ]
          .filter(Boolean)
          .join("\n\n");
        const result = await chatWithCodex({
          input,
          agent,
          context: codexContext,
          policyText: context.policyText,
          policy: context.policy,
          signal: options?.signal,
        });
        emitLiveProviderComplete(selected, "codex", options);

        return {
          ok: true,
          agent: selected,
          agentName: agent.name,
          state: "completed",
          message: result.message,
          requiresApproval: false,
          brain: {
            provider: "codex",
            execution: "executed",
            requestedMode: "chat",
            route,
            visualNodes: route.map(visualNodeForAgent),
            events: providerEvents(selected, "codex", context),
            ...envelopeContext(context),
          },
        };
      } catch (error) {
        options?.signal?.throwIfAborted();
        const detail = `Codex: ${error instanceof Error ? error.message : "unavailable"}`;
        failures.push(detail);
        emitLiveProviderUnavailable(selected, "codex", detail, options);
      }
    }

    if (preferredProvider === "auto") {
      emitLiveProviderStart(selected, "hermes", options);
      try {
        const result = await chatWithHermes({
          input,
          agent,
          context: context.localContext,
          policyText: context.policyText,
          signal: options?.signal,
        });
        emitLiveProviderComplete(selected, "hermes", options);

        return {
          ok: true,
          agent: selected,
          agentName: agent.name,
          state: "completed",
          message: result.message,
          requiresApproval: false,
          brain: {
            provider: "hermes",
            execution: "executed",
            requestedMode: "chat",
            route,
            visualNodes: route.map(visualNodeForAgent),
            events: providerEvents(selected, "hermes", context),
            ...envelopeContext(context),
          },
        };
      } catch (error) {
        options?.signal?.throwIfAborted();
        const detail = `Hermes: ${error instanceof Error ? error.message : "unavailable"}`;
        failures.push(detail);
        emitLiveProviderUnavailable(selected, "hermes", detail, options);
      }
    }

    if (preferredProvider !== "codex") {
      emitLiveProviderStart(selected, "ollama", options);
      try {
        const result = await chatWithOllama({
          input,
          agent,
          context: context.localContext,
          policyText: context.policyText,
          signal: options?.signal,
        });
        emitLiveProviderComplete(selected, "ollama", options);

        return {
          ok: true,
          agent: selected,
          agentName: agent.name,
          state: "completed",
          message: result.message,
          requiresApproval: false,
          brain: {
            provider: "ollama",
            execution: "executed",
            requestedMode: "chat",
            route,
            visualNodes: route.map(visualNodeForAgent),
            events: providerEvents(selected, "ollama", context),
            ...envelopeContext(context),
          },
        };
      } catch (error) {
        options?.signal?.throwIfAborted();
        const detail = `Ollama: ${error instanceof Error ? error.message : "unavailable"}`;
        failures.push(detail);
        emitLiveProviderUnavailable(selected, "ollama", detail, options);
      }
    }

    if (preferredProvider === "auto" && context.policy.allowPaidCloud) {
      emitLiveProviderStart(selected, "cloud", options);
      try {
        const cloudContext = [
          context.skillOnlyContext,
          cloudMayReceiveMemory(context.policy) ? context.memory.text : "",
        ]
          .filter(Boolean)
          .join("\n\n");

        const result = await chatWithCloud({
          input,
          agent,
          context: cloudContext,
          policyText: context.policyText,
          policy: context.policy,
          signal: options?.signal,
        });
        emitLiveProviderComplete(selected, "cloud", options);

        return {
          ok: true,
          agent: selected,
          agentName: agent.name,
          state: "completed",
          message: result.message,
          requiresApproval: false,
          brain: {
            provider: "cloud",
            execution: "executed",
            requestedMode: "chat",
            route,
            visualNodes: route.map(visualNodeForAgent),
            events: providerEvents(selected, "cloud", context),
            ...envelopeContext(context),
          },
        };
      } catch (error) {
        options?.signal?.throwIfAborted();
        const detail = `Cloud: ${error instanceof Error ? error.message : "unavailable"}`;
        failures.push(detail);
        emitLiveProviderUnavailable(selected, "cloud", detail, options);
      }
    }

    options?.signal?.throwIfAborted();
    const fallback = await this.fallback.chat(input, options);
    emitLiveBlocked(
      selected,
      failures.join(" | ") || "No execution provider is currently available.",
      options,
    );
    return {
      ...fallback,
      brain: {
        ...fallback.brain,
        route,
        visualNodes: route.map(visualNodeForAgent),
        events: routingOnlyEvents(
          selected,
          fallback.state,
          context,
          failures.join(" | "),
        ),
        ...envelopeContext(context),
      },
    };
  }

  async execute(
    task: { input: string; approved?: boolean; approvalToken?: string },
    options?: AstraBrainRunOptions,
  ): Promise<AstraBrainChatResult> {
    options?.signal?.throwIfAborted();
    const input = task.input.trim();
    const selected = selectAgent(input);
    const agent = ASTRA_AGENT_MAP[selected];
    const route = routeFor(selected);
    emitLiveStart(selected, options);
    const context = await buildExecutionContext(
      input,
      selected,
      options?.signal,
      (event) => emitLiveMemoryLifecycle(event, options),
      Boolean(task.approvalToken),
      options?.inputContext,
    );
    emitLiveContext(selected, context, options);
    const failures: string[] = [];
    const preferredProvider = options?.provider ?? "auto";

    const blocked = (
      message: string,
      detail: string,
      requiresApproval = false,
      approvalRequest?: AstraApprovalRequest,
    ): AstraBrainChatResult => {
      emitLiveBlocked(selected, detail, options);
      return {
        ok: false,
        agent: selected,
        agentName: agent.name,
        state: "blocked",
        message,
        requiresApproval,
        approvalRequest,
        brain: {
          provider: "routing_only",
          execution: "blocked",
          requestedMode: "execute",
          route,
          visualNodes: route.map(visualNodeForAgent),
          events: routingOnlyEvents(selected, "blocked", context, detail),
          ...envelopeContext(context),
        },
      };
    };

    let approvedPermissionLevel: 0 | 1 | 2 | 3 | 4 =
      context.policy.requireApproval ? (task.approved ? 2 : 1) : 2;
    let approvedStepIds: string[] = [];
    let usedScopedApproval = false;

    if (task.approvalToken) {
      const grant = consumeLevel3Approval({
        token: task.approvalToken,
        input,
      });

      if (!grant) {
        return blocked(
          "Approval Level-3 tidak valid, sudah dipakai, atau sudah kedaluwarsa. Jalankan kembali task untuk membuat approval request baru.",
          "Scoped Level-3 approval token validation failed.",
          true,
        );
      }

      if (
        grant.plan.projectId &&
        context.project.match?.project.id !== grant.plan.projectId
      ) {
        return blocked(
          "Approval Level-3 tidak lagi cocok dengan project yang aktif.",
          "Scoped approval project no longer matches the resolved Project Registry context.",
        );
      }

      context.plan = grant.plan;
      approvedPermissionLevel = 2;
      approvedStepIds = [grant.request.stepId];
      usedScopedApproval = true;

      emitLiveEvent(options, {
        type: "approval.granted",
        agent: "chief_of_staff",
        visualNode: "chief_of_staff",
        label: "Level-3 approval granted",
        detail:
          "One-time approval accepted for " +
          grant.request.toolId +
          " on plan " +
          grant.request.planId +
          ".",
      });
    }

    if (
      context.policy.requireApproval &&
      approvedPermissionLevel < 2
    ) {
      return blocked(
        "ASTRA siap menjalankan tugas ini, tetapi eksekusi lokal membutuhkan approval eksplisit. Gunakan EXECUTE TASK untuk menyetujui Level-2 local execution.",
        "Execution mode requested without explicit safe-local approval.",
        true,
      );
    }

    if (context.plan) {
      const approvalPreflight = assessPlanApproval({
        plan: context.plan,
        approvedPermissionLevel,
        tools: context.tools,
        allowExternalActions: context.policy.allowExternalActions,
        skipLevel3Preflight: usedScopedApproval,
      });

      if (approvalPreflight.kind === "level4") {
        return blocked(
          "Plan ini mengandung izin Level-4/high-impact pada step: " +
            approvalPreflight.step.title +
            ". ASTRA belum mengizinkan approval Level-4 melalui UI normal.",
          approvalPreflight.detail,
          true,
        );
      }

      if (approvalPreflight.kind === "blocked") {
        return blocked(
          approvalPreflight.detail,
          approvalPreflight.detail,
          approvalPreflight.step.permissionLevel > 2,
        );
      }

      if (approvalPreflight.kind === "level3") {
        const approvalRequest = createLevel3Approval({
          input,
          plan: context.plan,
          step: approvalPreflight.step,
        });

        emitLiveEvent(options, {
          type: "approval.requested",
          agent: approvalPreflight.step.agent ?? "chief_of_staff",
          visualNode: visualNodeForAgent(
            approvalPreflight.step.agent ?? "chief_of_staff",
          ),
          label: "Level-3 approval requested",
          detail:
            "Approval required for " +
            approvalRequest.toolId +
            " before any plan step executes.",
        });

        return blocked(
          "ASTRA membutuhkan approval Level-3 untuk action eksternal: " +
            approvalPreflight.step.title +
            ". Periksa scope lalu tekan APPROVE LEVEL 3.",
          "Bounded plan preflight stopped before execution and issued a one-time scoped approval challenge.",
          true,
          approvalRequest,
        );
      }

      const hasUnstructuredAction = context.plan.steps.some(
        (step) =>
          step.kind === "tool" &&
          step.permissionLevel > 1 &&
          !step.toolId,
      );

      if (preferredProvider === "ollama" && hasUnstructuredAction) {
        return blocked(
          "Plan ini memiliki action yang belum terikat ke tool ASTRA nyata. Ollama boleh merencanakan dan menggunakan registered Tool Runtime, tetapi tidak boleh mengeksekusi action prose tanpa toolId.",
          "Explicit Ollama mode cannot execute an unstructured side-effecting plan step.",
        );
      }

      const planEvents: AstraBrainEvent[] = [];
      const result = await executeBrainPlan({
        plan: context.plan,
        project: context.project.match?.project,
        baseContext: context.localContext,
        policy: context.policy,
        providerChoice: preferredProvider,
        approvedPermissionLevel,
        approvedStepIds,
        signal: options?.signal,
        onEvent: (event) => {
          const live = emitLiveEvent(options, planExecutionEventFields(event));
          planEvents.push(live);
        },
        onToolEvent: (event) => {
          const live = emitLiveEvent(options, toolLifecycleEventFields(event));
          planEvents.push(live);
        },
      });

      context.plan = result.plan;
      const planRoute = routeFromPlan(selected, result.plan);
      const provider = providerFromPlanEvents(planEvents);
      const now = Date.now();
      const trace = [
        ...baseEvents(selected, now),
        ...contextEvents(selected, context, now),
        ...planEvents,
      ];

      const outputSummary = Object.values(result.outputs)
        .slice(-3)
        .join("\n\n")
        .slice(0, 6000);

      if (result.outcome === "completed") {
        const message = [
          "ASTRA menyelesaikan plan " +
            result.plan.steps.length +
            " langkah dengan bounded orchestrator.",
          outputSummary,
        ]
          .filter(Boolean)
          .join("\n\n");

        const responseEvent = emitLiveEvent(options, {
          type: "response.ready",
          provider: provider === "routing_only" ? undefined : provider,
          agent: selected,
          visualNode: "chief_of_staff",
          label: "Response ready",
          detail: "Bounded plan execution completed and returned to ASTRA Runtime.",
        });
        trace.push(responseEvent);

        return {
          ok: true,
          agent: selected,
          agentName: agent.name,
          state: "completed",
          message,
          requiresApproval: false,
          brain: {
            provider,
            execution: "executed",
            requestedMode: "execute",
            route: planRoute,
            visualNodes: planRoute.map(visualNodeForAgent),
            events: trace,
            ...envelopeContext(context),
          },
        };
      }

      const needsApproval = result.outcome === "waiting_approval";
      const detail =
        result.detail +
        (result.blockedStepId
          ? " Blocked at " + result.blockedStepId + "."
          : "");

      let followUpApprovalRequest: AstraApprovalRequest | undefined;

      if (needsApproval && result.blockedStepId) {
        const blockedStep = result.plan.steps.find(
          (step) => step.id === result.blockedStepId,
        );

        if (
          blockedStep?.permissionLevel === 3 &&
          blockedStep.toolId
        ) {
          const definition = context.tools.find(
            (tool) => tool.id === blockedStep.toolId,
          );

          if (
            definition?.availability === "READY" &&
            (definition.sideEffect !== "external_write" ||
              context.policy.allowExternalActions)
          ) {
            const approvalPlan: AstraPlan = {
              ...result.plan,
              status: "planned",
              steps: result.plan.steps.map((step) =>
                step.id === blockedStep.id
                  ? { ...step, status: "pending" as const }
                  : step,
              ),
            };

            followUpApprovalRequest = createLevel3Approval({
              input,
              plan: approvalPlan,
              step: {
                ...blockedStep,
                status: "pending",
              },
            });

            context.plan = approvalPlan;

            emitLiveEvent(options, {
              type: "approval.requested",
              agent: blockedStep.agent ?? "chief_of_staff",
              visualNode: visualNodeForAgent(
                blockedStep.agent ?? "chief_of_staff",
              ),
              label: "Next Level-3 approval requested",
              detail:
                "A new one-time approval is required for " +
                blockedStep.toolId +
                ".",
            });
          }
        }
      }

      const blockedEvent = emitLiveEvent(options, {
        type: "agent.blocked",
        agent: selected,
        visualNode:
          result.blockedStepId
            ? visualNodeForAgent(
                result.plan.steps.find(
                  (step) => step.id === result.blockedStepId,
                )?.agent ?? selected,
              )
            : visualNodeForAgent(selected),
        label: needsApproval ? "Plan waiting approval" : "Plan execution failed",
        detail,
      });
      trace.push(blockedEvent);

      const responseEvent = emitLiveEvent(options, {
        type: "response.ready",
        agent: selected,
        visualNode: "chief_of_staff",
        label: "Response ready",
        detail: needsApproval
          ? "ASTRA returned a plan that is waiting for stronger approval."
          : "ASTRA returned a truthful plan execution failure.",
      });
      trace.push(responseEvent);

      return {
        ok: false,
        agent: selected,
        agentName: agent.name,
        state: needsApproval ? "blocked" : "error",
        message: detail,
        requiresApproval: needsApproval,
        approvalRequest: followUpApprovalRequest,
        brain: {
          provider,
          execution: "blocked",
          requestedMode: "execute",
          route: planRoute,
          visualNodes: planRoute.map(visualNodeForAgent),
          events: trace,
          ...envelopeContext(context),
        },
      };
    }

    if (preferredProvider === "ollama") {
      return blocked(
        "Ollama dipilih untuk chat lokal, tetapi tidak diberi alat eksekusi. Pilih Codex atau Auto untuk menjalankan perubahan nyata.",
        "Explicit Ollama mode is reasoning-only and cannot execute side effects.",
      );
    }

    if (preferredProvider === "codex" || isLocalExecutionRoute(selected)) {
      const codexStatus = await getCodexStatus(context.policy);

      if (!codexStatus.available) {
        failures.push(codexStatus.detail);
        emitLiveProviderUnavailable(
          selected,
          "codex",
          codexStatus.detail,
          options,
        );
      } else if (codexStatus.sandbox === "read-only") {
        return blocked(
          "Codex tersedia, tetapi ASTRA masih dalam mode read-only. Aktifkan izin tulis dan sandbox yang didukung mesin di .env.local, lalu restart ASTRA.",
          "Codex execution is blocked because its effective sandbox is read-only.",
        );
      } else if (selected === "computer" && !context.policy.allowShell) {
        return blocked(
          "Tugas komputer membutuhkan izin shell. Set ASTRA_ALLOW_SHELL=true di .env.local, lalu restart ASTRA.",
          "Computer execution is blocked because ASTRA_ALLOW_SHELL is false.",
        );
      } else {
        emitLiveProviderStart(selected, "codex", options);
        try {
          const codexContext = [
            context.skillOnlyContext,
            codexMayReceiveMemory() ? context.memory.text : "",
          ]
            .filter(Boolean)
            .join("\n\n");

          const result = await chatWithCodex({
            input,
            agent,
            context: codexContext,
            policyText: context.policyText,
            policy: context.policy,
            executionRequested: true,
            signal: options?.signal,
          });

          if (result.executionStatus !== "completed") {
            const detail =
              result.executionStatus === "blocked"
                ? "Codex reported that execution was blocked."
                : result.executionStatus === "failed"
                  ? "Codex reported that execution failed."
                  : "Codex did not provide a verified execution completion marker.";
            emitLiveProviderUnavailable(selected, "codex", detail, options);
            return blocked(result.message || detail, detail);
          }
          emitLiveProviderComplete(selected, "codex", options);

          return {
            ok: true,
            agent: selected,
            agentName: agent.name,
            state: "completed",
            message: result.message,
            requiresApproval: false,
            brain: {
              provider: "codex",
              execution: "executed",
              requestedMode: "execute",
              route,
              visualNodes: route.map(visualNodeForAgent),
              events: providerEvents(selected, "codex", context),
              ...envelopeContext(context),
            },
          };
        } catch (error) {
          options?.signal?.throwIfAborted();
          const detail = `Codex: ${error instanceof Error ? error.message : "execution failed"}`;
          failures.push(detail);
          emitLiveProviderUnavailable(selected, "codex", detail, options);
        }
      }
    }

    if (preferredProvider === "auto") {
      emitLiveProviderStart(selected, "hermes", options);
      try {
      const result = await chatWithHermes({
        input,
        agent,
        context: context.localContext,
        policyText: [
          context.policyText,
          "EXECUTION MODE: perform the requested task with real Hermes tools when available and permitted. Do not merely describe an action. Do not claim completion unless the tool actually completed it.",
        ].join("\n"),
        signal: options?.signal,
      });
      emitLiveProviderComplete(selected, "hermes", options);

      return {
        ok: true,
        agent: selected,
        agentName: agent.name,
        state: "completed",
        message: result.message,
        requiresApproval: false,
        brain: {
          provider: "hermes",
          execution: "executed",
          requestedMode: "execute",
          route,
          visualNodes: route.map(visualNodeForAgent),
          events: providerEvents(selected, "hermes", context),
          ...envelopeContext(context),
        },
      };
      } catch (error) {
        options?.signal?.throwIfAborted();
        const detail = `Hermes: ${error instanceof Error ? error.message : "unavailable"}`;
        failures.push(detail);
        emitLiveProviderUnavailable(selected, "hermes", detail, options);
      }
    }

    return blocked(
      "ASTRA tidak menemukan executor yang dapat menjalankan tugas ini. Untuk tugas repo/file lokal, aktifkan Codex workspace-write. Untuk aksi aplikasi/email/web eksternal, sambungkan Hermes + tools/MCP dan izinkan aksi yang diperlukan.",
      failures.join(" | ") || "No execution-capable provider is available.",
    );
  }

  async cancel() {
    // Provider calls are request-scoped. Client AbortController cancels the HTTP turn.
    // Codex child processes are terminated by their own timeout/completion lifecycle.
  }

  async status(): Promise<AstraBrainStatus> {
    const policy = getPermissionPolicy();
    const [
      hermes,
      ollama,
      codex,
      cloud,
      memory,
      skills,
      toolRuntime,
    ] = await Promise.all([
      getHermesStatus(),
      getOllamaStatus(),
      getCodexStatus(policy),
      getCloudStatus(policy),
      getUnifiedMemoryContext("ASTRA status"),
      getSkillContext("chief_of_staff"),
      createDefaultToolRuntime().catch(() => astraNativeToolRuntime),
    ]);

    const features: NonNullable<AstraBrainStatus["features"]> = {
      memory: {
        enabled: memory.enabled,
        available: memory.available,
        detail: memory.detail,
        endpoint: memory.source,
      },
      skills: {
        enabled: skills.enabled,
        available: skills.available,
        detail: skills.detail,
      },
      codex: {
        enabled: codex.enabled,
        available: codex.available,
        detail: codex.detail,
        endpoint: codex.endpoint,
        model: codex.model ?? undefined,
      },
      research: {
        enabled: true,
        available:
          toolRuntime.get("research.web")?.availability === "READY",
        state:
          toolRuntime.get("research.web")?.availability ?? "NOT_CONFIGURED",
        detail:
          "research.web=" +
          (toolRuntime.get("research.web")?.availability ?? "NOT_CONFIGURED") +
          ", research.search=" +
          (toolRuntime.get("research.search")?.availability ?? "NOT_CONFIGURED") +
          ", browser.fetch=" +
          (toolRuntime.get("browser.fetch")?.availability ?? "OFFLINE") +
          ". Full source-backed search requires a READY research transport; explicit public-URL fetch remains separately available when browser.fetch is READY.",
      },
      business: {
        enabled: true,
        available:
          (hermes.available || ollama.available || (cloud.enabled && cloud.available)) &&
          toolRuntime.get("business.finance.metrics")?.availability === "READY" &&
          toolRuntime.get("analytics.summary")?.availability === "READY",
        state:
          hermes.available || ollama.available || (cloud.enabled && cloud.available)
            ? toolRuntime.get("business.finance.metrics")?.availability === "READY" &&
              toolRuntime.get("analytics.summary")?.availability === "READY"
              ? "READY"
              : "ERROR"
            : "OFFLINE",
        detail:
          "Business specialist reasoning=" +
          (hermes.available || ollama.available || (cloud.enabled && cloud.available)
            ? "READY"
            : "OFFLINE") +
          ", finance=" +
          (toolRuntime.get("business.finance.metrics")?.availability ?? "OFFLINE") +
          ", analytics=" +
          (toolRuntime.get("analytics.summary")?.availability ?? "OFFLINE") +
          ". Sales/Marketing/Ops/Editor are analysis/drafting skills only; external CRM/send/publish actions remain separate integrations.",
      },
      integrations: {
        enabled: true,
        available: [
          "crm.search",
          "calendar.list",
          "email.search",
          "drive.search",
        ].some(
          (id) => toolRuntime.get(id)?.availability === "READY",
        ),
        state: [
          "crm.search",
          "calendar.list",
          "email.search",
          "drive.search",
        ].some(
          (id) => toolRuntime.get(id)?.availability === "READY",
        )
          ? "READY"
          : "NOT_CONFIGURED",
        detail:
          "CRM=" +
          (toolRuntime.get("crm.search")?.availability ?? "NOT_CONFIGURED") +
          ", Calendar=" +
          (toolRuntime.get("calendar.list")?.availability ?? "NOT_CONFIGURED") +
          ", Email=" +
          (toolRuntime.get("email.search")?.availability ?? "NOT_CONFIGURED") +
          ", Drive=" +
          (toolRuntime.get("drive.search")?.availability ?? "NOT_CONFIGURED") +
          ". Read capabilities are Level 1. Account/cloud mutations remain Level 3 external actions with scoped approval.",
      },
      creative: {
        enabled: true,
        available:
          toolRuntime.get("design.image.generate")?.availability === "READY" ||
          toolRuntime.get("design.image.edit")?.availability === "READY" ||
          toolRuntime.get("social.publish")?.availability === "READY" ||
          toolRuntime.get("social.schedule")?.availability === "READY",
        state:
          toolRuntime.get("design.image.generate")?.availability === "READY" ||
          toolRuntime.get("design.image.edit")?.availability === "READY" ||
          toolRuntime.get("social.publish")?.availability === "READY" ||
          toolRuntime.get("social.schedule")?.availability === "READY"
            ? "READY"
            : "NOT_CONFIGURED",
        detail:
          "Design generate=" +
          (toolRuntime.get("design.image.generate")?.availability ?? "NOT_CONFIGURED") +
          ", edit=" +
          (toolRuntime.get("design.image.edit")?.availability ?? "NOT_CONFIGURED") +
          ", social publish=" +
          (toolRuntime.get("social.publish")?.availability ?? "NOT_CONFIGURED") +
          ", schedule=" +
          (toolRuntime.get("social.schedule")?.availability ?? "NOT_CONFIGURED") +
          ". Social drafting/Design briefing are reasoning skills; generation/edit/publish/schedule require a real provider and Level-3 approval.",
      },
      computer: {
        enabled: true,
        available:
          toolRuntime.get("computer.process.list")?.availability === "READY" ||
          toolRuntime.get("computer.app.launch")?.availability === "READY",
        state:
          toolRuntime.get("computer.process.list")?.availability === "READY" ||
          toolRuntime.get("computer.app.launch")?.availability === "READY"
            ? "READY"
            : toolRuntime.get("computer.process.list")?.availability === "OFFLINE"
              ? "OFFLINE"
              : "NOT_CONFIGURED",
        detail:
          "Computer process list=" +
          (toolRuntime.get("computer.process.list")?.availability ?? "NOT_CONFIGURED") +
          ", app launch=" +
          (toolRuntime.get("computer.app.launch")?.availability ?? "NOT_CONFIGURED") +
          ". Computer Agent is OFF by default, accepts no arbitrary command string, and app launch is restricted to a fixed allowlist.",
      },
      multimodal: {
        enabled: true,
        available: true,
        state: "READY",
        detail:
          "Text input envelope=READY, voice transcript metadata=READY, gesture/camera control metadata=READY (local control only). Camera pixels, image payloads, and screen payloads are NOT_CONFIGURED and are never inferred from metadata.",
      },
      tools: {
        enabled: true,
        available:
          toolRuntime
            .list()
            .some((tool) => tool.availability === "READY") ||
          hermes.available ||
          (codex.available && codex.sandbox !== "read-only"),
        detail:
          toolRuntime
            .list()
            .filter((tool) => tool.availability === "READY").length +
          " tool(s) READY. GitHub push=" +
          (toolRuntime.get("github.push")?.availability ?? "NOT_CONFIGURED") +
          ", PR=" +
          (toolRuntime.get("github.pull-request.open")?.availability ?? "NOT_CONFIGURED") +
          ", CI=" +
          (toolRuntime.get("github.ci.status")?.availability ?? "NOT_CONFIGURED") +
          ". " +
          toolsPolicyDetail(policy) +
          " Codex sandbox: " +
          codex.sandbox +
          ". MCP transport remains explicit/injected only.",
      },
      cloud: {
        enabled: cloud.enabled,
        available: cloud.available,
        detail: cloud.detail,
        endpoint: cloud.endpoint,
        model: cloud.model ?? undefined,
      },
    };

    const toolState = (id: string): AstraCapabilityState => {
      const availability = toolRuntime.get(id)?.availability;
      if (availability === "READY") return "READY";
      if (availability === "OFFLINE") return "OFFLINE";
      if (availability === "ERROR") return "ERROR";
      return "NOT_CONFIGURED";
    };
    const reasoningReady =
      hermes.available ||
      ollama.available ||
      (cloud.enabled && cloud.available);
    const businessState: AstraCapabilityState = reasoningReady
      ? "READY"
      : "OFFLINE";
    const businessDetail =
      "Business reasoning=" +
      (reasoningReady ? "READY" : "OFFLINE") +
      "; deterministic finance=" +
      toolState("business.finance.metrics") +
      "; analytics=" +
      toolState("analytics.summary") +
      ".";
    const integrationDetail = (id: string, label: string) =>
      label + "=" + toolState(id) + ".";

    const capabilities: Partial<
      Record<
        AstraCapabilityNodeKey,
        { state: AstraCapabilityState; detail: string }
      >
    > = {
      chief_of_staff: {
        state: "READY",
        detail:
          "Core router, provider coordination, approval gates and final response routing are available.",
      },
      memory: {
        state: memory.available
          ? "READY"
          : memory.enabled
            ? "OFFLINE"
            : "NOT_CONFIGURED",
        detail: memory.detail,
      },
      strategist: {
        state: ollama.available ? "READY" : "OFFLINE",
        detail: ollama.available
          ? "Strategist planner can use the configured local Ollama model."
          : "Strategist planning requires the local Ollama planner provider.",
      },
      researcher: {
        state: toolState("research.web"),
        detail: features.research.detail,
      },
      finance: { state: businessState, detail: businessDetail },
      editor: { state: businessState, detail: businessDetail },
      sales: { state: businessState, detail: businessDetail },
      marketing: { state: businessState, detail: businessDetail },
      ops: { state: businessState, detail: businessDetail },
      social_media: {
        state: businessState,
        detail:
          businessDetail +
          " Social drafting is reasoning-only; publishing remains a separate approved tool.",
      },
      engineering: {
        state: "NOT_CONFIGURED",
        detail:
          "No separate Engineering specialist contract is registered yet. Developer/Codex remains a distinct node.",
      },
      design: {
        state:
          reasoningReady ||
          toolState("design.image.generate") === "READY" ||
          toolState("design.image.edit") === "READY"
            ? "READY"
            : "NOT_CONFIGURED",
        detail:
          "Design brief reasoning=" +
          (reasoningReady ? "READY" : "OFFLINE") +
          "; generate=" +
          toolState("design.image.generate") +
          "; edit=" +
          toolState("design.image.edit") +
          ".",
      },
      developer: {
        state: codex.available
          ? "READY"
          : codex.enabled
            ? "OFFLINE"
            : "NOT_CONFIGURED",
        detail: codex.detail,
      },
      analytics: { state: businessState, detail: businessDetail },
      crm: {
        state: toolState("crm.search"),
        detail: integrationDetail("crm.search", "CRM search"),
      },
      calendar: {
        state: toolState("calendar.list"),
        detail: integrationDetail("calendar.list", "Calendar read"),
      },
      email: {
        state: toolState("email.search"),
        detail: integrationDetail("email.search", "Email search"),
      },
      drive: {
        state:
          toolState("project.file.read") === "READY"
            ? "READY"
            : toolState("drive.search"),
        detail:
          "Local registered-file read=" +
          toolState("project.file.read") +
          "; cloud Drive search=" +
          toolState("drive.search") +
          "; upload=" +
          toolState("drive.upload") +
          ".",
      },
    };

    if (hermes.available) {
      return {
        ready: true,
        provider: "hermes",
        mode: "local",
        endpoint: hermes.endpoint,
        model: hermes.model,
        fallback: "ollama",
        detail:
          "ASTRA Brain is connected to Hermes. Ollama is the local fallback; Codex is available for engineering when configured.",
        permissions: policy,
        capabilities,
        features,
      };
    }

    if (ollama.available) {
      return {
        ready: true,
        provider: "ollama",
        mode: "local",
        endpoint: ollama.endpoint,
        model: ollama.model ?? undefined,
        fallback: "routing_only",
        detail: `${hermes.detail} ASTRA is using local Ollama model ${ollama.model}.`,
        permissions: policy,
        capabilities,
        features,
      };
    }

    return {
      ready: true,
      provider: "routing_only",
      mode: "routing_only",
      endpoint: ollama.endpoint,
      model: ollama.model ?? undefined,
      fallback: "routing_only",
      detail: `${hermes.detail} ${ollama.detail} ASTRA is using routing-only fallback. Engineering requests can still use Codex when the local CLI is available.`,
      permissions: policy,
      capabilities,
      features,
    };
  }
}

export const astraBrain: AstraBrain = new LocalPreferredBrainAdapter();
