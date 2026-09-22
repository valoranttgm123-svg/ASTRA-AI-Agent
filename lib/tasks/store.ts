import {
  lstat,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type { AstraPermissionLevel } from "@/lib/agent/capabilities";
import { ASTRA_AGENT_MAP } from "@/lib/agent/roster";
import type { AstraAgentKey } from "@/lib/agent/types";
import type {
  AstraBackgroundTask,
  AstraBackgroundTaskStatus,
  AstraTaskCheckpoint,
  AstraTaskStore,
} from "./contracts";
import { assertAcyclicTaskGraph } from "./scheduler";

export const ASTRA_TASK_MAX_ENTRIES = 256;
export const ASTRA_TASK_MAX_FILE_BYTES = 2 * 1024 * 1024;

let taskMutationTail: Promise<void> = Promise.resolve();

async function withTaskMutationLock<T>(run: () => Promise<T>) {
  const previous = taskMutationTail;
  let release!: () => void;
  taskMutationTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await run();
  } finally {
    release();
  }
}

export function getTaskStorePath() {
  const configured = process.env.ASTRA_TASK_FILE?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".astra", "tasks.json");
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Background task " + field + " must be an object.");
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string, max: number) {
  if (typeof value !== "string") {
    throw new Error("Background task " + field + " must be a string.");
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) {
    throw new Error(
      "Background task " +
        field +
        " must contain 1-" +
        max +
        " characters.",
    );
  }
  return cleaned;
}

function optionalString(value: unknown, field: string, max: number) {
  if (value === undefined) return undefined;
  return string(value, field, max);
}

function iso(value: unknown, field: string) {
  const raw = string(value, field, 80);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error("Background task " + field + " must be a timestamp.");
  }
  return new Date(parsed).toISOString();
}

function nonNegativeInteger(
  value: unknown,
  field: string,
  max: number,
) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > max
  ) {
    throw new Error(
      "Background task " +
        field +
        " must be an integer between 0 and " +
        max +
        ".",
    );
  }
  return value;
}

function positiveInteger(
  value: unknown,
  field: string,
  max: number,
) {
  const parsed = nonNegativeInteger(value, field, max);
  if (parsed < 1) {
    throw new Error("Background task " + field + " must be at least 1.");
  }
  return parsed;
}

function status(value: unknown): AstraBackgroundTaskStatus {
  if (
    value === "queued" ||
    value === "running" ||
    value === "paused" ||
    value === "retry_wait" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "cancelled"
  ) {
    return value;
  }
  throw new Error("Background task status is invalid.");
}

function permission(value: unknown): AstraPermissionLevel {
  if (value === 0 || value === 1 || value === 2 || value === 3) {
    return value;
  }
  throw new Error(
    "Background task requiredPermissionLevel must be 0, 1, 2, or 3. Level 4 is unavailable.",
  );
}

function agent(value: unknown): AstraAgentKey {
  if (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ASTRA_AGENT_MAP, value)
  ) {
    return value as AstraAgentKey;
  }
  throw new Error("Background task agent is invalid.");
}

function stringList(
  value: unknown,
  field: string,
  maxItems: number,
  maxLength: number,
) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(
      "Background task " +
        field +
        " must be an array with at most " +
        maxItems +
        " entries.",
    );
  }
  const result = value.map((entry) =>
    string(entry, field, maxLength),
  );
  const lowered = result.map((entry) => entry.toLowerCase());
  if (new Set(lowered).size !== lowered.length) {
    throw new Error("Background task " + field + " contains duplicates.");
  }
  return result;
}

function checkpoint(value: unknown): AstraTaskCheckpoint | undefined {
  if (value === undefined) return undefined;
  const entry = record(value, "checkpoint");
  return {
    sequence: nonNegativeInteger(
      entry.sequence,
      "checkpoint.sequence",
      1_000_000,
    ),
    summary: string(entry.summary, "checkpoint.summary", 4000),
    updatedAt: iso(entry.updatedAt, "checkpoint.updatedAt"),
  };
}

function normalizeTask(
  value: unknown,
  index: number,
): AstraBackgroundTask {
  const entry = record(value, "entry " + (index + 1));
  const id = string(entry.id, "id", 120);
  const dependencies = stringList(
    entry.dependencies,
    "dependencies",
    32,
    120,
  );
  if (
    dependencies.some(
      (dependency) => dependency.toLowerCase() === id.toLowerCase(),
    )
  ) {
    throw new Error("Background task cannot depend on itself.");
  }

  return {
    id,
    title: string(entry.title, "title", 200),
    goal: string(entry.goal, "goal", 6000),
    agent: agent(entry.agent),
    projectId: optionalString(entry.projectId, "projectId", 120),
    priority: nonNegativeInteger(entry.priority, "priority", 4),
    requiredPermissionLevel: permission(entry.requiredPermissionLevel),
    maxRuntimeMs: positiveInteger(
      entry.maxRuntimeMs,
      "maxRuntimeMs",
      60 * 60_000,
    ),
    maxAttempts: positiveInteger(entry.maxAttempts, "maxAttempts", 8),
    retryBackoffMs: positiveInteger(
      entry.retryBackoffMs,
      "retryBackoffMs",
      24 * 60 * 60_000,
    ),
    dependencies,
    resourceLocks: stringList(
      entry.resourceLocks,
      "resourceLocks",
      32,
      200,
    ),
    status: status(entry.status),
    attempts: nonNegativeInteger(entry.attempts, "attempts", 1000),
    createdAt: iso(entry.createdAt, "createdAt"),
    updatedAt: iso(entry.updatedAt, "updatedAt"),
    nextAttemptAt:
      entry.nextAttemptAt === undefined
        ? undefined
        : iso(entry.nextAttemptAt, "nextAttemptAt"),
    checkpoint: checkpoint(entry.checkpoint),
    lastError: optionalString(entry.lastError, "lastError", 4000),
    resultSummary: optionalString(
      entry.resultSummary,
      "resultSummary",
      8000,
    ),
  };
}

export function normalizeTaskStore(value: unknown): AstraTaskStore {
  const root = record(value, "store");
  if (root.schemaVersion !== 1) {
    throw new Error("Unsupported Background Task schemaVersion.");
  }
  if (!Array.isArray(root.tasks)) {
    throw new Error("Background task store tasks must be an array.");
  }
  if (root.tasks.length > ASTRA_TASK_MAX_ENTRIES) {
    throw new Error("Background task store entry limit exceeded.");
  }

  const tasks = root.tasks.map(normalizeTask);
  const seen = new Set<string>();
  for (const task of tasks) {
    const key = task.id.toLowerCase();
    if (seen.has(key)) {
      throw new Error("Duplicate background task id: " + task.id + ".");
    }
    seen.add(key);
  }

  assertAcyclicTaskGraph(tasks);

  return {
    schemaVersion: 1,
    tasks,
  };
}

async function rejectSymlinkTarget(source: string) {
  try {
    const info = await lstat(source);
    if (info.isSymbolicLink()) {
      throw new Error("Background task store must not be a symbolic link.");
    }
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code !== "ENOENT") throw error;
  }
}

export async function loadTaskStore() {
  const source = getTaskStorePath();
  try {
    await rejectSymlinkTarget(source);
    const info = await stat(source);
    if (info.size > ASTRA_TASK_MAX_FILE_BYTES) {
      throw new Error("Background task store exceeds its file-size limit.");
    }
    const raw = await readFile(source, "utf8");
    const store = normalizeTaskStore(JSON.parse(raw) as unknown);
    return {
      available: true,
      source,
      store,
      detail:
        "Loaded " +
        store.tasks.length +
        " durable background task" +
        (store.tasks.length === 1 ? "." : "s."),
    };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "ENOENT") {
      return {
        available: true,
        source,
        store: { schemaVersion: 1 as const, tasks: [] },
        detail:
          "Background Task Manager is ready; no private .astra/tasks.json file exists yet.",
      };
    }
    return {
      available: false,
      source,
      store: { schemaVersion: 1 as const, tasks: [] },
      detail:
        error instanceof Error
          ? "Background task store could not be loaded safely: " +
            error.message
          : "Background task store could not be loaded safely.",
    };
  }
}

export async function saveTaskStore(store: AstraTaskStore) {
  const normalized = normalizeTaskStore(
    JSON.parse(JSON.stringify(store)) as unknown,
  );
  const source = getTaskStorePath();
  const payload = JSON.stringify(normalized, null, 2) + "\n";

  if (Buffer.byteLength(payload, "utf8") > ASTRA_TASK_MAX_FILE_BYTES) {
    throw new Error("Background task store exceeds its file-size limit.");
  }

  await mkdir(path.dirname(source), { recursive: true, mode: 0o700 });
  await rejectSymlinkTarget(source);
  await writeFile(source, payload, {
    encoding: "utf8",
    mode: 0o600,
  });

  return { source, count: normalized.tasks.length };
}

export async function mutateTaskStore<T>(
  mutate: (store: AstraTaskStore) =>
    | { store: AstraTaskStore; result: T }
    | Promise<{ store: AstraTaskStore; result: T }>,
): Promise<T> {
  return withTaskMutationLock(async () => {
    const loaded = await loadTaskStore();
    if (!loaded.available) throw new Error(loaded.detail);

    const outcome = await mutate({
      schemaVersion: 1,
      tasks: [...loaded.store.tasks],
    });
    await saveTaskStore(outcome.store);
    return outcome.result;
  });
}
