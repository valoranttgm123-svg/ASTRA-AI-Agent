import type { AstraPermissionLevel } from "@/lib/agent/capabilities";
import type { AstraAgentKey } from "@/lib/agent/types";
import type {
  AstraBackgroundTask,
  AstraBackgroundTaskStatus,
} from "./contracts";
import {
  isTaskActive,
  stopActiveTask,
} from "./runtime";
import { mutateTaskStore } from "./store";

export type AstraTaskUpsertInput = {
  id: string;
  title: string;
  goal: string;
  agent: AstraAgentKey;
  projectId?: string;
  priority: number;
  requiredPermissionLevel: AstraPermissionLevel;
  maxRuntimeMs: number;
  maxAttempts: number;
  retryBackoffMs: number;
  dependencies: string[];
  resourceLocks: string[];
};

function normalizedId(value: string) {
  const id = value.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(id)) {
    throw new Error(
      "Background task id must use 1-120 letters, numbers, dot, underscore, or dash.",
    );
  }
  return id;
}

function nowIso(now: Date) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid background task mutation time.");
  }
  return now.toISOString();
}

export async function upsertBackgroundTask(
  input: AstraTaskUpsertInput,
  now = new Date(),
) {
  const at = nowIso(now);
  return mutateTaskStore((store) => {
    const id = normalizedId(input.id);
    const index = store.tasks.findIndex(
      (candidate) => candidate.id.toLowerCase() === id.toLowerCase(),
    );
    const existing = index >= 0 ? store.tasks[index] : undefined;
    if (existing?.status === "running" || isTaskActive(id)) {
      throw new Error("Running background tasks cannot be edited.");
    }

    const task: AstraBackgroundTask = {
      id: existing?.id ?? id,
      title: input.title.trim(),
      goal: input.goal.trim(),
      agent: input.agent,
      ...(input.projectId?.trim()
        ? { projectId: input.projectId.trim() }
        : {}),
      priority: input.priority,
      requiredPermissionLevel: input.requiredPermissionLevel,
      maxRuntimeMs: input.maxRuntimeMs,
      maxAttempts: input.maxAttempts,
      retryBackoffMs: input.retryBackoffMs,
      dependencies: [...input.dependencies],
      resourceLocks: [...input.resourceLocks],
      status:
        existing &&
        (existing.status === "paused" ||
          existing.status === "succeeded" ||
          existing.status === "failed" ||
          existing.status === "cancelled")
          ? existing.status
          : "paused",
      attempts: existing?.attempts ?? 0,
      createdAt: existing?.createdAt ?? at,
      updatedAt: at,
      checkpoint: existing?.checkpoint,
      resultSummary: existing?.resultSummary,
      lastError: existing?.lastError,
    };

    const next = [...store.tasks];
    if (index >= 0) next[index] = task;
    else next.push(task);

    return {
      store: { ...store, tasks: next },
      result: { task, count: next.length },
    };
  });
}

export async function resumeBackgroundTask(
  idInput: string,
  now = new Date(),
) {
  const at = nowIso(now);
  return mutateTaskStore((store) => {
    const id = normalizedId(idInput);
    const index = store.tasks.findIndex(
      (task) => task.id.toLowerCase() === id.toLowerCase(),
    );
    if (index < 0) throw new Error("Background task was not found.");
    const current = store.tasks[index];
    if (current.status === "running") {
      throw new Error("Background task is already running.");
    }
    if (current.status === "succeeded") {
      throw new Error("Succeeded background tasks cannot be resumed.");
    }

    const task: AstraBackgroundTask = {
      ...current,
      status: "queued",
      nextAttemptAt: undefined,
      lastError:
        current.status === "failed" || current.status === "cancelled"
          ? undefined
          : current.lastError,
      updatedAt: at,
    };
    const next = [...store.tasks];
    next[index] = task;
    return {
      store: { ...store, tasks: next },
      result: { task },
    };
  });
}

export async function pauseBackgroundTask(
  idInput: string,
  now = new Date(),
) {
  const id = normalizedId(idInput);
  if (isTaskActive(id)) {
    const requested = stopActiveTask(id, "pause");
    return {
      requested,
      taskId: id,
      detail:
        "Pause requested for the active task; runner will persist the paused state after cancellation settles.",
    };
  }

  const at = nowIso(now);
  return mutateTaskStore((store) => {
    const index = store.tasks.findIndex(
      (task) => task.id.toLowerCase() === id.toLowerCase(),
    );
    if (index < 0) throw new Error("Background task was not found.");
    const current = store.tasks[index];
    if (
      current.status === "succeeded" ||
      current.status === "failed" ||
      current.status === "cancelled"
    ) {
      throw new Error("Terminal background tasks cannot be paused.");
    }
    if (current.status === "running") {
      throw new Error(
        "Background task is marked running but has no active local runner. Recover it before pausing.",
      );
    }

    const task: AstraBackgroundTask = {
      ...current,
      status: "paused",
      nextAttemptAt: undefined,
      updatedAt: at,
    };
    const next = [...store.tasks];
    next[index] = task;
    return {
      store: { ...store, tasks: next },
      result: { task },
    };
  });
}

export async function cancelBackgroundTask(
  idInput: string,
  now = new Date(),
) {
  const id = normalizedId(idInput);
  if (isTaskActive(id)) {
    const requested = stopActiveTask(id, "cancel");
    return {
      requested,
      taskId: id,
      detail:
        "Cancellation requested for the active task; runner will persist the cancelled state after cancellation settles.",
    };
  }

  const at = nowIso(now);
  return mutateTaskStore((store) => {
    const index = store.tasks.findIndex(
      (task) => task.id.toLowerCase() === id.toLowerCase(),
    );
    if (index < 0) throw new Error("Background task was not found.");
    const current = store.tasks[index];
    if (current.status === "succeeded") {
      throw new Error("Succeeded background tasks cannot be cancelled.");
    }
    if (current.status === "running") {
      throw new Error(
        "Background task is marked running but has no active local runner. Recover it before cancelling.",
      );
    }

    const task: AstraBackgroundTask = {
      ...current,
      status: "cancelled",
      nextAttemptAt: undefined,
      updatedAt: at,
    };
    const next = [...store.tasks];
    next[index] = task;
    return {
      store: { ...store, tasks: next },
      result: { task },
    };
  });
}

export async function deleteBackgroundTask(idInput: string) {
  const id = normalizedId(idInput);
  if (isTaskActive(id)) {
    throw new Error("Active background tasks cannot be deleted.");
  }

  return mutateTaskStore((store) => {
    const current = store.tasks.find(
      (task) => task.id.toLowerCase() === id.toLowerCase(),
    );
    if (!current) throw new Error("Background task was not found.");
    if (current.status === "running") {
      throw new Error("Running background tasks cannot be deleted.");
    }
    const dependants = store.tasks.filter((task) =>
      task.dependencies.some(
        (dependency) => dependency.toLowerCase() === id.toLowerCase(),
      ),
    );
    if (dependants.length > 0) {
      throw new Error(
        "Background task cannot be deleted while other tasks depend on it.",
      );
    }

    const next = store.tasks.filter(
      (task) => task.id.toLowerCase() !== id.toLowerCase(),
    );
    return {
      store: { ...store, tasks: next },
      result: { deleted: true, count: next.length },
    };
  });
}

export async function recoverInterruptedTasks(
  now = new Date(),
) {
  const at = nowIso(now);
  return mutateTaskStore((store) => {
    let recovered = 0;
    const tasks = store.tasks.map((task) => {
      if (task.status !== "running" || isTaskActive(task.id)) {
        return task;
      }
      recovered += 1;
      return {
        ...task,
        status: "paused" as AstraBackgroundTaskStatus,
        updatedAt: at,
        nextAttemptAt: undefined,
        lastError:
          "Task was marked running without an active local runner after restart/recovery. It was paused safely.",
      };
    });

    return {
      store: { ...store, tasks },
      result: { recovered },
    };
  });
}

export async function saveTaskCheckpoint({
  taskId,
  summary,
  now = new Date(),
}: {
  taskId: string;
  summary: string;
  now?: Date;
}) {
  const at = nowIso(now);
  const id = normalizedId(taskId);
  const bounded = summary.trim().slice(0, 4000);
  if (!bounded) throw new Error("Checkpoint summary cannot be empty.");

  return mutateTaskStore((store) => {
    const index = store.tasks.findIndex(
      (task) => task.id.toLowerCase() === id.toLowerCase(),
    );
    if (index < 0) throw new Error("Background task was not found.");
    const current = store.tasks[index];
    if (current.status !== "running") {
      throw new Error("Only a running background task can checkpoint.");
    }

    const task: AstraBackgroundTask = {
      ...current,
      checkpoint: {
        sequence: (current.checkpoint?.sequence ?? 0) + 1,
        summary: bounded,
        updatedAt: at,
      },
      updatedAt: at,
    };
    const next = [...store.tasks];
    next[index] = task;
    return {
      store: { ...store, tasks: next },
      result: { task },
    };
  });
}
