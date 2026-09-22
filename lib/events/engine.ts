import { createHash } from "node:crypto";

import type {
  AstraEventEvaluation,
  AstraEventQuietHours,
  AstraEventRecord,
  AstraEventSeverity,
  AstraEventSubscription,
  AstraIncomingEvent,
} from "./contracts";

const SEVERITY_RANK: Record<AstraEventSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};

function timestamp(value: string, field: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Event " + field + " must be a valid timestamp.");
  }
  return parsed;
}

function minuteOfDayAtOffset(dateMs: number, offsetMinutes: number) {
  const localMs = dateMs + offsetMinutes * 60_000;
  const date = new Date(localMs);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function isWithinQuietHours(
  nowMs: number,
  quietHours?: AstraEventQuietHours,
) {
  if (!quietHours) return false;
  const minute = minuteOfDayAtOffset(
    nowMs,
    quietHours.timezoneOffsetMinutes,
  );
  const { startMinuteOfDay: start, endMinuteOfDay: end } = quietHours;

  if (start === end) return true;
  if (start < end) return minute >= start && minute < end;
  return minute >= start || minute < end;
}

function eventMatchesSubscription(
  event: AstraIncomingEvent,
  subscription: AstraEventSubscription,
) {
  if (subscription.status !== "enabled") return false;
  if (subscription.source !== event.source) return false;
  if (subscription.topic !== "*" && subscription.topic !== event.topic) {
    return false;
  }
  if (
    subscription.projectId &&
    subscription.projectId !== event.projectId
  ) {
    return false;
  }
  return (
    SEVERITY_RANK[event.severity] >=
    SEVERITY_RANK[subscription.severityFloor]
  );
}

function hashId(
  subscriptionId: string,
  event: AstraIncomingEvent,
) {
  return createHash("sha256")
    .update(
      [
        subscriptionId,
        event.source,
        event.topic,
        event.key,
        event.occurredAt,
        event.projectId ?? "",
      ].join("\n"),
    )
    .digest("hex")
    .slice(0, 32);
}

function dedupeKey(subscriptionId: string, event: AstraIncomingEvent) {
  return createHash("sha256")
    .update(
      [
        subscriptionId,
        event.source,
        event.topic,
        event.key,
        event.projectId ?? "",
      ].join("\n"),
    )
    .digest("hex")
    .slice(0, 32);
}

function deliveryRecords(
  recent: readonly AstraEventRecord[],
  subscriptionId: string,
) {
  return recent.filter(
    (record) =>
      record.subscriptionId === subscriptionId &&
      record.disposition === "delivered",
  );
}

export function evaluateIncomingEvent({
  event,
  subscriptions,
  recentEvents,
  now = new Date(),
}: {
  event: AstraIncomingEvent;
  subscriptions: readonly AstraEventSubscription[];
  recentEvents: readonly AstraEventRecord[];
  now?: Date;
}): AstraEventEvaluation {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid Event Engine evaluation time.");
  }
  const occurredMs = timestamp(event.occurredAt, "occurredAt");
  const nowMs = now.getTime();
  if (occurredMs > nowMs + 5 * 60_000) {
    throw new Error("Event occurredAt is too far in the future.");
  }

  const matches = subscriptions.filter((subscription) =>
    eventMatchesSubscription(event, subscription),
  );

  const records = matches.map((subscription): AstraEventRecord => {
    const delivered = deliveryRecords(recentEvents, subscription.id);
    const latestDelivered = [...delivered]
      .sort(
        (left, right) =>
          Date.parse(right.createdAt) - Date.parse(left.createdAt),
      )[0];

    const currentDedupeKey = dedupeKey(subscription.id, event);
    const duplicate = recentEvents.some((record) => {
      if (
        record.subscriptionId !== subscription.id ||
        record.dedupeKey !== currentDedupeKey
      ) {
        return false;
      }
      const createdMs = Date.parse(record.createdAt);
      return (
        Number.isFinite(createdMs) &&
        nowMs - createdMs >= 0 &&
        nowMs - createdMs < subscription.dedupeWindowMs
      );
    });

    const withinDebounce =
      latestDelivered !== undefined &&
      nowMs - Date.parse(latestDelivered.createdAt) >= 0 &&
      nowMs - Date.parse(latestDelivered.createdAt) <
        subscription.debounceMs;

    const lastHourDeliveries = delivered.filter((record) => {
      const createdMs = Date.parse(record.createdAt);
      return (
        Number.isFinite(createdMs) &&
        nowMs - createdMs >= 0 &&
        nowMs - createdMs < 60 * 60_000
      );
    }).length;

    const quiet =
      isWithinQuietHours(nowMs, subscription.quietHours) &&
      !(
        event.severity === "critical" &&
        subscription.allowCriticalDuringQuietHours
      );

    let disposition: AstraEventRecord["disposition"];
    let dispositionDetail: string;

    if (duplicate) {
      disposition = "suppressed_duplicate";
      dispositionDetail =
        "Suppressed because the same event key was already seen inside the dedupe window.";
    } else if (withinDebounce) {
      disposition = "suppressed_debounce";
      dispositionDetail =
        "Suppressed because this subscription recently delivered another event inside its debounce window.";
    } else if (quiet) {
      disposition = "suppressed_quiet_hours";
      dispositionDetail =
        "Suppressed because the subscription is currently inside configured quiet hours.";
    } else if (lastHourDeliveries >= subscription.rateLimitPerHour) {
      disposition = "suppressed_rate_limit";
      dispositionDetail =
        "Suppressed because the subscription reached its hourly notification limit.";
    } else if (subscription.deliveryPolicy === "record_only") {
      disposition = "recorded";
      dispositionDetail =
        "Recorded without notification by subscription policy.";
    } else {
      disposition = "delivered";
      dispositionDetail =
        "Eligible for proactive notification. This record does not authorize any external action.";
    }

    return {
      id: hashId(subscription.id, event),
      subscriptionId: subscription.id,
      source: event.source,
      topic: event.topic,
      key: event.key,
      dedupeKey: currentDedupeKey,
      title: event.title,
      ...(event.detail ? { detail: event.detail } : {}),
      severity: event.severity,
      occurredAt: event.occurredAt,
      ...(event.projectId ? { projectId: event.projectId } : {}),
      ...(event.metadata ? { metadata: event.metadata } : {}),
      disposition,
      dispositionDetail,
      createdAt: now.toISOString(),
    };
  });

  return {
    matchedSubscriptions: matches.length,
    records,
    deliverable: records.filter(
      (record) => record.disposition === "delivered",
    ),
  };
}
