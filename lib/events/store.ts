import {
  lstat,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type {
  AstraEventDeliveryPolicy,
  AstraEventQuietHours,
  AstraEventRecord,
  AstraEventSeverity,
  AstraEventSourceKind,
  AstraEventStore,
  AstraEventSubscription,
  AstraEventSubscriptionStatus,
} from "./contracts";

export const ASTRA_EVENT_MAX_SUBSCRIPTIONS = 128;
export const ASTRA_EVENT_MAX_RECORDS = 1024;
export const ASTRA_EVENT_MAX_FILE_BYTES = 2 * 1024 * 1024;

let eventMutationTail: Promise<void> = Promise.resolve();

async function withEventMutationLock<T>(run: () => Promise<T>) {
  const previous = eventMutationTail;
  let release!: () => void;
  eventMutationTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await run();
  } finally {
    release();
  }
}

export function getEventStorePath() {
  const configured = process.env.ASTRA_EVENT_FILE?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".astra", "events.json");
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Event " + field + " must be an object.");
  }
  return value as Record<string, unknown>;
}

function string(
  value: unknown,
  field: string,
  max: number,
): string {
  if (typeof value !== "string") {
    throw new Error("Event " + field + " must be a string.");
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) {
    throw new Error(
      "Event " + field + " must contain 1-" + max + " characters.",
    );
  }
  return cleaned;
}

function optionalString(
  value: unknown,
  field: string,
  max: number,
) {
  if (value === undefined) return undefined;
  return string(value, field, max);
}

function iso(value: unknown, field: string) {
  const raw = string(value, field, 80);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error("Event " + field + " must be a valid timestamp.");
  }
  return new Date(parsed).toISOString();
}

function nonNegativeInteger(
  value: unknown,
  field: string,
  max: number,
) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > max
  ) {
    throw new Error(
      "Event " + field + " must be an integer between 0 and " + max + ".",
    );
  }
  return value;
}

function positiveInteger(
  value: unknown,
  field: string,
  max: number,
) {
  const parsed = nonNegativeInteger(value, field, max);
  if (parsed < 1) {
    throw new Error("Event " + field + " must be at least 1.");
  }
  return parsed;
}

function severity(value: unknown): AstraEventSeverity {
  if (
    value === "info" ||
    value === "warning" ||
    value === "error" ||
    value === "critical"
  ) {
    return value;
  }
  throw new Error("Event severity is invalid.");
}

function source(value: unknown): AstraEventSourceKind {
  if (
    value === "github" ||
    value === "repository" ||
    value === "calendar" ||
    value === "email" ||
    value === "automation" ||
    value === "service" ||
    value === "backup" ||
    value === "business" ||
    value === "custom"
  ) {
    return value;
  }
  throw new Error("Event source is invalid.");
}

function status(value: unknown): AstraEventSubscriptionStatus {
  if (value === "enabled" || value === "disabled") return value;
  throw new Error("Event subscription status is invalid.");
}

function deliveryPolicy(value: unknown): AstraEventDeliveryPolicy {
  if (value === "notify" || value === "record_only") return value;
  throw new Error("Event delivery policy is invalid.");
}

function quietHours(value: unknown): AstraEventQuietHours | undefined {
  if (value === undefined) return undefined;
  const source = record(value, "quietHours");
  const startMinuteOfDay = nonNegativeInteger(
    source.startMinuteOfDay,
    "quietHours.startMinuteOfDay",
    1439,
  );
  const endMinuteOfDay = nonNegativeInteger(
    source.endMinuteOfDay,
    "quietHours.endMinuteOfDay",
    1439,
  );
  const timezoneOffsetMinutes =
    typeof source.timezoneOffsetMinutes === "number" &&
    Number.isInteger(source.timezoneOffsetMinutes) &&
    source.timezoneOffsetMinutes >= -840 &&
    source.timezoneOffsetMinutes <= 840
      ? source.timezoneOffsetMinutes
      : (() => {
          throw new Error(
            "Event quietHours.timezoneOffsetMinutes must be between -840 and 840.",
          );
        })();
  return {
    startMinuteOfDay,
    endMinuteOfDay,
    timezoneOffsetMinutes,
  };
}

function metadata(value: unknown): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  const source = record(value, "metadata");
  const entries = Object.entries(source);
  if (entries.length > 24) {
    throw new Error("Event metadata exceeds 24 entries.");
  }
  const result: Record<string, string> = {};
  for (const [key, raw] of entries) {
    if (key.length < 1 || key.length > 80 || typeof raw !== "string") {
      throw new Error("Event metadata is invalid.");
    }
    const cleaned = raw.trim();
    if (cleaned.length > 400) {
      throw new Error("Event metadata value is too long.");
    }
    result[key] = cleaned;
  }
  return result;
}

function normalizeSubscription(
  value: unknown,
  index: number,
): AstraEventSubscription {
  const item = record(value, "subscription " + (index + 1));
  return {
    id: string(item.id, "subscription.id", 120),
    source: source(item.source),
    topic: string(item.topic, "subscription.topic", 160),
    projectId: optionalString(
      item.projectId,
      "subscription.projectId",
      120,
    ),
    status: status(item.status),
    severityFloor: severity(item.severityFloor),
    deliveryPolicy: deliveryPolicy(item.deliveryPolicy),
    debounceMs: nonNegativeInteger(
      item.debounceMs,
      "subscription.debounceMs",
      24 * 60 * 60_000,
    ),
    dedupeWindowMs: nonNegativeInteger(
      item.dedupeWindowMs,
      "subscription.dedupeWindowMs",
      7 * 24 * 60 * 60_000,
    ),
    rateLimitPerHour: positiveInteger(
      item.rateLimitPerHour,
      "subscription.rateLimitPerHour",
      120,
    ),
    quietHours: quietHours(item.quietHours),
    allowCriticalDuringQuietHours:
      item.allowCriticalDuringQuietHours === true,
    createdAt: iso(item.createdAt, "subscription.createdAt"),
    updatedAt: iso(item.updatedAt, "subscription.updatedAt"),
  };
}

function disposition(value: unknown): AstraEventRecord["disposition"] {
  if (
    value === "delivered" ||
    value === "recorded" ||
    value === "suppressed_debounce" ||
    value === "suppressed_duplicate" ||
    value === "suppressed_quiet_hours" ||
    value === "suppressed_rate_limit"
  ) {
    return value;
  }
  throw new Error("Event disposition is invalid.");
}

function normalizeEvent(
  value: unknown,
  index: number,
): AstraEventRecord {
  const item = record(value, "record " + (index + 1));
  return {
    id: string(item.id, "record.id", 160),
    subscriptionId: string(
      item.subscriptionId,
      "record.subscriptionId",
      120,
    ),
    source: source(item.source),
    topic: string(item.topic, "record.topic", 160),
    key: string(item.key, "record.key", 240),
    dedupeKey: string(item.dedupeKey, "record.dedupeKey", 160),
    title: string(item.title, "record.title", 240),
    detail: optionalString(item.detail, "record.detail", 2000),
    severity: severity(item.severity),
    occurredAt: iso(item.occurredAt, "record.occurredAt"),
    projectId: optionalString(item.projectId, "record.projectId", 120),
    metadata: metadata(item.metadata),
    disposition: disposition(item.disposition),
    dispositionDetail: string(
      item.dispositionDetail,
      "record.dispositionDetail",
      1000,
    ),
    acknowledgedAt:
      item.acknowledgedAt === undefined
        ? undefined
        : iso(item.acknowledgedAt, "record.acknowledgedAt"),
    createdAt: iso(item.createdAt, "record.createdAt"),
  };
}

export function normalizeEventStore(value: unknown): AstraEventStore {
  const root = record(value, "store");
  if (root.schemaVersion !== 1) {
    throw new Error("Unsupported Event Engine schemaVersion.");
  }
  if (!Array.isArray(root.subscriptions) || !Array.isArray(root.events)) {
    throw new Error("Event Engine store arrays are invalid.");
  }
  if (root.subscriptions.length > ASTRA_EVENT_MAX_SUBSCRIPTIONS) {
    throw new Error("Event Engine subscription limit exceeded.");
  }
  if (root.events.length > ASTRA_EVENT_MAX_RECORDS) {
    throw new Error("Event Engine record limit exceeded.");
  }

  const subscriptions = root.subscriptions.map(normalizeSubscription);
  const events = root.events.map(normalizeEvent);

  const seenSubscriptions = new Set<string>();
  for (const subscription of subscriptions) {
    const key = subscription.id.toLowerCase();
    if (seenSubscriptions.has(key)) {
      throw new Error(
        "Duplicate Event Engine subscription id: " + subscription.id + ".",
      );
    }
    seenSubscriptions.add(key);
  }

  const seenEvents = new Set<string>();
  for (const event of events) {
    if (seenEvents.has(event.id)) {
      throw new Error("Duplicate Event Engine event id: " + event.id + ".");
    }
    seenEvents.add(event.id);
  }

  return {
    schemaVersion: 1,
    subscriptions,
    events,
  };
}

async function rejectSymlinkTarget(source: string) {
  try {
    const info = await lstat(source);
    if (info.isSymbolicLink()) {
      throw new Error("Event Engine store must not be a symbolic link.");
    }
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code !== "ENOENT") throw error;
  }
}

export async function loadEventStore() {
  const source = getEventStorePath();
  try {
    await rejectSymlinkTarget(source);
    const info = await stat(source);
    if (info.size > ASTRA_EVENT_MAX_FILE_BYTES) {
      throw new Error("Event Engine store exceeds its file-size limit.");
    }
    const raw = await readFile(source, "utf8");
    const store = normalizeEventStore(JSON.parse(raw) as unknown);
    return {
      available: true,
      source,
      store,
      detail:
        "Loaded " +
        store.subscriptions.length +
        " event subscriptions and " +
        store.events.length +
        " recent records.",
    };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "ENOENT") {
      return {
        available: true,
        source,
        store: {
          schemaVersion: 1 as const,
          subscriptions: [],
          events: [],
        },
        detail:
          "Event Engine is ready; no private .astra/events.json file exists yet.",
      };
    }
    return {
      available: false,
      source,
      store: {
        schemaVersion: 1 as const,
        subscriptions: [],
        events: [],
      },
      detail:
        error instanceof Error
          ? "Event Engine store could not be loaded safely: " + error.message
          : "Event Engine store could not be loaded safely.",
    };
  }
}

export async function saveEventStore(store: AstraEventStore) {
  const normalized = normalizeEventStore(
    JSON.parse(JSON.stringify(store)) as unknown,
  );
  const source = getEventStorePath();
  const payload = JSON.stringify(normalized, null, 2) + "\n";

  if (Buffer.byteLength(payload, "utf8") > ASTRA_EVENT_MAX_FILE_BYTES) {
    throw new Error("Event Engine store exceeds its file-size limit.");
  }

  await mkdir(path.dirname(source), { recursive: true, mode: 0o700 });
  await rejectSymlinkTarget(source);
  await writeFile(source, payload, {
    encoding: "utf8",
    mode: 0o600,
  });
  return {
    source,
    subscriptions: normalized.subscriptions.length,
    events: normalized.events.length,
  };
}

export async function mutateEventStore<T>(
  mutate: (store: AstraEventStore) =>
    | { store: AstraEventStore; result: T }
    | Promise<{ store: AstraEventStore; result: T }>,
): Promise<T> {
  return withEventMutationLock(async () => {
    const loaded = await loadEventStore();
    if (!loaded.available) throw new Error(loaded.detail);

    const outcome = await mutate({
      schemaVersion: 1,
      subscriptions: [...loaded.store.subscriptions],
      events: [...loaded.store.events],
    });
    await saveEventStore(outcome.store);
    return outcome.result;
  });
}
