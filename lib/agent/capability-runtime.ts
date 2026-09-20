import type {
  AstraBrainEvent,
  AstraBrainStatus,
} from "@/lib/brain/types";
import {
  ASTRA_CAPABILITY_MAP,
  ASTRA_CAPABILITY_NODES,
  type AstraCapabilityNodeKey,
  type AstraCapabilityState,
  visualNodeForAgent,
} from "./capabilities";

export type AstraCapabilityRuntimeView = {
  state: AstraCapabilityState;
  detail: string;
  lastEventType?: AstraBrainEvent["type"];
  lastEventAt?: number;
};

export type AstraCapabilityRuntimeMap = Record<
  AstraCapabilityNodeKey,
  AstraCapabilityRuntimeView
>;

function isNodeKey(value: string): value is AstraCapabilityNodeKey {
  return Object.prototype.hasOwnProperty.call(ASTRA_CAPABILITY_MAP, value);
}

function eventNode(
  event: AstraBrainEvent,
): AstraCapabilityNodeKey | undefined {
  if (event.visualNode && isNodeKey(event.visualNode)) {
    return event.visualNode;
  }
  return event.agent ? visualNodeForAgent(event.agent) : undefined;
}

function baseRuntimeMap(
  status?: AstraBrainStatus | null,
): AstraCapabilityRuntimeMap {
  return Object.fromEntries(
    ASTRA_CAPABILITY_NODES.map((node) => {
      const runtime = status?.capabilities?.[node.key];
      return [
        node.key,
        {
          state: runtime?.state ?? node.defaultState,
          detail:
            runtime?.detail ??
            (node.requiresConfiguration
              ? "No live runtime capability snapshot is available yet."
              : node.role),
        },
      ];
    }),
  ) as AstraCapabilityRuntimeMap;
}

function resetToBase(
  current: AstraCapabilityRuntimeMap,
  base: AstraCapabilityRuntimeMap,
) {
  for (const node of ASTRA_CAPABILITY_NODES) {
    current[node.key] = { ...base[node.key] };
  }
}

function setEventState(
  current: AstraCapabilityRuntimeMap,
  event: AstraBrainEvent,
  state: AstraCapabilityState,
) {
  const node = eventNode(event);
  if (!node) return;

  current[node] = {
    state,
    detail: event.detail || event.label,
    lastEventType: event.type,
    lastEventAt: event.at,
  };
}

export function deriveCapabilityRuntimeMap(
  status: AstraBrainStatus | null | undefined,
  events: readonly AstraBrainEvent[],
): AstraCapabilityRuntimeMap {
  const base = baseRuntimeMap(status);
  const current = Object.fromEntries(
    Object.entries(base).map(([key, value]) => [key, { ...value }]),
  ) as AstraCapabilityRuntimeMap;

  const ordered = [...events].sort((a, b) => a.at - b.at);

  for (const event of ordered) {
    switch (event.type) {
      case "request.received":
        current.chief_of_staff = {
          state: "ACTIVE",
          detail: event.detail || event.label,
          lastEventType: event.type,
          lastEventAt: event.at,
        };
        break;
      case "router.selected":
      case "plan.created":
      case "plan.step.started":
      case "plan.step.progress":
      case "tool.started":
      case "tool.progress":
      case "memory.search.started":
      case "memory.source.queried":
      case "memory.graph.matched":
      case "memory.context.selected":
      case "skill.selected":
      case "provider.selected":
      case "agent.started":
        setEventState(current, event, "ACTIVE");
        break;
      case "approval.requested":
        setEventState(current, event, "WAITING_APPROVAL");
        break;
      case "agent.blocked":
      case "plan.cancelled":
        setEventState(current, event, "BLOCKED");
        break;
      case "plan.step.failed":
      case "tool.failed":
        setEventState(current, event, "ERROR");
        break;
      case "approval.granted":
        setEventState(current, event, "ACTIVE");
        break;
      case "plan.step.completed":
      case "tool.completed":
      case "agent.completed": {
        const node = eventNode(event);
        if (node) current[node] = { ...base[node] };
        break;
      }
      case "plan.completed":
      case "response.ready":
        resetToBase(current, base);
        break;
      case "provider.unavailable":
        // Provider failure can be followed by a successful fallback. Keep the
        // truthful base node state and let a later agent.blocked/error event
        // describe terminal failure.
        break;
      default:
        break;
    }
  }

  return current;
}

export function capabilityStateIsLive(
  state: AstraCapabilityState,
): boolean {
  return (
    state === "READY" ||
    state === "ACTIVE" ||
    state === "WAITING_APPROVAL"
  );
}
