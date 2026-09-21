import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import type { AstraAutomationDefinition } from "../lib/automation/contracts";
import type { AstraAutomationLifecycleEvent } from "../lib/automation/queue";
import { runAutomationTickFromStore } from "../lib/automation/runner";
import {
  claimAutomationOccurrence,
  loadAutomationStore,
  saveAutomationStore,
} from "../lib/automation/store";

function fixture(
  id: string,
  overrides: Partial<AstraAutomationDefinition> = {},
): AstraAutomationDefinition {
  return {
    id,
    title: id,
    goal: "Fixture scheduled read-only task.",
    createdAt: "2026-09-20T08:00:00.000Z",
    updatedAt: "2026-09-20T08:00:00.000Z",
    status: "enabled",
    schedule: {
      kind: "interval",
      anchorAt: "2026-09-20T09:00:00.000Z",
      everyMinutes: 60,
    },
    requiredPermissionLevel: 1,
    maxRuntimeMs: 1_000,
    ...overrides,
  };
}

async function withStore(run: () => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-runner-"));
  const previousFile = process.env.ASTRA_AUTOMATION_FILE;
  const previousEnabled = process.env.ASTRA_AUTOMATION_ENABLED;

  process.env.ASTRA_AUTOMATION_FILE = path.join(
    root,
    ".astra",
    "automations.json",
  );
  process.env.ASTRA_AUTOMATION_ENABLED = "true";

  try {
    await run();
  } finally {
    if (previousFile === undefined) delete process.env.ASTRA_AUTOMATION_FILE;
    else process.env.ASTRA_AUTOMATION_FILE = previousFile;

    if (previousEnabled === undefined) {
      delete process.env.ASTRA_AUTOMATION_ENABLED;
    } else {
      process.env.ASTRA_AUTOMATION_ENABLED = previousEnabled;
    }

    await rm(root, { recursive: true, force: true });
  }
}

test("Phase 14C2 durable claim prevents duplicate occurrence execution", async () => {
  await withStore(async () => {
    await saveAutomationStore([fixture("claim-once")]);

    const first = await claimAutomationOccurrence({
      automationId: "claim-once",
      scheduledFor: "2026-09-20T10:00:00.000Z",
      now: new Date("2026-09-20T10:30:00.000Z"),
    });
    assert.equal(first.claimed, true);

    const second = await claimAutomationOccurrence({
      automationId: "claim-once",
      scheduledFor: "2026-09-20T10:00:00.000Z",
      now: new Date("2026-09-20T10:30:00.000Z"),
    });
    assert.equal(second.claimed, false);

    const stored = await loadAutomationStore();
    assert.equal(
      stored.automations[0].lastRunAt,
      "2026-09-20T10:00:00.000Z",
    );
  });
});

test("Phase 14C2 runner executes only read-only jobs and reports approval waits", async () => {
  await withStore(async () => {
    await saveAutomationStore([
      fixture("read-only"),
      fixture("local-write", { requiredPermissionLevel: 2 }),
      fixture("external-write", { requiredPermissionLevel: 3 }),
    ]);

    const calls: string[] = [];
    const events: AstraAutomationLifecycleEvent[] = [];

    const result = await runAutomationTickFromStore({
      now: new Date("2026-09-20T10:30:00.000Z"),
      onEvent: (event) => events.push(event),
      async execute(automation) {
        calls.push(automation.id);
        return {
          status: "completed",
          detail: "fixture completed",
          output: "summary",
        };
      },
    });

    assert.deepEqual(calls, ["read-only"]);
    assert.equal(result.runs.length, 1);
    assert.equal(result.runs[0].status, "completed");
    assert.deepEqual(
      result.waitingApproval.map((item) => item.automationId),
      ["external-write", "local-write"],
    );
    assert.ok(
      events.some(
        (event) =>
          event.type === "automation.claimed" &&
          event.automationId === "read-only",
      ),
    );
    assert.equal(
      events.filter((event) => event.type === "automation.waiting_approval")
        .length,
      2,
    );

    const second = await runAutomationTickFromStore({
      now: new Date("2026-09-20T10:30:00.000Z"),
      async execute(automation) {
        calls.push("duplicate:" + automation.id);
        return {
          status: "completed",
          detail: "must not duplicate",
        };
      },
    });
    assert.equal(second.runs.length, 0);
    assert.deepEqual(calls, ["read-only"]);
  });
});

test("Phase 14C2 global STOP propagates into the active read-only executor", async () => {
  await withStore(async () => {
    await saveAutomationStore([fixture("cancellable")]);
    const controller = new AbortController();
    const events: string[] = [];
    let markExecutorStarted: (() => void) | undefined;
    const executorStarted = new Promise<void>((resolve) => {
      markExecutorStarted = resolve;
    });

    const resultPromise = runAutomationTickFromStore({
      now: new Date("2026-09-20T10:30:00.000Z"),
      signal: controller.signal,
      onEvent: (event) => events.push(event.type),
      async execute(_automation, context) {
        markExecutorStarted?.();
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 500);
          const onAbort = () => {
            clearTimeout(timer);
            reject(
              context.signal.reason instanceof Error
                ? context.signal.reason
                : new DOMException("cancelled", "AbortError"),
            );
          };
          if (context.signal.aborted) onAbort();
          else context.signal.addEventListener("abort", onAbort, {
            once: true,
          });
        });
        return {
          status: "completed",
          detail: "must not complete after STOP",
        };
      },
    });

    await executorStarted;
    controller.abort(
      new DOMException("global stop", "AbortError"),
    );

    const result = await resultPromise;
    assert.equal(result.stopped, true);
    assert.equal(result.runs.length, 1);
    assert.equal(result.runs[0].status, "cancelled");
    assert.ok(events.includes("automation.started"));
    assert.ok(events.includes("automation.cancelled"));
    assert.equal(events.includes("automation.completed"), false);
  });
});
