import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AstraAutomationService,
  getAutomationServiceConfig,
} from "../lib/automation/service";
import type { AstraAutomationTickResult } from "../lib/automation/runner";
import { automationEventToBrainEvent } from "../lib/automation/telemetry";

function tickResult(
  overrides: Partial<AstraAutomationTickResult> = {},
): AstraAutomationTickResult {
  return {
    source: ".astra/automations.json",
    available: true,
    detail: "fixture tick complete",
    waitingApproval: [],
    runs: [],
    stopped: false,
    ...overrides,
  };
}

test("Phase 14E2 service is OFF by default and poll config is bounded", () => {
  const previousEnabled = process.env.ASTRA_AUTOMATION_SERVICE_ENABLED;
  const previousPoll = process.env.ASTRA_AUTOMATION_SERVICE_POLL_MS;

  try {
    delete process.env.ASTRA_AUTOMATION_SERVICE_ENABLED;
    delete process.env.ASTRA_AUTOMATION_SERVICE_POLL_MS;
    let config = getAutomationServiceConfig();
    assert.equal(config.enabled, false);
    assert.equal(config.pollIntervalMs, 60_000);

    process.env.ASTRA_AUTOMATION_SERVICE_ENABLED = "true";
    process.env.ASTRA_AUTOMATION_SERVICE_POLL_MS = "1";
    config = getAutomationServiceConfig();
    assert.equal(config.enabled, true);
    assert.equal(config.pollIntervalMs, 15_000);

    process.env.ASTRA_AUTOMATION_SERVICE_POLL_MS = "9999999";
    config = getAutomationServiceConfig();
    assert.equal(config.pollIntervalMs, 300_000);
  } finally {
    if (previousEnabled === undefined) {
      delete process.env.ASTRA_AUTOMATION_SERVICE_ENABLED;
    } else {
      process.env.ASTRA_AUTOMATION_SERVICE_ENABLED = previousEnabled;
    }

    if (previousPoll === undefined) {
      delete process.env.ASTRA_AUTOMATION_SERVICE_POLL_MS;
    } else {
      process.env.ASTRA_AUTOMATION_SERVICE_POLL_MS = previousPoll;
    }
  }
});

test("Phase 14E2 disabled service cannot start or tick", async () => {
  let calls = 0;
  const service = new AstraAutomationService({
    enabled: false,
    pollIntervalMs: 60_000,
    async tick() {
      calls += 1;
      return tickResult();
    },
  });

  assert.equal(service.start(), false);
  assert.equal(await service.tickNow(), null);
  assert.equal(calls, 0);

  const status = service.getStatus();
  assert.equal(status.enabled, false);
  assert.equal(status.running, false);
  assert.equal(status.tickActive, false);
});

test("Phase 14E2 service coalesces overlapping ticks and publishes real lifecycle", async () => {
  let calls = 0;
  let release!: () => void;
  let started!: () => void;

  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const didStart = new Promise<void>((resolve) => {
    started = resolve;
  });

  const service = new AstraAutomationService({
    enabled: true,
    pollIntervalMs: 60_000,
    async tick({ onEvent }) {
      calls += 1;
      onEvent({
        type: "automation.started",
        automationId: "fixture",
        at: "2026-09-20T14:00:00.000Z",
        scheduledFor: "2026-09-20T14:00:00.000Z",
        detail: "fixture started",
      });
      started();
      await gate;
      onEvent({
        type: "automation.completed",
        automationId: "fixture",
        at: "2026-09-20T14:00:01.000Z",
        scheduledFor: "2026-09-20T14:00:00.000Z",
        detail: "fixture completed",
      });
      return tickResult({
        runs: [
          {
            automationId: "fixture",
            scheduledFor: "2026-09-20T14:00:00.000Z",
            status: "completed",
            detail: "fixture completed",
          },
        ],
      });
    },
  });

  const seen: string[] = [];
  service.subscribe((event) => seen.push(event.type));

  const first = service.tickNow();
  await didStart;
  const second = service.tickNow();

  assert.equal(calls, 1);
  assert.equal(service.getStatus().tickActive, true);

  release();
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(firstResult?.runs.length, 1);
  assert.equal(secondResult?.runs.length, 1);
  assert.equal(calls, 1);
  assert.deepEqual(seen, [
    "automation.started",
    "automation.completed",
  ]);

  const status = service.getStatus();
  assert.equal(status.tickActive, false);
  assert.equal(status.lastSummary?.completed, 1);
  assert.equal(status.recentEvents.length, 2);
});

test("Phase 14E2 server-side STOP aborts the active tick", async () => {
  let started!: () => void;
  const didStart = new Promise<void>((resolve) => {
    started = resolve;
  });

  const service = new AstraAutomationService({
    enabled: true,
    pollIntervalMs: 60_000,
    async tick({ signal }) {
      started();
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          reject(
            signal.reason instanceof Error
              ? signal.reason
              : new DOMException("cancelled", "AbortError"),
          );
        };
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      });
      return tickResult();
    },
  });

  const active = service.tickNow();
  await didStart;
  assert.equal(service.stopActive(), true);

  const result = await active;
  assert.equal(result, null);
  assert.equal(service.getStatus().tickActive, false);
  assert.match(service.getStatus().lastDetail, /cancelled|STOP/i);
});

test("Phase 14E2 enabled service can start and stop without leaving a timer active", () => {
  const service = new AstraAutomationService({
    enabled: true,
    pollIntervalMs: 60_000,
    async tick() {
      return tickResult();
    },
  });

  assert.equal(service.start(), true);
  assert.equal(service.getStatus().running, true);
  assert.ok(service.getStatus().nextTickAt);

  service.stop();
  assert.equal(service.getStatus().running, false);
  assert.equal(service.getStatus().nextTickAt, undefined);
});

test("Phase 14E2 repeated lifecycle events receive distinct Brain ids", () => {
  const first = automationEventToBrainEvent({
    type: "automation.waiting_approval",
    automationId: "external",
    scheduledFor: "2026-09-20T14:00:00.000Z",
    at: "2026-09-20T14:00:01.000Z",
    detail: "first",
  });
  const second = automationEventToBrainEvent({
    type: "automation.waiting_approval",
    automationId: "external",
    scheduledFor: "2026-09-20T14:00:00.000Z",
    at: "2026-09-20T14:00:02.000Z",
    detail: "second",
  });

  assert.notEqual(first.id, second.id);
  assert.equal(first.visualNode, "ops");
  assert.equal(second.visualNode, "ops");
});
