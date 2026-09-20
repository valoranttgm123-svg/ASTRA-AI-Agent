import type { AstraBrainEvent } from "@/lib/brain/types";
import type { AstraAutomationLifecycleEvent } from "./queue";

const LABELS: Record<
  AstraAutomationLifecycleEvent["type"],
  string
> = {
  "automation.due": "Automation due",
  "automation.waiting_approval": "Automation waiting approval",
  "automation.claimed": "Automation claimed",
  "automation.started": "Automation started",
  "automation.completed": "Automation completed",
  "automation.failed": "Automation failed",
  "automation.cancelled": "Automation cancelled",
};

export function automationEventToBrainEvent(
  event: AstraAutomationLifecycleEvent,
): AstraBrainEvent {
  const at = Date.parse(event.at);
  if (!Number.isFinite(at)) {
    throw new Error("Automation lifecycle event has an invalid timestamp.");
  }

  return {
    id:
      "automation:" +
      event.automationId +
      ":" +
      event.type +
      ":" +
      event.scheduledFor +
      ":" +
      event.at,
    type: event.type,
    at,
    agent: "business",
    visualNode: "ops",
    label: LABELS[event.type],
    detail: event.detail,
  };
}
