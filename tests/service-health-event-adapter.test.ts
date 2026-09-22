import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import type {
  AstraDiagnosticsSnapshot,
  AstraHealthSample,
  AstraHealthStatus,
} from "../lib/diagnostics/contracts";
import {
  getServiceHealthEventStatus,
  healthSampleToEvent,
  syncServiceHealthEvents,
} from "../lib/events/service-health";
import { upsertEventSubscription } from "../lib/events/management";
import { loadEventStore } from "../lib/events/store";

const originalEventFile = process.env.ASTRA_EVENT_FILE;

afterEach(() => {
  if (originalEventFile === undefined) {
    delete process.env.ASTRA_EVENT_FILE;
  } else {
    process.env.ASTRA_EVENT_FILE = originalEventFile;
  }
});

function healthSample(
  status: AstraHealthStatus,
  checkedAt = "2026-09-22T11:30:00.000Z",
): AstraHealthSample {
  return {
    id: "provider.ollama",
    category: "provider",
    status,
    critical: false,
    checkedAt,
    detail: "Ollama health is " + status + ".",
    latencyMs: 12,
  };
}

function snapshot(
  status: AstraHealthStatus,
  capturedAt = "2026-09-22T11:30:00.000Z",
): AstraDiagnosticsSnapshot {
  const sample = healthSample(status, capturedAt);
  const count = (candidate: AstraHealthStatus) =>
    candidate === status ? 1 : 0;

  return {
    capturedAt,
    connectivity: "unknown",
    operatingMode:
      status === "unavailable" || status === "degraded"
        ? "degraded"
        : "unknown",
    samples: [sample],
    healthy: count("healthy"),
    degraded: count("degraded"),
    unavailable: count("unavailable"),
    notConfigured: count("not_configured"),
    unknown: count("unknown"),
  };
}

test("service health samples map to bounded Event Engine events", () => {
  const failed = healthSampleToEvent(healthSample("unavailable"));
  assert.equal(failed.source, "service");
  assert.equal(failed.topic, "health.state");
  assert.equal(failed.severity, "error");
  assert.equal(failed.metadata?.healthId, "provider.ollama");
  assert.equal(failed.metadata?.status, "unavailable");

  const recovered = healthSampleToEvent(healthSample("healthy"));
  assert.equal(recovered.severity, "info");

  const unknown = healthSampleToEvent(healthSample("unknown"));
  assert.equal(unknown.severity, "warning");
});

test("service health status reports real diagnostics capture without claiming internet connectivity", async () => {
  const status = await getServiceHealthEventStatus({
    now: new Date("2026-09-22T11:30:00.000Z"),
    capture: async () => snapshot("unavailable"),
  });

  assert.equal(status.available, true);
  assert.equal(status.sampleCount, 1);
  assert.equal(status.unhealthy, 1);
  assert.equal(
    status.capturedAt,
    "2026-09-22T11:30:00.000Z",
  );
  assert.doesNotMatch(status.detail, /internet|online/i);
});

test("healthy initial state is quiet but failure and recovery transitions are recorded", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "astra-service-health-"),
  );
  process.env.ASTRA_EVENT_FILE = path.join(root, "events.json");

  await upsertEventSubscription(
    {
      id: "service-health",
      source: "service",
      topic: "health.state",
      status: "enabled",
      severityFloor: "info",
      deliveryPolicy: "notify",
      debounceMs: 0,
      dedupeWindowMs: 0,
      rateLimitPerHour: 50,
    },
    new Date("2026-09-22T11:00:00.000Z"),
  );

  const baseline = await syncServiceHealthEvents({
    now: new Date("2026-09-22T11:10:00.000Z"),
    capture: async () =>
      snapshot("healthy", "2026-09-22T11:10:00.000Z"),
  });
  assert.equal(baseline.skippedBaseline, 1);
  assert.equal(baseline.records, 0);

  const failure = await syncServiceHealthEvents({
    now: new Date("2026-09-22T11:20:00.000Z"),
    capture: async () =>
      snapshot("unavailable", "2026-09-22T11:20:00.000Z"),
  });
  assert.equal(failure.records, 1);
  assert.equal(failure.deliverable, 1);

  const unchanged = await syncServiceHealthEvents({
    now: new Date("2026-09-22T11:21:00.000Z"),
    capture: async () =>
      snapshot("unavailable", "2026-09-22T11:21:00.000Z"),
  });
  assert.equal(unchanged.skippedUnchanged, 1);
  assert.equal(unchanged.records, 0);

  const recovery = await syncServiceHealthEvents({
    now: new Date("2026-09-22T11:30:00.000Z"),
    capture: async () =>
      snapshot("healthy", "2026-09-22T11:30:00.000Z"),
  });
  assert.equal(recovery.records, 1);
  assert.equal(recovery.deliverable, 1);

  const loaded = await loadEventStore();
  assert.equal(loaded.store.events.length, 2);
  assert.equal(
    loaded.store.events[0].metadata?.status,
    "unavailable",
  );
  assert.equal(
    loaded.store.events[1].metadata?.status,
    "healthy",
  );
});

test("service health status failures are redacted and sync respects cancellation", async () => {
  const status = await getServiceHealthEventStatus({
    capture: async () => {
      throw new Error("api_key=service-health-secret");
    },
  });
  assert.equal(status.available, false);
  assert.doesNotMatch(status.detail, /service-health-secret/);

  const controller = new AbortController();
  controller.abort(new DOMException("stop", "AbortError"));
  await assert.rejects(
    syncServiceHealthEvents({
      signal: controller.signal,
      capture: async ({ signal }) => {
        signal?.throwIfAborted();
        return snapshot("unavailable");
      },
    }),
    /stop|abort/i,
  );
});
