import { runAgent } from "@/lib/agent/orchestrator";
import type { AstraAgentKey } from "@/lib/agent/types";
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

function buildEvents(
  selected: AstraAgentKey,
  state: AstraBrainChatResult["state"],
): AstraBrainEvent[] {
  const now = Date.now();
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

  if (state === "needs_provider") {
    events.push({
      id: `${now}-blocked`,
      type: "agent.blocked",
      at: now + 2,
      agent: selected,
      visualNode: visualNode(selected),
      label: "Execution waiting",
      detail: "A model/tool provider is not configured for execution yet.",
    });
  }

  events.push({
    id: `${now}-response`,
    type: "response.ready",
    at: now + 3,
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

class RoutingOnlyBrainAdapter implements AstraBrain {
  async chat(input: string): Promise<AstraBrainChatResult> {
    const response = await runAgent(input);
    const route: AstraAgentKey[] =
      response.agent === "chief_of_staff"
        ? ["chief_of_staff"]
        : ["chief_of_staff", response.agent];

    const events = buildEvents(response.agent, response.state);

    return {
      ...response,
      brain: {
        provider: "routing_only",
        execution: response.state === "completed" ? "executed" : "routing_only",
        route,
        visualNodes: route.map(visualNode),
        events,
      },
    };
  }

  async execute(task: { input: string }) {
    return this.chat(task.input);
  }

  async cancel() {
    // Phase 1 has no long-running backend process to cancel.
  }

  async status(): Promise<AstraBrainStatus> {
    return {
      ready: true,
      provider: "routing_only",
      mode: "routing_only",
      detail:
        "ASTRA Brain Adapter is active. Hermes/Ollama/Codex execution providers are not connected yet.",
    };
  }
}

export const astraBrain: AstraBrain = new RoutingOnlyBrainAdapter();
