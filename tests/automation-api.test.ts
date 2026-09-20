import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { deriveCapabilityRuntimeMap } from "../lib/agent/capability-runtime";
import type { AstraAutomationDefinition } from "../lib/automation/contracts";
import { parseAutomationMutation } from "../lib/automation/http";
import {
  deleteAutomationDefinition,
  setAutomationDefinitionStatus,
  upsertAutomationDefinition,
} from "../lib/automation/management";
import { saveAutomationStore } from "../lib/automation/store";
import { automationEventToBrainEvent } from "../lib/automation/telemetry";

async function withStore(run: () => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-api-"));
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

test("Phase 14D1 parser accepts bounded upsert and rejects Level 4", () => {
  const parsed = parseAutomationMutation({
    action: "upsert",
    definition: {
      id: "daily-summary",
      title: "Daily summary",
      goal: "Inspect project state and prepare a summary.",
      projectId: "astra",
      status: "paused",
      schedule: {
        kind: "interval",
        anchorAt: "2026-09-21T08:00:00.000Z",
        everyMinutes: 1440,
      },
      requiredPermissionLevel: 1,
      maxRuntimeMs: 60_000,
    },
  });

  assert.equal(parsed.action, "upsert");
  if (parsed.action !== "upsert") return;
  assert.equal(parsed.definition.id, "daily-summary");
  assert.equal(parsed.definition.requiredPermissionLevel, 1);

  assert.throws(
    () =>
      parseAutomationMutation({
        action: "upsert",
        definition: {
          id: "forbidden",
          title: "Forbidden",
          goal: "Must not schedule high-impact work.",
          schedule: {
            kind: "once",
            runAt: "2026-09-21T08:00:00.000Z",
          },
          requiredPermissionLevel: 4,
          maxRuntimeMs: 60_000,
        },
      }),
    /Level 4/i,
  );
});

test("Phase 14D1 management creates paused by default and supports status/delete", async () => {
  await withStore(async () => {
    const created = await upsertAutomationDefinition(
      {
        id: "project-summary",
        title: "Project summary",
        goal: "Read registered project context.",
        schedule: {
          kind: "interval",
          anchorAt: "2026-09-21T08:00:00.000Z",
          everyMinutes: 1440,
        },
        requiredPermissionLevel: 1,
        maxRuntimeMs: 60_000,
      },
      new Date("2026-09-20T13:00:00.000Z"),
    );

    assert.equal(created.automation?.status, "paused");
    assert.equal(created.count, 1);

    const enabled = await setAutomationDefinitionStatus(
      "project-summary",
      "enabled",
      new Date("2026-09-20T13:01:00.000Z"),
    );
    assert.equal(enabled.automation?.status, "enabled");

    const deleted = await deleteAutomationDefinition("project-summary");
    assert.equal(deleted.deleted, true);
    assert.equal(deleted.count, 0);
  });
});

test("Phase 14D1 upsert preserves durable occurrence state", async () => {
  await withStore(async () => {
    const existing: AstraAutomationDefinition = {
      id: "preserve-run",
      title: "Old title",
      goal: "Old goal",
      createdAt: "2026-09-20T08:00:00.000Z",
      updatedAt: "2026-09-20T09:00:00.000Z",
      status: "paused",
      schedule: {
        kind: "interval",
        anchorAt: "2026-09-20T09:00:00.000Z",
        everyMinutes: 60,
      },
      requiredPermissionLevel: 1,
      maxRuntimeMs: 60_000,
      lastRunAt: "2026-09-20T10:00:00.000Z",
    };
    await saveAutomationStore([existing]);

    const updated = await upsertAutomationDefinition(
      {
        id: "preserve-run",
        title: "New title",
        goal: "New goal",
        status: "enabled",
        schedule: {
          kind: "interval",
          anchorAt: "2026-09-20T09:00:00.000Z",
          everyMinutes: 120,
        },
        requiredPermissionLevel: 1,
        maxRuntimeMs: 90_000,
      },
      new Date("2026-09-20T13:00:00.000Z"),
    );

    assert.equal(
      updated.automation?.createdAt,
      "2026-09-20T08:00:00.000Z",
    );
    assert.equal(
      updated.automation?.lastRunAt,
      "2026-09-20T10:00:00.000Z",
    );
    assert.equal(updated.automation?.title, "New title");
  });
});

test("Phase 14D1 automation telemetry drives Ops truthfully", () => {
  const base = {
    ready: true,
    provider: "routing_only" as const,
    mode: "routing_only" as const,
    detail: "fixture",
    capabilities: {
      ops: {
        state: "READY" as const,
        detail: "Ops ready",
      },
    },
  };

  const waiting = automationEventToBrainEvent({
    type: "automation.waiting_approval",
    automationId: "email-followup",
    at: "2026-09-20T13:00:00.000Z",
    scheduledFor: "2026-09-20T13:00:00.000Z",
    detail: "Needs approval.",
  });
  assert.equal(waiting.visualNode, "ops");
  assert.equal(waiting.type, "automation.waiting_approval");

  let runtime = deriveCapabilityRuntimeMap(base, [waiting]);
  assert.equal(runtime.ops.state, "WAITING_APPROVAL");

  const started = automationEventToBrainEvent({
    type: "automation.started",
    automationId: "summary",
    at: "2026-09-20T13:01:00.000Z",
    scheduledFor: "2026-09-20T13:00:00.000Z",
    detail: "Running.",
  });
  runtime = deriveCapabilityRuntimeMap(base, [started]);
  assert.equal(runtime.ops.state, "ACTIVE");

  const failed = automationEventToBrainEvent({
    type: "automation.failed",
    automationId: "summary",
    at: "2026-09-20T13:02:00.000Z",
    scheduledFor: "2026-09-20T13:00:00.000Z",
    detail: "Failed.",
  });
  runtime = deriveCapabilityRuntimeMap(base, [started, failed]);
  assert.equal(runtime.ops.state, "ERROR");

  const completed = automationEventToBrainEvent({
    type: "automation.completed",
    automationId: "summary",
    at: "2026-09-20T13:03:00.000Z",
    scheduledFor: "2026-09-20T13:00:00.000Z",
    detail: "Done.",
  });
  runtime = deriveCapabilityRuntimeMap(base, [started, completed]);
  assert.equal(runtime.ops.state, "READY");
  assert.equal(runtime.ops.detail, "Ops ready");
});
test("Phase 14D1 concurrent definition mutations are serialized", async () => {
  await withStore(async () => {
    await Promise.all([
      upsertAutomationDefinition(
        {
          id: "parallel-a",
          title: "Parallel A",
          goal: "Read-only task A.",
          schedule: {
            kind: "once",
            runAt: "2026-09-21T08:00:00.000Z",
          },
          requiredPermissionLevel: 1,
          maxRuntimeMs: 60_000,
        },
        new Date("2026-09-20T13:00:00.000Z"),
      ),
      upsertAutomationDefinition(
        {
          id: "parallel-b",
          title: "Parallel B",
          goal: "Read-only task B.",
          schedule: {
            kind: "once",
            runAt: "2026-09-21T09:00:00.000Z",
          },
          requiredPermissionLevel: 1,
          maxRuntimeMs: 60_000,
        },
        new Date("2026-09-20T13:00:01.000Z"),
      ),
    ]);

    const third = await upsertAutomationDefinition(
      {
        id: "parallel-c",
        title: "Parallel C",
        goal: "Read-only task C.",
        schedule: {
          kind: "once",
          runAt: "2026-09-21T10:00:00.000Z",
        },
        requiredPermissionLevel: 1,
        maxRuntimeMs: 60_000,
      },
      new Date("2026-09-20T13:00:02.000Z"),
    );

    assert.equal(third.count, 3);
  });
});
