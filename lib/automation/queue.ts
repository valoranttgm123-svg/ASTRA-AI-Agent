import type { AstraPermissionLevel } from "@/lib/agent/capabilities";
import type { AstraAutomationDefinition } from "./contracts";
import { evaluateAutomationRun } from "./scheduler";

export const ASTRA_AUTOMATION_MAX_READY_PER_TICK = 4;
export const ASTRA_AUTOMATION_MAX_WAITING_APPROVAL_PER_TICK = 16;

export type AstraAutomationQueueItem = {
  automationId: string;
  title: string;
  projectId?: string;
  scheduledFor: string;
  requiredPermissionLevel: AstraPermissionLevel;
};

export type AstraAutomationTickPlan = {
  at: string;
  ready: AstraAutomationQueueItem[];
  waitingApproval: AstraAutomationQueueItem[];
  deferredReadyCount: number;
  deferredWaitingApprovalCount: number;
  nextWakeAt: string | null;
};

export type AstraAutomationLifecycleEventType =
  | "automation.due"
  | "automation.waiting_approval"
  | "automation.claimed"
  | "automation.started"
  | "automation.completed"
  | "automation.failed"
  | "automation.cancelled";

export type AstraAutomationLifecycleEvent = {
  type: AstraAutomationLifecycleEventType;
  automationId: string;
  at: string;
  scheduledFor: string;
  detail: string;
};

function byScheduleThenId(
  a: AstraAutomationQueueItem,
  b: AstraAutomationQueueItem,
) {
  return (
    Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor) ||
    a.automationId.localeCompare(b.automationId)
  );
}

function earlierIso(current: string | null, candidate: string | null) {
  if (!candidate) return current;
  if (!current) return candidate;
  return Date.parse(candidate) < Date.parse(current)
    ? candidate
    : current;
}

export function planAutomationTick(
  automations: readonly AstraAutomationDefinition[],
  now = new Date(),
): AstraAutomationTickPlan {
  const ready: AstraAutomationQueueItem[] = [];
  const waitingApproval: AstraAutomationQueueItem[] = [];
  let nextWakeAt: string | null = null;

  for (const automation of automations) {
    const decision = evaluateAutomationRun(automation, { now });

    if (decision.kind === "not_due") {
      nextWakeAt = earlierIso(nextWakeAt, decision.nextRunAt);
      continue;
    }

    if (decision.kind === "blocked") {
      throw new Error(
        "Blocked automation reached queue planning: " + automation.id + ".",
      );
    }

    const item: AstraAutomationQueueItem = {
      automationId: automation.id,
      title: automation.title,
      projectId: automation.projectId,
      scheduledFor: decision.scheduledFor,
      requiredPermissionLevel: automation.requiredPermissionLevel,
    };

    if (decision.kind === "waiting_approval") {
      waitingApproval.push(item);
    } else {
      ready.push(item);
    }
  }

  ready.sort(byScheduleThenId);
  waitingApproval.sort(byScheduleThenId);

  const selectedReady = ready.slice(0, ASTRA_AUTOMATION_MAX_READY_PER_TICK);
  const selectedWaiting = waitingApproval.slice(
    0,
    ASTRA_AUTOMATION_MAX_WAITING_APPROVAL_PER_TICK,
  );

  return {
    at: now.toISOString(),
    ready: selectedReady,
    waitingApproval: selectedWaiting,
    deferredReadyCount: Math.max(0, ready.length - selectedReady.length),
    deferredWaitingApprovalCount: Math.max(
      0,
      waitingApproval.length - selectedWaiting.length,
    ),
    nextWakeAt,
  };
}
