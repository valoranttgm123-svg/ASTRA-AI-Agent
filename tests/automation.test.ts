import assert from "node:assert/strict";
import { test } from "node:test";

import type { AstraAutomationDefinition } from "../lib/automation/contracts";
import {
  evaluateAutomationRun,
  getAutomationDueState,
  validateAutomationDefinition,
} from "../lib/automation/scheduler";

function automation(
  overrides: Partial<AstraAutomationDefinition> = {},
): AstraAutomationDefinition {
  return {
    id: "fixture-hourly-summary",
    title: "Hourly project summary",
    goal: "Read the registered project state and prepare a bounded summary.",
    createdAt: "2026-09-20T08:00:00.000Z",
    updatedAt: "2026-09-20T08:00:00.000Z",
    status: "enabled",
    schedule: {
      kind: "interval",
      anchorAt: "2026-09-20T09:00:00.000Z",
      everyMinutes: 60,
    },
    requiredPermissionLevel: 1,
    maxRuntimeMs: 60_000,
    ...overrides,
  };
}

test("Phase 14A interval schedule exposes deterministic due occurrence", () => {
  const due = getAutomationDueState(
    automation(),
    new Date("2026-09-20T10:30:00.000Z"),
  );

  assert.equal(due.kind, "due");
  if (due.kind !== "due") return;
  assert.equal(due.scheduledFor, "2026-09-20T10:00:00.000Z");
  assert.equal(due.nextRunAt, "2026-09-20T11:00:00.000Z");

  const completed = getAutomationDueState(
    automation({ lastRunAt: "2026-09-20T10:00:30.000Z" }),
    new Date("2026-09-20T10:30:00.000Z"),
  );
  assert.equal(completed.kind, "not_due");
  assert.equal(completed.nextRunAt, "2026-09-20T11:00:00.000Z");
});

test("Phase 14A one-time schedule runs at most once", () => {
  const once = automation({
    schedule: {
      kind: "once",
      runAt: "2026-09-20T12:00:00.000Z",
    },
  });

  assert.equal(
    getAutomationDueState(
      once,
      new Date("2026-09-20T11:59:59.000Z"),
    ).kind,
    "not_due",
  );

  assert.equal(
    getAutomationDueState(
      once,
      new Date("2026-09-20T12:00:00.000Z"),
    ).kind,
    "due",
  );

  const afterRun = getAutomationDueState(
    {
      ...once,
      lastRunAt: "2026-09-20T12:00:01.000Z",
    },
    new Date("2026-09-21T12:00:00.000Z"),
  );
  assert.equal(afterRun.kind, "not_due");
  assert.equal(afterRun.nextRunAt, null);
});

test("Phase 14A unattended automation ceiling is Level 1", () => {
  const ready = evaluateAutomationRun(automation(), {
    now: new Date("2026-09-20T10:30:00.000Z"),
  });
  assert.equal(ready.kind, "ready");

  const level2 = evaluateAutomationRun(
    automation({ requiredPermissionLevel: 2 }),
    {
      now: new Date("2026-09-20T10:30:00.000Z"),
    },
  );
  assert.equal(level2.kind, "waiting_approval");
  if (level2.kind !== "waiting_approval") return;
  assert.equal(level2.requiredPermissionLevel, 2);

  const approvedForThisRun = evaluateAutomationRun(
    automation({ requiredPermissionLevel: 2 }),
    {
      now: new Date("2026-09-20T10:30:00.000Z"),
      approvedPermissionLevelForRun: 2,
    },
  );
  assert.equal(approvedForThisRun.kind, "ready");
});

test("Phase 14A external Level 3 work never inherits unattended trust", () => {
  const pending = evaluateAutomationRun(
    automation({ requiredPermissionLevel: 3 }),
    {
      now: new Date("2026-09-20T10:30:00.000Z"),
    },
  );
  assert.equal(pending.kind, "waiting_approval");

  const scoped = evaluateAutomationRun(
    automation({ requiredPermissionLevel: 3 }),
    {
      now: new Date("2026-09-20T10:30:00.000Z"),
      approvedPermissionLevelForRun: 3,
    },
  );
  assert.equal(scoped.kind, "ready");
});

test("Phase 14A rejects high-frequency and Level 4 scheduled work", () => {
  assert.throws(
    () =>
      validateAutomationDefinition(
        automation({
          schedule: {
            kind: "interval",
            anchorAt: "2026-09-20T09:00:00.000Z",
            everyMinutes: 5,
          },
        }),
      ),
    /interval/i,
  );

  assert.throws(
    () =>
      validateAutomationDefinition(
        automation({ requiredPermissionLevel: 4 }),
      ),
    /Level-4/i,
  );
});

test("Phase 14A paused automation never becomes runnable", () => {
  const result = evaluateAutomationRun(automation({ status: "paused" }), {
    now: new Date("2026-09-20T10:30:00.000Z"),
  });

  assert.equal(result.kind, "not_due");
  assert.equal(result.nextRunAt, null);
});
