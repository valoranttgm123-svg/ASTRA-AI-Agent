import assert from "node:assert/strict";
import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import {
  appendAuditEntry,
  loadAuditStore,
  queryAuditEntries,
  saveAuditStore,
} from "../lib/diagnostics/audit";
import type { AstraHealthSample } from "../lib/diagnostics/contracts";
import { AstraHealthRegistry } from "../lib/diagnostics/health";
import { planSafeRecovery } from "../lib/diagnostics/recovery";
import { createLocalDiagnosticsRegistry } from "../lib/diagnostics/runtime";

const originalAuditFile = process.env.ASTRA_AUDIT_FILE;
const originalEventFile = process.env.ASTRA_EVENT_FILE;
const originalTaskFile = process.env.ASTRA_TASK_FILE;
const originalAutomationFile = process.env.ASTRA_AUTOMATION_FILE;

afterEach(() => {
  const restore = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  restore("ASTRA_AUDIT_FILE", originalAuditFile);
  restore("ASTRA_EVENT_FILE", originalEventFile);
  restore("ASTRA_TASK_FILE", originalTaskFile);
  restore("ASTRA_AUTOMATION_FILE", originalAutomationFile);
});

test("health registry reports online only from explicit online connectivity and healthy checks", async () => {
  const registry = new AstraHealthRegistry().register({
    id: "runtime.local",
    category: "runtime",
    critical: true,
    check: async () => ({
      status: "healthy",
      detail: "Local runtime responded.",
      latencyMs: 4,
    }),
  });

  const online = await registry.capture({
    connectivity: "online",
    now: new Date("2026-09-22T08:30:00.000Z"),
  });
  assert.equal(online.operatingMode, "online");
  assert.equal(online.healthy, 1);

  const unknown = await registry.capture({
    connectivity: "unknown",
    now: new Date("2026-09-22T08:30:00.000Z"),
  });
  assert.equal(unknown.operatingMode, "unknown");
});

test("offline connectivity is explicit and local failures degrade without inventing offline", async () => {
  const registry = new AstraHealthRegistry().register({
    id: "memory.local",
    category: "memory",
    critical: true,
    check: async () => ({
      status: "unavailable",
      detail: "Memory unavailable.",
    }),
  });

  const degraded = await registry.capture({
    connectivity: "online",
    now: new Date("2026-09-22T08:30:00.000Z"),
  });
  assert.equal(degraded.operatingMode, "degraded");

  const offline = await registry.capture({
    connectivity: "offline",
    now: new Date("2026-09-22T08:30:00.000Z"),
  });
  assert.equal(offline.operatingMode, "offline");
});

test("health check errors become unavailable but cancellation propagates", async () => {
  const failing = new AstraHealthRegistry().register({
    id: "provider.test",
    category: "provider",
    critical: false,
    check: async () => {
      throw new Error("api_key=super-secret");
    },
  });
  const result = await failing.capture({
    connectivity: "unknown",
    now: new Date("2026-09-22T08:30:00.000Z"),
  });
  assert.equal(result.samples[0].status, "unavailable");
  assert.doesNotMatch(result.samples[0].detail, /super-secret/);

  const controller = new AbortController();
  controller.abort(new DOMException("stop", "AbortError"));
  await assert.rejects(
    failing.capture({ signal: controller.signal }),
    /stop|abort/i,
  );
});

test("recovery planner never executes and keeps approval boundaries", () => {
  const sample: AstraHealthSample = {
    id: "worker.tasks",
    category: "worker",
    status: "degraded",
    critical: false,
    checkedAt: "2026-09-22T08:30:00.000Z",
    detail: "Worker stalled.",
  };

  const plans = planSafeRecovery({
    sample,
    supportedActions: [
      "retry_worker",
      "restart_astra_service",
      "retry_worker",
    ],
  });
  assert.equal(plans.length, 2);
  assert.equal(plans[0].executable, false);
  assert.equal(plans[0].permissionLevel, 1);
  assert.equal(plans[0].requiresApproval, false);
  assert.equal(plans[1].permissionLevel, 2);
  assert.equal(plans[1].requiresApproval, true);
});

test("audit journal redacts sensitive material and supports bounded history queries", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-audit-"));
  process.env.ASTRA_AUDIT_FILE = path.join(root, "audit.json");

  const first = await appendAuditEntry(
    {
      category: "tool",
      actor: { kind: "system", id: "astra" },
      action: "provider.check",
      projectId: "astra",
      permissionLevel: 1,
      outcome: "failure",
      detail: "authorization: Bearer abcdefghijklmnop",
      failure: "api_key=top-secret",
    },
    new Date("2026-09-22T08:31:00.000Z"),
  );
  assert.doesNotMatch(first.detail, /abcdefghijklmnop/);
  assert.doesNotMatch(first.failure ?? "", /top-secret/);

  await appendAuditEntry(
    {
      category: "system",
      actor: { kind: "system", id: "astra" },
      action: "health.capture",
      outcome: "success",
      detail: "Health snapshot captured.",
    },
    new Date("2026-09-22T08:32:00.000Z"),
  );

  const loaded = await loadAuditStore();
  assert.equal(loaded.available, true);
  assert.equal(loaded.store.entries.length, 2);

  const failures = queryAuditEntries({
    entries: loaded.store.entries,
    outcome: "failure",
    limit: 1,
  });
  assert.equal(failures.length, 1);
  assert.equal(failures[0].action, "provider.check");
});

test("audit store rejects symbolic-link targets and malformed duplicate ids", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-audit-link-"));
  const target = path.join(root, "target.json");
  const linked = path.join(root, "audit.json");
  await writeFile(
    target,
    JSON.stringify({ schemaVersion: 1, entries: [] }),
    "utf8",
  );
  await symlink(target, linked);
  process.env.ASTRA_AUDIT_FILE = linked;

  const loaded = await loadAuditStore();
  assert.equal(loaded.available, false);
  assert.match(loaded.detail, /symbolic link/i);

  process.env.ASTRA_AUDIT_FILE = path.join(root, "normal.json");
  const entry = {
    id: "same",
    at: "2026-09-22T08:00:00.000Z",
    category: "system" as const,
    actor: { kind: "system" as const, id: "astra" as const },
    action: "test",
    outcome: "success" as const,
    detail: "ok",
  };
  await assert.rejects(
    saveAuditStore({
      schemaVersion: 1,
      entries: [entry, { ...entry }],
    }),
    /duplicate audit entry id/i,
  );
});

test("local diagnostics registry reads real private stores without claiming internet state", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-diag-"));
  process.env.ASTRA_EVENT_FILE = path.join(root, "events.json");
  process.env.ASTRA_TASK_FILE = path.join(root, "tasks.json");
  process.env.ASTRA_AUTOMATION_FILE = path.join(root, "automations.json");

  const snapshot = await createLocalDiagnosticsRegistry().capture({
    connectivity: "unknown",
    now: new Date("2026-09-22T08:30:00.000Z"),
  });

  assert.equal(snapshot.connectivity, "unknown");
  assert.ok(snapshot.samples.some((sample) => sample.id === "storage.events"));
  assert.ok(snapshot.samples.some((sample) => sample.id === "storage.tasks"));
  assert.ok(
    snapshot.samples.some((sample) => sample.id === "storage.automation"),
  );
});
