import type { AstraBrainEvent, AstraBrainStatus } from "./types";
export type NodeState = "ready" | "running" | "completed" | "error" | "unavailable";
export function graphStates(events: AstraBrainEvent[], status: AstraBrainStatus | null): Record<string, NodeState> {
  const states: Record<string, NodeState> = { chief_of_staff: status ? "ready" : "unavailable", memory: status ? "ready" : "unavailable", drive: status?.tools.length ? "ready" : "unavailable" };
  if (status?.providers.some(p => p.provider === "codex" && p.available)) states.engineering = "ready";
  const id = events.at(-1)?.requestId;
  for (const event of events.filter(e => e.requestId === id)) {
    const node = event.visualNode || "chief_of_staff";
    if (["agent.started", "tool.started", "request.received"].includes(event.type)) states[node] = "running";
    if (["agent.completed", "tool.completed", "memory.saved", "memory.retrieved"].includes(event.type)) states[node] = "completed";
    if (["agent.error", "agent.blocked", "tool.error", "approval.required"].includes(event.type)) states[node] = "error";
    if (["response.ready", "request.cancelled", "approval.required"].includes(event.type)) {
      for (const key of Object.keys(states)) if (states[key] === "running") states[key] = event.type === "response.ready" ? "completed" : "ready";
    }
  }
  return states;
}
