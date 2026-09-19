import { runAgent, selectAgent } from "@/lib/agent/orchestrator";
import { ASTRA_AGENT_MAP } from "@/lib/agent/roster";
import type { AstraAgentKey } from "@/lib/agent/types";
import { chatWithHermes, getHermesStatus } from "./hermes";
import type {
  AstraBrain,
  AstraBrainChatResult,
  AstraBrainEvent,
  AstraBrainStatus,
} from "./types";

const VISUAL_NODE_BY_AGENT: Record<AstraAgentKey, string> = {
  chief_of_staff: "chief_of_staff",
  memory: "memory",
  researcher: "researcher",
  developer: "developer",
  computer: "ops",
  files: "drive",
  github: "developer",
  communication: "email",
  business: "ops",
  trading: "finance",
};

function visualNode(agent: AstraAgentKey) {
  return VISUAL_NODE_BY_AGENT[agent];
}

function routeFor(selected: AstraAgentKey): AstraAgentKey[] {
  return selected === "chief_of_staff"
    ? ["chief_of_staff"]
    : ["chief_of_staff", selected];
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
      visualNode: visualNode(selected),
      label: "Route selected",
      detail: `Chief routed the request to ${selected}.`,
    });
  }

  return events;
}

function routingOnlyEvents(
  selected: AstraAgentKey,
  state: AstraBrainChatResult["state"],
  providerDetail?: string,
): AstraBrainEvent[] {
  const now = Date.now();
  const events = baseEvents(selected, now);

  if (providerDetail) {
    events.push({
      id: `${now}-provider-unavailable`,
      type: "provider.unavailable",
      at: now + 2,
      agent: selected,
      visualNode: visualNode(selected),
      label: "Hermes unavailable",
      detail: providerDetail,
    });
  }

  if (state === "needs_provider") {
    events.push({
      id: `${now}-blocked`,
      type: "agent.blocked",
      at: now + 3,
      agent: selected,
      visualNode: visualNode(selected),
      label: "Execution waiting",
      detail: "A model/tool provider is not available for execution.",
    });
  }

  events.push({
    id: `${now}-response`,
    type: "response.ready",
    at: now + 4,
    agent: selected,
    visualNode: visualNode(selected),
    label: "Response ready",
    detail:
      state === "needs_provider"
        ? "Routing completed; execution did not run."
        : "ASTRA completed the request.",
  });

  return events;
}

function hermesEvents(selected: AstraAgentKey): AstraBrainEvent[] {
  const now = Date.now();
  return [
    ...baseEvents(selected, now),
    {
      id: `${now}-provider`,
      type: "provider.selected",
      at: now + 2,
      agent: selected,
      visualNode: visualNode(selected),
      label: "Hermes selected",
      detail: "ASTRA Brain selected the local Hermes gateway.",
    },
    {
      id: `${now}-started`,
      type: "agent.started",
      at: now + 3,
      agent: selected,
      visualNode: visualNode(selected),
      label: "Agent started",
      detail: `${ASTRA_AGENT_MAP[selected].name} started execution through Hermes.`,
    },
    {
      id: `${now}-completed`,
      type: "agent.completed",
      at: now + 4,
      agent: selected,
      visualNode: visualNode(selected),
      label: "Agent completed",
      detail: `${ASTRA_AGENT_MAP[selected].name} completed the Hermes turn.`,
    },
    {
      id: `${now}-response`,
      type: "response.ready",
      at: now + 5,
      agent: selected,
      visualNode: visualNode(selected),
      label: "Response ready",
      detail: "Hermes returned the final response to ASTRA Runtime.",
    },
  ];
}

class RoutingOnlyBrainAdapter implements AstraBrain {
  async chat(input: string): Promise<AstraBrainChatResult> {
    const response = await runAgent(input);
    const route = routeFor(response.agent);

    return {
      ...response,
      brain: {
        provider: "routing_only",
        execution: response.state === "completed" ? "executed" : "routing_only",
        route,
        visualNodes: route.map(visualNode),
        events: routingOnlyEvents(response.agent, response.state),
      },
    };
  }

  async execute(task: { input: string }) {
    return this.chat(task.input);
  }

  async cancel() {
    // Routing-only mode has no long-running backend process to cancel.
  }

  async status(): Promise<AstraBrainStatus> {
    return {
      ready: true,
      provider: "routing_only",
      mode: "routing_only",
      detail: "ASTRA routing-only fallback is ready.",
    };
  }
}

class HermesPreferredBrainAdapter implements AstraBrain {
  private readonly fallback = new RoutingOnlyBrainAdapter();

  async chat(input: string): Promise<AstraBrainChatResult> {
    const selected = selectAgent(input);
    const agent = ASTRA_AGENT_MAP[selected];
    const route = routeFor(selected);

    try {
      const result = await chatWithHermes({ input, agent });

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
          route,
          visualNodes: route.map(visualNode),
          events: hermesEvents(selected),
        },
      };
    } catch (error) {
      const fallback = await this.fallback.chat(input);
      const detail =
        error instanceof Error
          ? error.message
          : "Hermes gateway is unavailable.";

      return {
        ...fallback,
        brain: {
          ...fallback.brain,
          events: routingOnlyEvents(
            fallback.agent,
            fallback.state,
            detail,
          ),
        },
      };
    }
  }

  async execute(task: { input: string }) {
    return this.chat(task.input);
  }

  async cancel() {
    // Phase 2 uses stateless chat/completions. Per-run stop support is planned
    // when ASTRA adopts Hermes /v1/runs lifecycle endpoints.
  }

  async status(): Promise<AstraBrainStatus> {
    const hermes = await getHermesStatus();

    if (hermes.available) {
      return {
        ready: true,
        provider: "hermes",
        mode: "local",
        endpoint: hermes.endpoint,
        model: hermes.model,
        fallback: "routing_only",
        detail:
          "ASTRA Brain is connected to the local Hermes gateway. Routing-only fallback remains available.",
      };
    }

    return {
      ready: true,
      provider: "routing_only",
      mode: "routing_only",
      endpoint: hermes.endpoint,
      model: hermes.model,
      fallback: "routing_only",
      detail: `${hermes.detail} ASTRA is using routing-only fallback.`,
    };
  }
}

export const astraBrain: AstraBrain = new HermesPreferredBrainAdapter();
