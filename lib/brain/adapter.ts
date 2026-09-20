import { runAgent, selectAgent } from "@/lib/agent/orchestrator";
import { ASTRA_AGENT_MAP } from "@/lib/agent/roster";
import { visualNodeForAgent } from "@/lib/agent/capabilities";
import type { AstraAgentKey } from "@/lib/agent/types";
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
};


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
    getSkillContext(selected),
  ]);

  const skillOnlyContext = skills.text;
  const localContext = [skills.text, memory.text].filter(Boolean).join("\n\n");

  let plan: AstraPlan | undefined;
  let plannerDetail: string | undefined;
  let tools: readonly AstraToolDefinition[] = astraNativeToolRuntime.list();

  if (shouldGeneratePlan(input)) {
    try {
      const runtime = await createDefaultToolRuntime(signal);
      tools = runtime.list();
    } catch {
      tools = astraNativeToolRuntime.list();
    }

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
    events.push({
      id: `${now}-skills`,
      type: "skill.selected",
      at: now + offset,
      agent: selected,
      visualNode: visualNodeForAgent(selected),
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
    const context = await buildExecutionContext(input, response.agent, options?.signal);
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
    task: { input: string; approved?: boolean },
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
    const fallback = await this.fallback.chat(input);
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
    task: { input: string; approved?: boolean },
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
    );
    emitLiveContext(selected, context, options);
    const failures: string[] = [];
    const preferredProvider = options?.provider ?? "auto";

    const blocked = (
      message: string,
      detail: string,
      requiresApproval = false,
    ): AstraBrainChatResult => {
      emitLiveBlocked(selected, detail, options);
      return {
        ok: false,
        agent: selected,
        agentName: agent.name,
        state: "blocked",
        message,
        requiresApproval,
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

    if (context.policy.requireApproval && !task.approved) {
      return blocked(
        "ASTRA siap menjalankan tugas ini, tetapi eksekusi membutuhkan approval eksplisit. Gunakan EXECUTE TASK untuk menyetujui eksekusi.",
        "Execution mode requested without explicit user approval.",
        true,
      );
    }

    if (context.plan) {
      const maxPermission = Math.max(
        ...context.plan.steps.map((step) => step.permissionLevel),
      );

      if (preferredProvider === "ollama" && maxPermission > 1) {
        return blocked(
          "Plan ini memiliki langkah aksi nyata. Ollama hanya dapat menjalankan reasoning/read-only; gunakan Auto atau Codex untuk langkah aksi.",
          "Explicit Ollama mode cannot execute plan steps above permission level 1.",
        );
      }

      const planEvents: AstraBrainEvent[] = [];
      const result = await executeBrainPlan({
        plan: context.plan,
        project: context.project.match?.project,
        baseContext: context.localContext,
        policy: context.policy,
        providerChoice: preferredProvider,
        approvedPermissionLevel:
          context.policy.requireApproval && !task.approved ? 1 : 2,
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
      features,
    };
  }
}

export const astraBrain: AstraBrain = new LocalPreferredBrainAdapter();
