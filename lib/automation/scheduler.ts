import type { AstraPermissionLevel } from "@/lib/agent/capabilities";
import type {
  AstraAutomationDefinition,
  AstraAutomationDueState,
  AstraAutomationRunDecision,
} from "./contracts";

export const ASTRA_AUTOMATION_MIN_INTERVAL_MINUTES = 60;
export const ASTRA_AUTOMATION_MAX_INTERVAL_MINUTES = 60 * 24 * 30;
export const ASTRA_AUTOMATION_MAX_RUNTIME_MS = 30 * 60_000;

function parseIso(value: string, field: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error("Invalid automation " + field + " timestamp.");
  }
  return timestamp;
}

function iso(timestamp: number) {
  return new Date(timestamp).toISOString();
}

export function validateAutomationDefinition(
  automation: AstraAutomationDefinition,
): void {
  if (!automation.id.trim()) {
    throw new Error("Automation id is required.");
  }
  if (!automation.title.trim() || automation.title.length > 160) {
    throw new Error("Automation title must contain 1-160 characters.");
  }
  if (!automation.goal.trim() || automation.goal.length > 4000) {
    throw new Error("Automation goal must contain 1-4000 characters.");
  }

  parseIso(automation.createdAt, "createdAt");
  parseIso(automation.updatedAt, "updatedAt");
  if (automation.lastRunAt) parseIso(automation.lastRunAt, "lastRunAt");

  if (
    !Number.isInteger(automation.maxRuntimeMs) ||
    automation.maxRuntimeMs < 1_000 ||
    automation.maxRuntimeMs > ASTRA_AUTOMATION_MAX_RUNTIME_MS
  ) {
    throw new Error(
      "Automation maxRuntimeMs must be between 1000 and " +
        ASTRA_AUTOMATION_MAX_RUNTIME_MS +
        ".",
    );
  }

  if (automation.requiredPermissionLevel === 4) {
    throw new Error(
      "Level-4 high-impact actions cannot be registered for scheduled automation.",
    );
  }

  if (automation.schedule.kind === "once") {
    parseIso(automation.schedule.runAt, "schedule.runAt");
    return;
  }

  parseIso(automation.schedule.anchorAt, "schedule.anchorAt");
  if (
    !Number.isInteger(automation.schedule.everyMinutes) ||
    automation.schedule.everyMinutes < ASTRA_AUTOMATION_MIN_INTERVAL_MINUTES ||
    automation.schedule.everyMinutes > ASTRA_AUTOMATION_MAX_INTERVAL_MINUTES
  ) {
    throw new Error(
      "Automation interval must be an integer between " +
        ASTRA_AUTOMATION_MIN_INTERVAL_MINUTES +
        " and " +
        ASTRA_AUTOMATION_MAX_INTERVAL_MINUTES +
        " minutes.",
    );
  }
}

export function getAutomationDueState(
  automation: AstraAutomationDefinition,
  now = new Date(),
): AstraAutomationDueState {
  validateAutomationDefinition(automation);

  if (automation.status !== "enabled") {
    return {
      kind: "not_due",
      nextRunAt: null,
      detail: "Automation is " + automation.status + ".",
    };
  }

  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) {
    throw new Error("Invalid automation evaluation time.");
  }

  const lastRunMs = automation.lastRunAt
    ? parseIso(automation.lastRunAt, "lastRunAt")
    : null;

  if (automation.schedule.kind === "once") {
    const runAtMs = parseIso(automation.schedule.runAt, "schedule.runAt");
    if (lastRunMs !== null) {
      return {
        kind: "not_due",
        nextRunAt: null,
        detail: "One-time automation already ran.",
      };
    }
    if (nowMs < runAtMs) {
      return {
        kind: "not_due",
        nextRunAt: iso(runAtMs),
        detail: "One-time automation has not reached its scheduled time.",
      };
    }
    return {
      kind: "due",
      scheduledFor: iso(runAtMs),
      nextRunAt: null,
      detail: "One-time automation is due.",
    };
  }

  const anchorMs = parseIso(
    automation.schedule.anchorAt,
    "schedule.anchorAt",
  );
  const intervalMs = automation.schedule.everyMinutes * 60_000;

  if (nowMs < anchorMs) {
    return {
      kind: "not_due",
      nextRunAt: iso(anchorMs),
      detail: "Interval automation has not reached its anchor time.",
    };
  }

  const occurrenceIndex = Math.floor((nowMs - anchorMs) / intervalMs);
  const occurrenceMs = anchorMs + occurrenceIndex * intervalMs;

  if (lastRunMs !== null && lastRunMs >= occurrenceMs) {
    const nextMs = occurrenceMs + intervalMs;
    return {
      kind: "not_due",
      nextRunAt: iso(nextMs),
      detail: "Current interval occurrence already ran.",
    };
  }

  return {
    kind: "due",
    scheduledFor: iso(occurrenceMs),
    nextRunAt: iso(occurrenceMs + intervalMs),
    detail: "Interval automation occurrence is due.",
  };
}

export function evaluateAutomationRun(
  automation: AstraAutomationDefinition,
  options: {
    now?: Date;
    approvedPermissionLevelForRun?: AstraPermissionLevel;
  } = {},
): AstraAutomationRunDecision {
  const due = getAutomationDueState(automation, options.now);
  if (due.kind === "not_due") return due;

  const approvedPermissionLevel =
    options.approvedPermissionLevelForRun ?? 1;
  const requiredPermissionLevel = automation.requiredPermissionLevel;

  if (requiredPermissionLevel === 4) {
    return {
      kind: "blocked",
      scheduledFor: due.scheduledFor,
      requiredPermissionLevel,
      detail:
        "Level-4 high-impact work is never eligible for scheduled execution.",
    };
  }

  if (requiredPermissionLevel > approvedPermissionLevel) {
    return {
      kind: "waiting_approval",
      scheduledFor: due.scheduledFor,
      requiredPermissionLevel,
      detail:
        "Scheduled run requires permission Level-" +
        requiredPermissionLevel +
        "; this run currently has Level-" +
        approvedPermissionLevel +
        ".",
    };
  }

  return {
    kind: "ready",
    scheduledFor: due.scheduledFor,
    approvedPermissionLevel,
    detail:
      requiredPermissionLevel <= 1
        ? "Read-only scheduled run may proceed under the unattended ceiling."
        : "Scheduled run may proceed with approval scoped to this run.",
  };
}
