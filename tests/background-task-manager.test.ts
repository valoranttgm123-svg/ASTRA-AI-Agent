import assert from "node:assert/strict";
import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import type { AstraBackgroundTask } from "../lib/tasks/contracts";
import { parseTaskMutation } from "../lib/tasks/http";
import {
  recoverInterruptedTasks,
  resumeBackgroundTask,
  upsertBackgroundTask,
} from "../lib/tasks/management";
import { runBackgroundTaskTickFromStore } from "../lib/tasks/runner";
import {
  assertAcyclicTaskGraph,
  planBackgroundTaskTick,
} from "../lib/tasks/scheduler";
import {
  loadTaskStore,
  saveTaskStore,
} from "../lib/tasks/store";

const originalTaskFile = process.env.ASTRA_TASK_FILE;

afterEach(() => {
  if (originalTaskFile === undefined) {
    delete process.env.ASTRA_TASK_FILE;
  } else {
    process.env.ASTRA_TASK_FILE = originalTaskFile;
  }
});

function task(
  id: string,
  overrides: Partial<AstraBackgroundTask> = {},
): AstraBackgroundTask {
  return {
    id,
    title: id,
    goal: "Run " + id,
    agent: "researcher",
    priority: 2,
    requiredPermissionLevel: 1,
    maxRuntimeMs: 10_000,
    maxAttempts: 3,
    retryBackoffMs: 1000,
    dependencies: [],
    resourceLocks: [],
    status: "queued",
    attempts: 0,
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
    ...overrides,
  };
}

test("Phase 25 scheduler prioritizes tasks and bounds parallelism", () => {
  const plan = planBackgroundTaskTick(
    [
      task("low", { priority: 1 }),
      task("high", { priority: 4 }),
      task("mid", { priority: 2 }),
    ],
    new Date("2026-09-22T01:00:00.000Z"),
    2,
  );

  assert.deepEqual(
    plan.ready.map((item) => item.taskId),
    ["high", "mid"],
  );
  assert.deepEqual(
    plan.deferredCapacity.map((item) => item.taskId),
    ["low"],
  );
});

test("Phase 25 serializes overlapping resource locks", () => {
  const plan = planBackgroundTaskTick(
    [
      task("writer-a", {
        priority: 4,
        resourceLocks: ["repo:astra"],
      }),
      task("writer-b", {
        priority: 3,
        resourceLocks: ["repo:astra"],
      }),
      task("reader", {
        priority: 2,
        resourceLocks: ["memory:read"],
      }),
    ],
    new Date("2026-09-22T01:00:00.000Z"),
    3,
  );

  assert.deepEqual(
    plan.ready.map((item) => item.taskId),
    ["writer-a", "reader"],
  );
  assert.equal(plan.deferredCapacity[0].taskId, "writer-b");
  assert.match(plan.deferredCapacity[0].detail, /resource lock/i);
});

test("Phase 25 dependencies wait, block on failed prerequisites, and reject cycles", () => {
  const plan = planBackgroundTaskTick(
    [
      task("base", { status: "running" }),
      task("dependent", { dependencies: ["base"] }),
      task("failed-base", { status: "failed" }),
      task("blocked", { dependencies: ["failed-base"] }),
    ],
    new Date("2026-09-22T01:00:00.000Z"),
    4,
  );

  assert.equal(plan.waitingDependency[0].taskId, "dependent");
  assert.equal(plan.blockedDependency[0].taskId, "blocked");

  assert.throws(
    () =>
      assertAcyclicTaskGraph([
        task("a", { dependencies: ["b"] }),
        task("b", { dependencies: ["a"] }),
      ]),
    /cycle/i,
  );
});

test("Phase 25 unattended runner never executes Permission Level 2/3 tasks", () => {
  const plan = planBackgroundTaskTick(
    [
      task("read", { requiredPermissionLevel: 1 }),
      task("write", { requiredPermissionLevel: 2 }),
      task("external", { requiredPermissionLevel: 3 }),
    ],
    new Date("2026-09-22T01:00:00.000Z"),
    4,
  );

  assert.deepEqual(
    plan.ready.map((item) => item.taskId),
    ["read"],
  );
  assert.deepEqual(
    plan.waitingApproval.map((item) => item.taskId).sort(),
    ["external", "write"],
  );
});

test("Phase 25 request parser rejects Level 4 and malformed task settings", () => {
  const parsed = parseTaskMutation({
    action: "upsert",
    task: {
      id: "research-a",
      title: "Research A",
      goal: "Research safely",
      agent: "researcher",
      priority: 3,
      requiredPermissionLevel: 1,
      maxRuntimeMs: 5000,
      maxAttempts: 3,
      retryBackoffMs: 1000,
      dependencies: [],
      resourceLocks: [],
    },
  });
  assert.equal(parsed.action, "upsert");

  assert.throws(
    () =>
      parseTaskMutation({
        action: "upsert",
        task: {
          id: "bad",
          title: "Bad",
          goal: "Bad",
          agent: "researcher",
          priority: 3,
          requiredPermissionLevel: 4,
          maxRuntimeMs: 5000,
          maxAttempts: 3,
          retryBackoffMs: 1000,
          dependencies: [],
          resourceLocks: [],
        },
      }),
    /Level 4 is unavailable/i,
  );
});

test("Phase 25 durable task lifecycle persists checkpoint and result", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-task-run-"));
  process.env.ASTRA_TASK_FILE = path.join(root, "tasks.json");

  await upsertBackgroundTask(
    {
      id: "research-a",
      title: "Research A",
      goal: "Research safely",
      agent: "researcher",
      priority: 3,
      requiredPermissionLevel: 1,
      maxRuntimeMs: 5000,
      maxAttempts: 3,
      retryBackoffMs: 1000,
      dependencies: [],
      resourceLocks: ["research:a"],
    },
    new Date("2026-09-22T01:00:00.000Z"),
  );
  await resumeBackgroundTask(
    "research-a",
    new Date("2026-09-22T01:00:01.000Z"),
  );

  const result = await runBackgroundTaskTickFromStore({
    now: new Date("2026-09-22T01:00:02.000Z"),
    execute: async (_task, context) => {
      await context.checkpoint("halfway");
      return {
        status: "completed",
        detail: "done",
        resultSummary: "verified result",
      };
    },
  });

  assert.equal(result.runs[0].status, "completed");
  const loaded = await loadTaskStore();
  assert.equal(loaded.store.tasks[0].status, "succeeded");
  assert.equal(loaded.store.tasks[0].checkpoint?.summary, "halfway");
  assert.equal(loaded.store.tasks[0].resultSummary, "verified result");
  assert.equal(loaded.store.tasks[0].attempts, 1);
});

test("Phase 25 executes independent read-only tasks concurrently", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-task-parallel-"));
  process.env.ASTRA_TASK_FILE = path.join(root, "tasks.json");

  await saveTaskStore({
    schemaVersion: 1,
    tasks: [
      task("a", { resourceLocks: ["a"] }),
      task("b", { resourceLocks: ["b"] }),
    ],
  });

  let active = 0;
  let peak = 0;
  const result = await runBackgroundTaskTickFromStore({
    maxConcurrency: 2,
    now: new Date("2026-09-22T01:00:00.000Z"),
    execute: async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 25));
      active -= 1;
      return { status: "completed", detail: "done" };
    },
  });

  assert.equal(peak, 2);
  assert.equal(
    result.runs.filter((run) => run.status === "completed").length,
    2,
  );
});

test("Phase 25 failed attempts enter retry wait before terminal failure", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-task-retry-"));
  process.env.ASTRA_TASK_FILE = path.join(root, "tasks.json");

  await saveTaskStore({
    schemaVersion: 1,
    tasks: [
      task("retry", {
        maxAttempts: 2,
        retryBackoffMs: 1000,
      }),
    ],
  });

  const result = await runBackgroundTaskTickFromStore({
    now: new Date("2026-09-22T01:00:00.000Z"),
    execute: async () => ({
      status: "failed",
      detail: "temporary failure",
    }),
  });

  assert.equal(result.runs[0].status, "retry_wait");
  const loaded = await loadTaskStore();
  assert.equal(loaded.store.tasks[0].status, "retry_wait");
  assert.equal(loaded.store.tasks[0].attempts, 1);
  assert.ok(loaded.store.tasks[0].nextAttemptAt);
});

test("Phase 25 global STOP pauses active tasks instead of claiming success", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-task-stop-"));
  process.env.ASTRA_TASK_FILE = path.join(root, "tasks.json");

  await saveTaskStore({
    schemaVersion: 1,
    tasks: [task("long")],
  });

  const controller = new AbortController();
  let started!: () => void;
  const startedPromise = new Promise<void>((resolve) => {
    started = resolve;
  });

  const tick = runBackgroundTaskTickFromStore({
    now: new Date("2026-09-22T01:00:00.000Z"),
    signal: controller.signal,
    execute: async (_task, context) => {
      started();
      await new Promise<void>((resolve) => {
        context.signal.addEventListener("abort", () => resolve(), {
          once: true,
        });
      });
      return { status: "completed", detail: "should not win" };
    },
  });

  await startedPromise;
  controller.abort();
  const result = await tick;

  assert.equal(result.runs[0].status, "paused");
  const loaded = await loadTaskStore();
  assert.equal(loaded.store.tasks[0].status, "paused");
  assert.match(loaded.store.tasks[0].lastError ?? "", /global STOP/i);
});

test("Phase 25 restart recovery safely pauses orphaned running tasks", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-task-recover-"));
  process.env.ASTRA_TASK_FILE = path.join(root, "tasks.json");

  await saveTaskStore({
    schemaVersion: 1,
    tasks: [
      task("orphan", {
        status: "running",
        attempts: 1,
      }),
    ],
  });

  const recovered = await recoverInterruptedTasks(
    new Date("2026-09-22T01:10:00.000Z"),
  );
  assert.equal(recovered.recovered, 1);

  const loaded = await loadTaskStore();
  assert.equal(loaded.store.tasks[0].status, "paused");
  assert.match(loaded.store.tasks[0].lastError ?? "", /restart\/recovery/i);
});

test("Phase 25 task store rejects symbolic links", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-task-link-"));
  const target = path.join(root, "target.json");
  const linked = path.join(root, "tasks.json");
  await writeFile(
    target,
    JSON.stringify({ schemaVersion: 1, tasks: [] }),
    "utf8",
  );
  await symlink(target, linked);
  process.env.ASTRA_TASK_FILE = linked;

  const loaded = await loadTaskStore();
  assert.equal(loaded.available, false);
  assert.match(loaded.detail, /symbolic link/i);
});
