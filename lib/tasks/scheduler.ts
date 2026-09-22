import type {
  AstraBackgroundTask,
  AstraTaskQueueItem,
  AstraTaskTickPlan,
} from "./contracts";

function parsedTime(value: string | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function queueItem(
  task: AstraBackgroundTask,
  detail: string,
): AstraTaskQueueItem {
  return {
    taskId: task.id,
    priority: task.priority,
    requiredPermissionLevel: task.requiredPermissionLevel,
    resourceLocks: [...task.resourceLocks],
    detail,
  };
}

function sharesLock(
  candidate: AstraBackgroundTask,
  locks: Set<string>,
) {
  return candidate.resourceLocks.some((lock) => locks.has(lock));
}

export function assertAcyclicTaskGraph(
  tasks: readonly AstraBackgroundTask[],
) {
  const byId = new Map(
    tasks.map((task) => [task.id.toLowerCase(), task]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (task: AstraBackgroundTask) => {
    const key = task.id.toLowerCase();
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      throw new Error("Background task dependency graph contains a cycle.");
    }

    visiting.add(key);
    for (const dependencyId of task.dependencies) {
      const dependency = byId.get(dependencyId.toLowerCase());
      if (!dependency) {
        throw new Error(
          "Background task dependency does not exist: " +
            dependencyId +
            ".",
        );
      }
      visit(dependency);
    }
    visiting.delete(key);
    visited.add(key);
  };

  for (const task of tasks) visit(task);
}

export function planBackgroundTaskTick(
  tasks: readonly AstraBackgroundTask[],
  now = new Date(),
  maxConcurrency = 2,
): AstraTaskTickPlan {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid background task planning time.");
  }
  if (
    !Number.isInteger(maxConcurrency) ||
    maxConcurrency < 1 ||
    maxConcurrency > 8
  ) {
    throw new Error("Background task concurrency must be between 1 and 8.");
  }

  assertAcyclicTaskGraph(tasks);
  const byId = new Map(
    tasks.map((task) => [task.id.toLowerCase(), task]),
  );
  const nowMs = now.getTime();

  const running = tasks.filter((task) => task.status === "running");
  const activeLocks = new Set(
    running.flatMap((task) => task.resourceLocks),
  );
  let availableSlots = Math.max(0, maxConcurrency - running.length);

  const ready: AstraTaskQueueItem[] = [];
  const waitingApproval: AstraTaskQueueItem[] = [];
  const waitingDependency: AstraTaskQueueItem[] = [];
  const blockedDependency: AstraTaskQueueItem[] = [];
  const deferredCapacity: AstraTaskQueueItem[] = [];

  const candidates = tasks
    .filter((task) => {
      if (task.status === "queued") return true;
      if (task.status !== "retry_wait") return false;
      return parsedTime(task.nextAttemptAt) <= nowMs;
    })
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        parsedTime(left.createdAt) - parsedTime(right.createdAt) ||
        left.id.localeCompare(right.id),
    );

  for (const task of candidates) {
    const dependencies = task.dependencies.map((id) =>
      byId.get(id.toLowerCase()),
    );
    const failedDependency = dependencies.find(
      (dependency) =>
        dependency?.status === "failed" ||
        dependency?.status === "cancelled",
    );
    if (failedDependency) {
      blockedDependency.push(
        queueItem(
          task,
          "Blocked because dependency " +
            failedDependency.id +
            " ended as " +
            failedDependency.status +
            ".",
        ),
      );
      continue;
    }

    const incomplete = dependencies.find(
      (dependency) => dependency?.status !== "succeeded",
    );
    if (incomplete) {
      waitingDependency.push(
        queueItem(
          task,
          "Waiting for dependency " + incomplete.id + " to succeed.",
        ),
      );
      continue;
    }

    if (task.requiredPermissionLevel > 1) {
      waitingApproval.push(
        queueItem(
          task,
          "Background task requires explicit Permission Level-" +
            task.requiredPermissionLevel +
            " approval before execution.",
        ),
      );
      continue;
    }

    if (availableSlots < 1 || sharesLock(task, activeLocks)) {
      deferredCapacity.push(
        queueItem(
          task,
          sharesLock(task, activeLocks)
            ? "Deferred because another active/selected task owns an overlapping resource lock."
            : "Deferred because the bounded worker pool is full.",
        ),
      );
      continue;
    }

    ready.push(
      queueItem(
        task,
        "Eligible for unattended bounded execution at Permission Level " +
          task.requiredPermissionLevel +
          ".",
      ),
    );
    availableSlots -= 1;
    for (const lock of task.resourceLocks) activeLocks.add(lock);
  }

  return {
    ready,
    waitingApproval,
    waitingDependency,
    blockedDependency,
    deferredCapacity,
  };
}
