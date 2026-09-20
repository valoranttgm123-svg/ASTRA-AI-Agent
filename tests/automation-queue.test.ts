import assert from "node:assert/strict";
import { test } from "node:test";

import type { AstraAutomationDefinition } from "../lib/automation/contracts";
import {
  ASTRA_AUTOMATION_MAX_READY_PER_TICK,
  planAutomationTick,
} from "../lib/automation/queue";

function automation(
  id: string,
  overrides: Partial<AstraAutomationDefinition> = {},
): AstraAutomationDefinition {
  return {
    id,
    title: id,
    goal: "Fixture automation goal.",
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

test("Phase 14C1 queue separates unattended work from approval-gated work", () => {
  const plan = planAutomationTick(
    [
      automation("read-only"),
      automation("safe-local", { requiredPermissionLevel: 2 }),
      automation("external", { requiredPermissionLevel: 3 }),
      automation("paused", { status: "paused" }),
      automation("future", {
        schedule: {
          kind: "once",
          runAt: "2026-09-20T12:00:00.000Z",
        },
      }),
    ],
    new Date("2026-09-20T10:30:00.000Z"),
  );

  assert.deepEqual(
    plan.ready.map((item) => item.automationId),
    ["read-only"],
  );
  assert.deepEqual(
    plan.waitingApproval.map((item) => item.automationId),
    ["external", "safe-local"],
  );
  assert.equal(plan.nextWakeAt, "2026-09-20T12:00:00.000Z");
});

test("Phase 14C1 queue bounds runnable work per tick", () => {
  const items = Array.from(
    { length: ASTRA_AUTOMATION_MAX_READY_PER_TICK + 3 },
    (_, index) => automation("job-" + String(index + 1).padStart(2, "0")),
  );

  const plan = planAutomationTick(
    items,
    new Date("2026-09-20T10:30:00.000Z"),
  );

  assert.equal(plan.ready.length, ASTRA_AUTOMATION_MAX_READY_PER_TICK);
  assert.equal(plan.deferredReadyCount, 3);
});

test("Phase 14C1 queue sorts older occurrences before newer ones", () => {
  const plan = planAutomationTick(
    [
      automation("newer", {
        schedule: {
          kind: "once",
          runAt: "2026-09-20T10:00:00.000Z",
        },
      }),
      automation("older", {
        schedule: {
          kind: "once",
          runAt: "2026-09-20T09:00:00.000Z",
        },
      }),
    ],
    new Date("2026-09-20T10:30:00.000Z"),
  );

  assert.deepEqual(
    plan.ready.map((item) => item.automationId),
    ["older", "newer"],
  );
});

test("Phase 14C1 queue does not turn approval-gated jobs into runnable jobs", () => {
  const plan = planAutomationTick(
    [
      automation("level-2", { requiredPermissionLevel: 2 }),
      automation("level-3", { requiredPermissionLevel: 3 }),
    ],
    new Date("2026-09-20T10:30:00.000Z"),
  );

  assert.equal(plan.ready.length, 0);
  assert.equal(plan.waitingApproval.length, 2);
  assert.deepEqual(
    plan.waitingApproval.map((item) => item.requiredPermissionLevel),
    [2, 3],
  );
});
