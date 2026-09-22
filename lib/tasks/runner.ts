import type {
  AstraBackgroundTask,
  AstraTaskLifecycleEvent,
  AstraTaskTickPlan,
} from "./contracts";
import {
  recoverInterruptedTasks,
  saveTaskCheckpoint,
} from "./management";
import {
  AstraTaskAbortError,
  registerActiveTask,
} from "./runtime";
import { planBackgroundTaskTick } from "./scheduler";
import {
  loadTaskStore,
  mutateTaskStore,
} from "./store";

export type AstraBackgroundTaskExecutionOutcome =
  | {
      status: "completed";
      detail: string;
      resultSummary?: string;
    }
  | {
      status: "failed";
      detail: string;
    };

export type AstraBackgroundTaskExecutor = (
  task: AstraBackgroundTask,
  context: {
    signal: AbortSignal;
    checkpoint: (summary: string) => Promise<void>;
  },
) => Promise<AstraBackgroundTaskExecutionOutcome>;

export type AstraBackgroundTaskRunRecord = {
  taskId: string;
  status:
    | "completed"
    | "retry_wait"
    | "failed"
    | "paused"
    | "cancelled"
    | "skipped";
  detail: string;
};

export type AstraBackgroundTaskTickResult = {
  source: string;
  available: boolean;
  plan?: AstraTaskTickPlan;
  runs: AstraBackgroundTaskRunRecord[];
  recovered: number;
  stopped: boolean;
  detail: string;
};

function bounded(value: string | undefined, max: number) {
  return value?.trim().slice(0, max) || "";
}

function emit(
  callback:
    | ((event: AstraTaskLifecycleEvent) => void)
    | undefined,
  event: AstraTaskLifecycleEvent,
) {
  callback?.(event);
}

async function claimTask({
  taskId,
  maxConcurrency,
  now,
}: {
  taskId: string;
  maxConcurrency: number;
  now: Date;
}) {
  return mutateTaskStore((store) => {
    const index = store.tasks.findIndex(
      (task) => task.id.toLowerCase() === taskId.toLowerCase(),
    );
    if (index < 0) {
      return {
        store,
        result: {
          claimed: false as const,
          detail: "Background task disappeared before claim.",
        },
      };
    }

    const current = store.tasks[index];
    if (
      current.status !== "queued" &&
      current.status !== "retry_wait"
    ) {
      return {
        store,
        result: {
          claimed: false as const,
          detail:
            "Background task is no longer in a claimable queue state.",
        },
      };
    }

    if (
      current.status === "retry_wait" &&
      current.nextAttemptAt &&
      Date.parse(current.nextAttemptAt) > now.getTime()
    ) {
      return {
        store,
        result: {
          claimed: false as const,
          detail: "Background task retry backoff is still active.",
        },
      };
    }

    if (current.requiredPermissionLevel > 1) {
      return {
        store,
        result: {
          claimed: false as const,
          detail:
            "Unattended runner refuses tasks above Permission Level 1.",
        },
      };
    }

    const byId = new Map(
      store.tasks.map((task) => [task.id.toLowerCase(), task]),
    );
    const incomplete = current.dependencies.find(
      (dependencyId) =>
        byId.get(dependencyId.toLowerCase())?.status !== "succeeded",
    );
    if (incomplete) {
      return {
        store,
        result: {
          claimed: false as const,
          detail:
            "Background task dependency is no longer satisfied: " +
            incomplete +
            ".",
        },
      };
    }

    const running = store.tasks.filter(
      (task) => task.status === "running",
    );
    if (running.length >= maxConcurrency) {
      return {
        store,
        result: {
          claimed: false as const,
          detail: "Background worker pool is already full.",
        },
      };
    }

    const activeLocks = new Set(
      running.flatMap((task) => task.resourceLocks),
    );
    const conflict = current.resourceLocks.find((lock) =>
      activeLocks.has(lock),
    );
    if (conflict) {
      return {
        store,
        result: {
          claimed: false as const,
          detail:
            "Background task resource lock is already active: " +
            conflict +
            ".",
        },
      };
    }

    const task: AstraBackgroundTask = {
      ...current,
      status: "running",
      attempts: current.attempts + 1,
      updatedAt: now.toISOString(),
      nextAttemptAt: undefined,
      lastError: undefined,
    };
    const next = [...store.tasks];
    next[index] = task;
    return {
      store: { ...store, tasks: next },
      result: {
        claimed: true as const,
        task,
        detail:
          "Background task claimed for bounded unattended execution.",
      },
    };
  });
}

async function settleSuccess(
  taskId: string,
  outcome: Extract<
    AstraBackgroundTaskExecutionOutcome,
    { status: "completed" }
  >,
  now = new Date(),
) {
  return mutateTaskStore((store) => {
    const index = store.tasks.findIndex(
      (task) => task.id.toLowerCase() === taskId.toLowerCase(),
    );
    if (index < 0) throw new Error("Background task disappeared.");
    const current = store.tasks[index];
    const task: AstraBackgroundTask = {
      ...current,
      status: "succeeded",
      updatedAt: now.toISOString(),
      nextAttemptAt: undefined,
      lastError: undefined,
      resultSummary:
        bounded(outcome.resultSummary ?? outcome.detail, 8000) ||
        "Background task completed.",
    };
    const next = [...store.tasks];
    next[index] = task;
    return {
      store: { ...store, tasks: next },
      result: task,
    };
  });
}

async function settleAbort(
  taskId: string,
  action: "pause" | "cancel" | "global_stop",
  now = new Date(),
) {
  return mutateTaskStore((store) => {
    const index = store.tasks.findIndex(
      (task) => task.id.toLowerCase() === taskId.toLowerCase(),
    );
    if (index < 0) throw new Error("Background task disappeared.");
    const current = store.tasks[index];
    const status =
      action === "cancel" ? "cancelled" : "paused";
    const task: AstraBackgroundTask = {
      ...current,
      status,
      updatedAt: now.toISOString(),
      nextAttemptAt: undefined,
      lastError:
        action === "global_stop"
          ? "Paused by global STOP."
          : action === "pause"
            ? "Paused by user/runtime request."
            : "Cancelled by user/runtime request.",
    };
    const next = [...store.tasks];
    next[index] = task;
    return {
      store: { ...store, tasks: next },
      result: task,
    };
  });
}

async function settleFailure(
  taskId: string,
  detail: string,
  now = new Date(),
) {
  return mutateTaskStore((store) => {
    const index = store.tasks.findIndex(
      (task) => task.id.toLowerCase() === taskId.toLowerCase(),
    );
    if (index < 0) throw new Error("Background task disappeared.");
    const current = store.tasks[index];
    const retry = current.attempts < current.maxAttempts;
    const exponent = Math.max(0, current.attempts - 1);
    const delay = Math.min(
      current.retryBackoffMs * 2 ** exponent,
      24 * 60 * 60_000,
    );
    const task: AstraBackgroundTask = {
      ...current,
      status: retry ? "retry_wait" : "failed",
      updatedAt: now.toISOString(),
      nextAttemptAt: retry
        ? new Date(now.getTime() + delay).toISOString()
        : undefined,
      lastError: bounded(detail, 4000) || "Background task failed.",
    };
    const next = [...store.tasks];
    next[index] = task;
    return {
      store: { ...store, tasks: next },
      result: task,
    };
  });
}

async function runClaimedTask({
  task,
  execute,
  externalSignal,
  onEvent,
}: {
  task: AstraBackgroundTask;
  execute: AstraBackgroundTaskExecutor;
  externalSignal?: AbortSignal;
  onEvent?: (event: AstraTaskLifecycleEvent) => void;
}): Promise<AstraBackgroundTaskRunRecord> {
  const controller = new AbortController();
  const unregister = registerActiveTask(task.id, controller);
  const timeout = setTimeout(
    () =>
      controller.abort(
        new DOMException("Background task timed out.", "TimeoutError"),
      ),
    task.maxRuntimeMs,
  );

  const onExternalAbort = () =>
    controller.abort(new AstraTaskAbortError("global_stop"));

  if (externalSignal?.aborted) {
    onExternalAbort();
  } else {
    externalSignal?.addEventListener("abort", onExternalAbort, {
      once: true,
    });
  }

  let removeAbortListener = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    const rejectAbort = () => {
      const reason = controller.signal.reason;
      reject(
        reason instanceof Error
          ? reason
          : new AstraTaskAbortError("global_stop"),
      );
    };
    if (controller.signal.aborted) {
      rejectAbort();
      return;
    }
    controller.signal.addEventListener("abort", rejectAbort, {
      once: true,
    });
    removeAbortListener = () =>
      controller.signal.removeEventListener("abort", rejectAbort);
  });

  emit(onEvent, {
    type: "task.started",
    taskId: task.id,
    at: new Date().toISOString(),
    detail: "Background task executor started.",
  });

  try {
    const outcome = await Promise.race([
      execute(task, {
        signal: controller.signal,
        checkpoint: async (summary) => {
          const saved = await saveTaskCheckpoint({
            taskId: task.id,
            summary,
          });
          emit(onEvent, {
            type: "task.checkpoint",
            taskId: task.id,
            at: saved.task.checkpoint?.updatedAt ?? new Date().toISOString(),
            detail:
              saved.task.checkpoint?.summary ??
              "Background task checkpoint persisted.",
          });
        },
      }),
      aborted,
    ]);

    if (outcome.status === "completed") {
      const settled = await settleSuccess(task.id, outcome);
      const detail =
        bounded(outcome.detail, 2000) ||
        "Background task completed.";
      emit(onEvent, {
        type: "task.succeeded",
        taskId: task.id,
        at: settled.updatedAt,
        detail,
      });
      return {
        taskId: task.id,
        status: "completed",
        detail,
      };
    }

    const failed = await settleFailure(task.id, outcome.detail);
    const retry = failed.status === "retry_wait";
    emit(onEvent, {
      type: retry ? "task.retry_wait" : "task.failed",
      taskId: task.id,
      at: failed.updatedAt,
      detail: failed.lastError ?? "Background task failed.",
    });
    return {
      taskId: task.id,
      status: retry ? "retry_wait" : "failed",
      detail: failed.lastError ?? "Background task failed.",
    };
  } catch (error) {
    if (error instanceof AstraTaskAbortError) {
      const settled = await settleAbort(task.id, error.action);
      const status =
        error.action === "cancel" ? "cancelled" : "paused";
      emit(onEvent, {
        type: status === "cancelled" ? "task.cancelled" : "task.paused",
        taskId: task.id,
        at: settled.updatedAt,
        detail: settled.lastError ?? error.message,
      });
      return {
        taskId: task.id,
        status,
        detail: settled.lastError ?? error.message,
      };
    }

    const name = error instanceof Error ? error.name : "";
    const detail =
      name === "TimeoutError"
        ? "Background task execution timed out."
        : error instanceof Error
          ? bounded(error.message, 4000)
          : "Background task execution failed.";
    const failed = await settleFailure(task.id, detail);
    const retry = failed.status === "retry_wait";
    emit(onEvent, {
      type: retry ? "task.retry_wait" : "task.failed",
      taskId: task.id,
      at: failed.updatedAt,
      detail: failed.lastError ?? detail,
    });
    return {
      taskId: task.id,
      status: retry ? "retry_wait" : "failed",
      detail: failed.lastError ?? detail,
    };
  } finally {
    clearTimeout(timeout);
    removeAbortListener();
    externalSignal?.removeEventListener("abort", onExternalAbort);
    unregister();
  }
}

export async function runBackgroundTaskTickFromStore(options: {
  execute: AstraBackgroundTaskExecutor;
  now?: Date;
  signal?: AbortSignal;
  maxConcurrency?: number;
  onEvent?: (event: AstraTaskLifecycleEvent) => void;
}): Promise<AstraBackgroundTaskTickResult> {
  const now = options.now ?? new Date();
  const maxConcurrency = options.maxConcurrency ?? 2;

  const recovery = await recoverInterruptedTasks(now);
  const loaded = await loadTaskStore();
  if (!loaded.available) {
    return {
      source: loaded.source,
      available: false,
      runs: [],
      recovered: recovery.recovered,
      stopped: options.signal?.aborted === true,
      detail: loaded.detail,
    };
  }

  const plan = planBackgroundTaskTick(
    loaded.store.tasks,
    now,
    maxConcurrency,
  );

  for (const item of plan.waitingApproval) {
    emit(options.onEvent, {
      type: "task.waiting_approval",
      taskId: item.taskId,
      at: now.toISOString(),
      detail: item.detail,
    });
  }

  if (options.signal?.aborted) {
    return {
      source: loaded.source,
      available: true,
      plan,
      runs: [],
      recovered: recovery.recovered,
      stopped: true,
      detail: "Global STOP was already active before task execution.",
    };
  }

  const claimed: AstraBackgroundTask[] = [];
  const skipped: AstraBackgroundTaskRunRecord[] = [];

  for (const item of plan.ready) {
    if (options.signal?.aborted) break;
    const claim = await claimTask({
      taskId: item.taskId,
      maxConcurrency,
      now,
    });
    if (!claim.claimed) {
      skipped.push({
        taskId: item.taskId,
        status: "skipped",
        detail: claim.detail,
      });
      continue;
    }
    claimed.push(claim.task);
    emit(options.onEvent, {
      type: "task.claimed",
      taskId: claim.task.id,
      at: claim.task.updatedAt,
      detail: claim.detail,
    });
  }

  const runs = await Promise.all(
    claimed.map((task) =>
      runClaimedTask({
        task,
        execute: options.execute,
        externalSignal: options.signal,
        onEvent: options.onEvent,
      }),
    ),
  );

  return {
    source: loaded.source,
    available: true,
    plan,
    runs: [...skipped, ...runs],
    recovered: recovery.recovered,
    stopped: options.signal?.aborted === true,
    detail:
      "Background task tick selected " +
      plan.ready.length +
      " runnable task" +
      (plan.ready.length === 1 ? "" : "s") +
      " with bounded concurrency " +
      maxConcurrency +
      ".",
  };
}
