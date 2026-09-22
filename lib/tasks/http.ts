import type { AstraPermissionLevel } from "@/lib/agent/capabilities";
import { ASTRA_AGENT_MAP } from "@/lib/agent/roster";
import type { AstraAgentKey } from "@/lib/agent/types";
import type { AstraTaskUpsertInput } from "./management";

export type AstraTaskMutation =
  | { action: "upsert"; task: AstraTaskUpsertInput }
  | { action: "resume"; id: string }
  | { action: "pause"; id: string }
  | { action: "cancel"; id: string }
  | { action: "delete"; id: string };

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(field + " must be an object.");
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string, max: number) {
  if (typeof value !== "string") {
    throw new Error(field + " must be a string.");
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) {
    throw new Error(field + " must contain 1-" + max + " characters.");
  }
  return cleaned;
}

function optionalString(value: unknown, field: string, max: number) {
  if (value === undefined || value === null || value === "") return undefined;
  return string(value, field, max);
}

function integer(
  value: unknown,
  field: string,
  min: number,
  max: number,
) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(
      field + " must be an integer between " + min + " and " + max + ".",
    );
  }
  return value;
}

function permission(value: unknown): AstraPermissionLevel {
  if (value === 0 || value === 1 || value === 2 || value === 3) {
    return value;
  }
  throw new Error(
    "requiredPermissionLevel must be 0, 1, 2, or 3. Level 4 is unavailable.",
  );
}

function agent(value: unknown): AstraAgentKey {
  if (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ASTRA_AGENT_MAP, value)
  ) {
    return value as AstraAgentKey;
  }
  throw new Error("task.agent is invalid.");
}

function stringList(
  value: unknown,
  field: string,
  maxItems: number,
  maxLength: number,
) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(field + " is invalid.");
  }
  const result = value.map((entry) =>
    string(entry, field, maxLength),
  );
  if (
    new Set(result.map((entry) => entry.toLowerCase())).size !==
    result.length
  ) {
    throw new Error(field + " contains duplicates.");
  }
  return result;
}

export function parseTaskMutation(
  body: Record<string, unknown>,
): AstraTaskMutation {
  if (body.action === "upsert") {
    const entry = object(body.task, "task");
    return {
      action: "upsert",
      task: {
        id: string(entry.id, "task.id", 120),
        title: string(entry.title, "task.title", 200),
        goal: string(entry.goal, "task.goal", 6000),
        agent: agent(entry.agent),
        projectId: optionalString(entry.projectId, "task.projectId", 120),
        priority: integer(entry.priority, "task.priority", 0, 4),
        requiredPermissionLevel: permission(
          entry.requiredPermissionLevel,
        ),
        maxRuntimeMs: integer(
          entry.maxRuntimeMs,
          "task.maxRuntimeMs",
          1,
          60 * 60_000,
        ),
        maxAttempts: integer(
          entry.maxAttempts,
          "task.maxAttempts",
          1,
          8,
        ),
        retryBackoffMs: integer(
          entry.retryBackoffMs,
          "task.retryBackoffMs",
          1,
          24 * 60 * 60_000,
        ),
        dependencies: stringList(
          entry.dependencies,
          "task.dependencies",
          32,
          120,
        ),
        resourceLocks: stringList(
          entry.resourceLocks,
          "task.resourceLocks",
          32,
          200,
        ),
      },
    };
  }

  if (
    body.action === "resume" ||
    body.action === "pause" ||
    body.action === "cancel" ||
    body.action === "delete"
  ) {
    return {
      action: body.action,
      id: string(body.id, "id", 120),
    };
  }

  throw new Error("Background task action is invalid.");
}
