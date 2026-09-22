import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import {
  attachAutomationLifecycleEventBridge,
  automationLifecycleEventToIncomingEvent,
  getAutomationLifecycleEventBridgeStatus,
} from "../lib/events/automation-lifecycle";
import { AstraAutomationService } from "../lib/automation/service";
import type { AstraAutomationTickResult } from "../lib/automation/runner";
import type { AstraIncomingEvent } from "../lib/events/contracts";
import {
  publishIncomingEvent,
  upsertEventSubscription,
} from "../lib/events/management";
import { loadEventStore } from "../lib/events/store";

const originalEventFile = process.env.ASTRA_EVENT_FILE;

afterEach(() => {
  if (originalEventFile === undefined) {
    delete process.env.ASTRA_EVENT_FILE;
  } else {
    process.env.ASTRA_EVENT_FILE = originalEventFile;
  }
});

function tickResult(): AstraAutomationTickResult {
  return {
    source: ".astra/automations.json",
    available: true,
    detail: "fixture complete",
    waitingApproval: [],
    runs: [],
    stopped: false,
  };
}

test("automation lifecycle maps to stable Event Engine identity and severity", () => {
  const base = {
    automationId: "daily-report",
    scheduledFor: "2026-09-22T12:00:00.000Z",
    detail: "api_key=must-not-leak",
  };

  const first = automationLifecycleEventToIncomingEvent({
    ...base,
    type: "automation.failed",
    at: "2026-09-22T12:00:01.000Z",
  });
  const repeated = automationLifecycleEventToIncomingEvent({
    ...base,
    type: "automation.failed",
    at: "2026-09-22T12:00:02.000Z",
  });

  assert.equal(first.source, "automation");
  assert.equal(first.topic, "automation.failed");
  assert.equal(first.severity, "error");
  assert.equal(first.key, repeated.key);
  assert.equal(first.metadata?.automationId, "daily-report");
  assert.equal(
    first.metadata?.scheduledFor,
    "2026-09-22T12:00:00.000Z",
  );
  assert.doesNotMatch(first.detail ?? "", /must-not-leak/);
  assert.match(first.detail ?? "", /redacted/i);

  const waiting = automationLifecycleEventToIncomingEvent({
    ...base,
    type: "automation.waiting_approval",
    at: "2026-09-22T12:00:03.000Z",
  });
  assert.equal(waiting.severity, "warning");

  const completed = automationLifecycleEventToIncomingEvent({
    ...base,
    type: "automation.completed",
    at: "2026-09-22T12:00:04.000Z",
  });
  assert.equal(completed.severity, "info");
});

test("automation bridge attaches once and publishes real lifecycle without changing execution", async () => {
  const published: AstraIncomingEvent[] = [];
  const service = new AstraAutomationService({
    enabled: true,
    pollIntervalMs: 60_000,
    async tick({ onEvent }) {
      onEvent({
        type: "automation.started",
        automationId: "fixture",
        at: "2026-09-22T12:10:00.000Z",
        scheduledFor: "2026-09-22T12:10:00.000Z",
        detail: "fixture started",
      });
      onEvent({
        type: "automation.completed",
        automationId: "fixture",
        at: "2026-09-22T12:10:01.000Z",
        scheduledFor: "2026-09-22T12:10:00.000Z",
        detail: "fixture complete",
      });
      return tickResult();
    },
  });

  const publisher = async (event: AstraIncomingEvent) => {
    published.push(event);
    return {
      matchedSubscriptions: 1,
      records: [],
      deliverable: [],
    };
  };

  assert.equal(
    attachAutomationLifecycleEventBridge(service, publisher),
    true,
  );
  assert.equal(
    attachAutomationLifecycleEventBridge(service, publisher),
    false,
  );

  const result = await service.tickNow();
  assert.equal(result?.available, true);

  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(
    published.map((event) => event.topic),
    ["automation.started", "automation.completed"],
  );

  const status = getAutomationLifecycleEventBridgeStatus(service);
  assert.equal(status.attached, true);
  assert.equal(status.observed, 2);
  assert.equal(status.matchedSubscriptions, 2);
  assert.equal(status.publishFailures, 0);
  assert.equal(status.lastEventType, "automation.completed");
});

test("Event Engine publication failure is isolated from automation and redacted", async () => {
  const service = new AstraAutomationService({
    enabled: true,
    pollIntervalMs: 60_000,
    async tick({ onEvent }) {
      onEvent({
        type: "automation.cancelled",
        automationId: "fixture",
        at: "2026-09-22T12:20:01.000Z",
        scheduledFor: "2026-09-22T12:20:00.000Z",
        detail: "cancelled by STOP",
      });
      return tickResult();
    },
  });

  attachAutomationLifecycleEventBridge(
    service,
    async () => {
      throw new Error("api_key=bridge-secret");
    },
  );

  const result = await service.tickNow();
  assert.equal(result?.available, true);

  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  const status = getAutomationLifecycleEventBridgeStatus(service);
  assert.equal(status.observed, 1);
  assert.equal(status.publishFailures, 1);
  assert.doesNotMatch(status.lastError ?? "", /bridge-secret/);
  assert.match(status.lastError ?? "", /redacted/i);
});


test("automation lifecycle bridge persists through canonical Event Engine subscription", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "astra-automation-events-"),
  );
  process.env.ASTRA_EVENT_FILE = path.join(root, "events.json");

  await upsertEventSubscription(
    {
      id: "automation-lifecycle",
      source: "automation",
      topic: "*",
      status: "enabled",
      severityFloor: "info",
      deliveryPolicy: "notify",
      debounceMs: 0,
      dedupeWindowMs: 60_000,
      rateLimitPerHour: 120,
    },
    new Date("2020-01-01T00:00:00.000Z"),
  );

  const service = new AstraAutomationService({
    enabled: true,
    pollIntervalMs: 60_000,
    async tick({ onEvent }) {
      onEvent({
        type: "automation.failed",
        automationId: "fixture",
        at: "2020-01-01T00:00:01.000Z",
        scheduledFor: "2020-01-01T00:00:00.000Z",
        detail: "fixture failure",
      });
      return tickResult();
    },
  });

  let published!: () => void;
  const didPublish = new Promise<void>((resolve) => {
    published = resolve;
  });

  attachAutomationLifecycleEventBridge(
    service,
    async (event) => {
      const result = await publishIncomingEvent(event);
      published();
      return result;
    },
  );
  await service.tickNow();
  await didPublish;

  const loaded = await loadEventStore();
  assert.equal(loaded.available, true);
  assert.equal(loaded.store.events.length, 1);
  assert.equal(loaded.store.events[0].source, "automation");
  assert.equal(loaded.store.events[0].topic, "automation.failed");
  assert.equal(loaded.store.events[0].severity, "error");
  assert.equal(loaded.store.events[0].disposition, "delivered");
  assert.equal(
    loaded.store.events[0].metadata?.automationId,
    "fixture",
  );
});
