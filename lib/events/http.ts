import type {
  AstraEventDeliveryPolicy,
  AstraEventQuietHours,
  AstraEventSeverity,
  AstraEventSourceKind,
  AstraEventSubscriptionStatus,
  AstraIncomingEvent,
} from "./contracts";
import type { AstraEventSubscriptionInput } from "./management";

export type AstraEventMutation =
  | { action: "upsert"; subscription: AstraEventSubscriptionInput }
  | { action: "status"; id: string; status: AstraEventSubscriptionStatus }
  | { action: "delete"; id: string }
  | { action: "publish"; event: AstraIncomingEvent }
  | { action: "ack"; id: string };

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(field + " must be an object.");
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string, max: number) {
  if (typeof value !== "string") {
    throw new Error(field + " must be a string.");
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) {
    throw new Error(field + " must contain 1-" + max + " characters.");
  }
  return cleaned;
}

function optionalString(value: unknown, field: string, max: number) {
  if (value === undefined || value === null || value === "") return undefined;
  return string(value, field, max);
}

function nonNegativeInteger(value: unknown, field: string, max: number) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > max
  ) {
    throw new Error(field + " is outside its allowed range.");
  }
  return value;
}

function positiveInteger(value: unknown, field: string, max: number) {
  const parsed = nonNegativeInteger(value, field, max);
  if (parsed < 1) throw new Error(field + " must be at least 1.");
  return parsed;
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
  throw new Error("source is invalid.");
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
  throw new Error("severity is invalid.");
}

function status(value: unknown): AstraEventSubscriptionStatus {
  if (value === "enabled" || value === "disabled") return value;
  throw new Error("status is invalid.");
}

function deliveryPolicy(value: unknown): AstraEventDeliveryPolicy {
  if (value === "notify" || value === "record_only") return value;
  throw new Error("deliveryPolicy is invalid.");
}

function quietHours(value: unknown): AstraEventQuietHours | undefined {
  if (value === undefined || value === null) return undefined;
  const entry = object(value, "quietHours");
  const timezoneOffsetMinutes =
    typeof entry.timezoneOffsetMinutes === "number" &&
    Number.isInteger(entry.timezoneOffsetMinutes) &&
    entry.timezoneOffsetMinutes >= -840 &&
    entry.timezoneOffsetMinutes <= 840
      ? entry.timezoneOffsetMinutes
      : (() => {
          throw new Error("quietHours.timezoneOffsetMinutes is invalid.");
        })();

  return {
    startMinuteOfDay: nonNegativeInteger(
      entry.startMinuteOfDay,
      "quietHours.startMinuteOfDay",
      1439,
    ),
    endMinuteOfDay: nonNegativeInteger(
      entry.endMinuteOfDay,
      "quietHours.endMinuteOfDay",
      1439,
    ),
    timezoneOffsetMinutes,
  };
}

function metadata(value: unknown): Record<string, string> | undefined {
  if (value === undefined || value === null) return undefined;
  const entry = object(value, "event.metadata");
  if (Object.keys(entry).length > 24) {
    throw new Error("event.metadata exceeds 24 entries.");
  }
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(entry)) {
    if (
      key.length < 1 ||
      key.length > 80 ||
      typeof raw !== "string" ||
      raw.length > 400
    ) {
      throw new Error("event.metadata is invalid.");
    }
    result[key] = raw.trim();
  }
  return result;
}

function incomingEvent(value: unknown): AstraIncomingEvent {
  const entry = object(value, "event");
  const occurredAt = string(entry.occurredAt, "event.occurredAt", 80);
  if (!Number.isFinite(Date.parse(occurredAt))) {
    throw new Error("event.occurredAt must be a timestamp.");
  }

  return {
    source: source(entry.source),
    topic: string(entry.topic, "event.topic", 160),
    key: string(entry.key, "event.key", 240),
    title: string(entry.title, "event.title", 240),
    detail: optionalString(entry.detail, "event.detail", 2000),
    severity: severity(entry.severity),
    occurredAt,
    projectId: optionalString(entry.projectId, "event.projectId", 120),
    metadata: metadata(entry.metadata),
  };
}

export function parseEventMutation(
  body: Record<string, unknown>,
): AstraEventMutation {
  if (body.action === "upsert") {
    const entry = object(body.subscription, "subscription");
    return {
      action: "upsert",
      subscription: {
        id: string(entry.id, "subscription.id", 120),
        source: source(entry.source),
        topic: string(entry.topic, "subscription.topic", 160),
        projectId: optionalString(
          entry.projectId,
          "subscription.projectId",
          120,
        ),
        status:
          entry.status === undefined ? undefined : status(entry.status),
        severityFloor: severity(entry.severityFloor),
        deliveryPolicy: deliveryPolicy(entry.deliveryPolicy),
        debounceMs: nonNegativeInteger(
          entry.debounceMs,
          "subscription.debounceMs",
          24 * 60 * 60_000,
        ),
        dedupeWindowMs: nonNegativeInteger(
          entry.dedupeWindowMs,
          "subscription.dedupeWindowMs",
          7 * 24 * 60 * 60_000,
        ),
        rateLimitPerHour: positiveInteger(
          entry.rateLimitPerHour,
          "subscription.rateLimitPerHour",
          120,
        ),
        quietHours: quietHours(entry.quietHours),
        allowCriticalDuringQuietHours:
          entry.allowCriticalDuringQuietHours === true,
      },
    };
  }

  if (body.action === "status") {
    return {
      action: "status",
      id: string(body.id, "id", 120),
      status: status(body.status),
    };
  }

  if (body.action === "delete") {
    return { action: "delete", id: string(body.id, "id", 120) };
  }

  if (body.action === "publish") {
    return { action: "publish", event: incomingEvent(body.event) };
  }

  if (body.action === "ack") {
    return { action: "ack", id: string(body.id, "id", 160) };
  }

  throw new Error("Event Engine action is invalid.");
}
