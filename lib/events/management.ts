import type {
  AstraEventDeliveryPolicy,
  AstraEventQuietHours,
  AstraEventSeverity,
  AstraEventSourceKind,
  AstraEventSubscription,
  AstraEventSubscriptionStatus,
  AstraIncomingEvent,
} from "./contracts";
import { evaluateIncomingEvent } from "./engine";
import {
  ASTRA_EVENT_MAX_RECORDS,
  mutateEventStore,
} from "./store";

export type AstraEventSubscriptionInput = {
  id: string;
  source: AstraEventSourceKind;
  topic: string;
  projectId?: string;
  status?: AstraEventSubscriptionStatus;
  severityFloor: AstraEventSeverity;
  deliveryPolicy: AstraEventDeliveryPolicy;
  debounceMs: number;
  dedupeWindowMs: number;
  rateLimitPerHour: number;
  quietHours?: AstraEventQuietHours;
  allowCriticalDuringQuietHours?: boolean;
};

function normalizedId(value: string) {
  const id = value.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(id)) {
    throw new Error(
      "Event subscription id must use 1-120 letters, numbers, dot, underscore, or dash.",
    );
  }
  return id;
}

export async function upsertEventSubscription(
  input: AstraEventSubscriptionInput,
  now = new Date(),
) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid Event Engine mutation time.");
  }

  return mutateEventStore((store) => {
    const id = normalizedId(input.id);
    const index = store.subscriptions.findIndex(
      (candidate) => candidate.id.toLowerCase() === id.toLowerCase(),
    );
    const existing =
      index >= 0 ? store.subscriptions[index] : undefined;

    const subscription: AstraEventSubscription = {
      id: existing?.id ?? id,
      source: input.source,
      topic: input.topic.trim(),
      ...(input.projectId?.trim()
        ? { projectId: input.projectId.trim() }
        : {}),
      status: input.status ?? existing?.status ?? "disabled",
      severityFloor: input.severityFloor,
      deliveryPolicy: input.deliveryPolicy,
      debounceMs: input.debounceMs,
      dedupeWindowMs: input.dedupeWindowMs,
      rateLimitPerHour: input.rateLimitPerHour,
      ...(input.quietHours ? { quietHours: input.quietHours } : {}),
      allowCriticalDuringQuietHours:
        input.allowCriticalDuringQuietHours === true,
      createdAt: existing?.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const next = [...store.subscriptions];
    if (index >= 0) next[index] = subscription;
    else next.push(subscription);

    return {
      store: { ...store, subscriptions: next },
      result: { subscription, count: next.length },
    };
  });
}

export async function setEventSubscriptionStatus(
  idInput: string,
  status: AstraEventSubscriptionStatus,
  now = new Date(),
) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid Event Engine mutation time.");
  }

  return mutateEventStore((store) => {
    const id = normalizedId(idInput);
    const index = store.subscriptions.findIndex(
      (candidate) => candidate.id.toLowerCase() === id.toLowerCase(),
    );
    if (index < 0) {
      throw new Error("Event subscription was not found.");
    }

    const subscription: AstraEventSubscription = {
      ...store.subscriptions[index],
      status,
      updatedAt: now.toISOString(),
    };
    const next = [...store.subscriptions];
    next[index] = subscription;
    return {
      store: { ...store, subscriptions: next },
      result: { subscription, count: next.length },
    };
  });
}

export async function deleteEventSubscription(idInput: string) {
  return mutateEventStore((store) => {
    const id = normalizedId(idInput);
    const next = store.subscriptions.filter(
      (candidate) => candidate.id.toLowerCase() !== id.toLowerCase(),
    );
    if (next.length === store.subscriptions.length) {
      throw new Error("Event subscription was not found.");
    }

    return {
      store: { ...store, subscriptions: next },
      result: { deleted: true, count: next.length },
    };
  });
}

export async function publishIncomingEvent(
  event: AstraIncomingEvent,
  now = new Date(),
) {
  return mutateEventStore((store) => {
    const evaluation = evaluateIncomingEvent({
      event,
      subscriptions: store.subscriptions,
      recentEvents: store.events,
      now,
    });

    const ids = new Set(evaluation.records.map((record) => record.id));
    const retained = store.events.filter((record) => !ids.has(record.id));
    const events = [...retained, ...evaluation.records]
      .sort(
        (left, right) =>
          Date.parse(left.createdAt) - Date.parse(right.createdAt),
      )
      .slice(-ASTRA_EVENT_MAX_RECORDS);

    return {
      store: { ...store, events },
      result: evaluation,
    };
  });
}

export async function acknowledgeEvent(
  idInput: string,
  now = new Date(),
) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid Event Engine acknowledgement time.");
  }

  return mutateEventStore((store) => {
    const id = idInput.trim();
    const index = store.events.findIndex((event) => event.id === id);
    if (index < 0) throw new Error("Event record was not found.");

    const event = {
      ...store.events[index],
      acknowledgedAt:
        store.events[index].acknowledgedAt ?? now.toISOString(),
    };
    const next = [...store.events];
    next[index] = event;

    return {
      store: { ...store, events: next },
      result: { event },
    };
  });
}
