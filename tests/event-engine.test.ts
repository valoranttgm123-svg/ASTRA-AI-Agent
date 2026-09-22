import assert from "node:assert/strict";
import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import type {
  AstraEventSubscription,
  AstraIncomingEvent,
} from "../lib/events/contracts";
import {
  evaluateIncomingEvent,
  isWithinQuietHours,
} from "../lib/events/engine";
import { parseEventMutation } from "../lib/events/http";
import {
  acknowledgeEvent,
  publishIncomingEvent,
  setEventSubscriptionStatus,
  upsertEventSubscription,
} from "../lib/events/management";
import {
  loadEventStore,
  saveEventStore,
} from "../lib/events/store";

const originalEventFile = process.env.ASTRA_EVENT_FILE;

afterEach(() => {
  if (originalEventFile === undefined) {
    delete process.env.ASTRA_EVENT_FILE;
  } else {
    process.env.ASTRA_EVENT_FILE = originalEventFile;
  }
});

function subscription(
  overrides: Partial<AstraEventSubscription> = {},
): AstraEventSubscription {
  return {
    id: "github-ci",
    source: "github",
    topic: "ci",
    status: "enabled",
    severityFloor: "info",
    deliveryPolicy: "notify",
    debounceMs: 0,
    dedupeWindowMs: 60_000,
    rateLimitPerHour: 10,
    allowCriticalDuringQuietHours: false,
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
    ...overrides,
  };
}

function incoming(
  overrides: Partial<AstraIncomingEvent> = {},
): AstraIncomingEvent {
  return {
    source: "github",
    topic: "ci",
    key: "run-42",
    title: "ASTRA CI failed",
    severity: "error",
    occurredAt: "2026-09-22T06:00:00.000Z",
    ...overrides,
  };
}

test("Phase 24 delivers only matching enabled subscriptions above severity floor", () => {
  const result = evaluateIncomingEvent({
    event: incoming(),
    subscriptions: [
      subscription(),
      subscription({
        id: "disabled",
        status: "disabled",
      }),
      subscription({
        id: "critical-only",
        severityFloor: "critical",
      }),
      subscription({
        id: "other-topic",
        topic: "release",
      }),
    ],
    recentEvents: [],
    now: new Date("2026-09-22T06:00:01.000Z"),
  });

  assert.equal(result.matchedSubscriptions, 1);
  assert.equal(result.deliverable.length, 1);
  assert.equal(result.deliverable[0].subscriptionId, "github-ci");
  assert.equal(result.deliverable[0].disposition, "delivered");
});

test("Phase 24 deduplicates the same event key inside the configured window", () => {
  const first = evaluateIncomingEvent({
    event: incoming(),
    subscriptions: [subscription()],
    recentEvents: [],
    now: new Date("2026-09-22T06:00:01.000Z"),
  });

  const second = evaluateIncomingEvent({
    event: incoming({ occurredAt: "2026-09-22T06:00:10.000Z" }),
    subscriptions: [subscription()],
    recentEvents: first.records,
    now: new Date("2026-09-22T06:00:10.000Z"),
  });

  assert.equal(second.records[0].disposition, "suppressed_duplicate");
  assert.equal(second.deliverable.length, 0);
});

test("Phase 24 debounce suppresses different keys arriving too quickly", () => {
  const configured = subscription({
    dedupeWindowMs: 0,
    debounceMs: 30_000,
  });
  const first = evaluateIncomingEvent({
    event: incoming({ key: "run-a" }),
    subscriptions: [configured],
    recentEvents: [],
    now: new Date("2026-09-22T06:00:01.000Z"),
  });

  const second = evaluateIncomingEvent({
    event: incoming({
      key: "run-b",
      occurredAt: "2026-09-22T06:00:10.000Z",
    }),
    subscriptions: [configured],
    recentEvents: first.records,
    now: new Date("2026-09-22T06:00:10.000Z"),
  });

  assert.equal(second.records[0].disposition, "suppressed_debounce");
});

test("quiet hours support overnight windows and explicit critical override", () => {
  const quiet = {
    startMinuteOfDay: 22 * 60,
    endMinuteOfDay: 7 * 60,
    timezoneOffsetMinutes: 0,
  };
  assert.equal(
    isWithinQuietHours(Date.parse("2026-09-22T23:00:00.000Z"), quiet),
    true,
  );
  assert.equal(
    isWithinQuietHours(Date.parse("2026-09-22T12:00:00.000Z"), quiet),
    false,
  );

  const blocked = evaluateIncomingEvent({
    event: incoming({ severity: "critical" }),
    subscriptions: [subscription({ quietHours: quiet })],
    recentEvents: [],
    now: new Date("2026-09-22T23:00:00.000Z"),
  });
  assert.equal(
    blocked.records[0].disposition,
    "suppressed_quiet_hours",
  );

  const allowed = evaluateIncomingEvent({
    event: incoming({ severity: "critical" }),
    subscriptions: [
      subscription({
        quietHours: quiet,
        allowCriticalDuringQuietHours: true,
      }),
    ],
    recentEvents: [],
    now: new Date("2026-09-22T23:00:00.000Z"),
  });
  assert.equal(allowed.records[0].disposition, "delivered");
});

test("rate limit suppresses additional hourly notifications", () => {
  const configured = subscription({
    dedupeWindowMs: 0,
    debounceMs: 0,
    rateLimitPerHour: 1,
  });
  const first = evaluateIncomingEvent({
    event: incoming({ key: "run-a" }),
    subscriptions: [configured],
    recentEvents: [],
    now: new Date("2026-09-22T06:00:01.000Z"),
  });

  const second = evaluateIncomingEvent({
    event: incoming({
      key: "run-b",
      occurredAt: "2026-09-22T06:10:00.000Z",
    }),
    subscriptions: [configured],
    recentEvents: first.records,
    now: new Date("2026-09-22T06:10:00.000Z"),
  });

  assert.equal(second.records[0].disposition, "suppressed_rate_limit");
});

test("record-only subscriptions never become proactive notifications", () => {
  const result = evaluateIncomingEvent({
    event: incoming(),
    subscriptions: [
      subscription({
        deliveryPolicy: "record_only",
      }),
    ],
    recentEvents: [],
    now: new Date("2026-09-22T06:00:01.000Z"),
  });

  assert.equal(result.records[0].disposition, "recorded");
  assert.equal(result.deliverable.length, 0);
});

test("Event Engine parser validates bounded subscription and publish mutations", () => {
  const upsert = parseEventMutation({
    action: "upsert",
    subscription: {
      id: "github-ci",
      source: "github",
      topic: "ci",
      severityFloor: "warning",
      deliveryPolicy: "notify",
      debounceMs: 1000,
      dedupeWindowMs: 5000,
      rateLimitPerHour: 5,
      allowCriticalDuringQuietHours: true,
    },
  });
  assert.equal(upsert.action, "upsert");

  const publish = parseEventMutation({
    action: "publish",
    event: incoming(),
  });
  assert.equal(publish.action, "publish");

  assert.throws(
    () =>
      parseEventMutation({
        action: "upsert",
        subscription: {
          id: "bad",
          source: "github",
          topic: "ci",
          severityFloor: "warning",
          deliveryPolicy: "notify",
          debounceMs: -1,
          dedupeWindowMs: 0,
          rateLimitPerHour: 5,
        },
      }),
    /outside its allowed range/i,
  );
});

test("private Event Engine store persists subscriptions, events, and acknowledgement", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-events-"));
  process.env.ASTRA_EVENT_FILE = path.join(root, "events.json");

  await upsertEventSubscription(
    {
      id: "github-ci",
      source: "github",
      topic: "ci",
      status: "disabled",
      severityFloor: "warning",
      deliveryPolicy: "notify",
      debounceMs: 0,
      dedupeWindowMs: 60_000,
      rateLimitPerHour: 5,
    },
    new Date("2026-09-22T05:00:00.000Z"),
  );

  let loaded = await loadEventStore();
  assert.equal(loaded.available, true);
  assert.equal(loaded.store.subscriptions[0].status, "disabled");

  await setEventSubscriptionStatus(
    "github-ci",
    "enabled",
    new Date("2026-09-22T05:01:00.000Z"),
  );

  const published = await publishIncomingEvent(
    incoming(),
    new Date("2026-09-22T06:00:01.000Z"),
  );
  assert.equal(published.deliverable.length, 1);

  await acknowledgeEvent(
    published.deliverable[0].id,
    new Date("2026-09-22T06:01:00.000Z"),
  );

  loaded = await loadEventStore();
  assert.equal(loaded.store.events.length, 1);
  assert.equal(
    loaded.store.events[0].acknowledgedAt,
    "2026-09-22T06:01:00.000Z",
  );
});

test("Event Engine store rejects symbolic-link targets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-event-link-"));
  const target = path.join(root, "target.json");
  const linked = path.join(root, "events.json");
  await writeFile(
    target,
    JSON.stringify({
      schemaVersion: 1,
      subscriptions: [],
      events: [],
    }),
    "utf8",
  );
  await symlink(target, linked);
  process.env.ASTRA_EVENT_FILE = linked;

  const loaded = await loadEventStore();
  assert.equal(loaded.available, false);
  assert.match(loaded.detail, /symbolic link/i);
});

test("Event Engine store rejects malformed duplicate subscription ids", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-event-bad-"));
  process.env.ASTRA_EVENT_FILE = path.join(root, "events.json");

  await assert.rejects(
    saveEventStore({
      schemaVersion: 1,
      subscriptions: [
        subscription({ id: "same" }),
        subscription({ id: "SAME" }),
      ],
      events: [],
    }),
    /duplicate event engine subscription id/i,
  );
});
