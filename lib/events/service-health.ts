import type {
  AstraDiagnosticsSnapshot,
  AstraHealthSample,
  AstraHealthStatus,
} from "../diagnostics/contracts";
import { createLocalDiagnosticsRegistry } from "../diagnostics/runtime";
import { safeErrorDetail } from "../security/redaction";
import type { AstraIncomingEvent } from "./contracts";
import { publishIncomingEvent } from "./management";
import { loadEventStore } from "./store";

type DiagnosticsCapture = ({
  signal,
  now,
}: {
  signal?: AbortSignal;
  now: Date;
}) => Promise<AstraDiagnosticsSnapshot>;

export type ServiceHealthEventStatus = {
  available: boolean;
  detail: string;
  sampleCount: number;
  unhealthy: number;
  capturedAt: string | null;
};

async function defaultCapture({
  signal,
  now,
}: {
  signal?: AbortSignal;
  now: Date;
}) {
  return createLocalDiagnosticsRegistry().capture({
    connectivity: "unknown",
    signal,
    now,
  });
}

function severityForStatus(status: AstraHealthStatus) {
  switch (status) {
    case "unavailable":
      return "error" as const;
    case "degraded":
    case "unknown":
      return "warning" as const;
    case "healthy":
    case "not_configured":
    default:
      return "info" as const;
  }
}

export function healthSampleToEvent(
  sample: AstraHealthSample,
): AstraIncomingEvent {
  return {
    source: "service",
    topic: "health.state",
    key: "health:" + sample.id + ":" + sample.status,
    title:
      sample.id +
      " · " +
      sample.status.replace("_", " ").toUpperCase(),
    detail: sample.detail,
    severity: severityForStatus(sample.status),
    occurredAt: sample.checkedAt,
    metadata: {
      healthId: sample.id,
      category: sample.category,
      status: sample.status,
      critical: String(sample.critical),
      ...(sample.latencyMs === undefined
        ? {}
        : { latencyMs: String(sample.latencyMs) }),
    },
  };
}

function unhealthyCount(snapshot: AstraDiagnosticsSnapshot) {
  return (
    snapshot.degraded +
    snapshot.unavailable +
    snapshot.unknown
  );
}

export async function getServiceHealthEventStatus({
  signal,
  now = new Date(),
  capture = defaultCapture,
}: {
  signal?: AbortSignal;
  now?: Date;
  capture?: DiagnosticsCapture;
} = {}): Promise<ServiceHealthEventStatus> {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid service-health status time.");
  }

  try {
    const snapshot = await capture({ signal, now });
    return {
      available: true,
      detail:
        "Local Diagnostics captured " +
        snapshot.samples.length +
        " health sample(s); " +
        unhealthyCount(snapshot) +
        " require attention.",
      sampleCount: snapshot.samples.length,
      unhealthy: unhealthyCount(snapshot),
      capturedAt: snapshot.capturedAt,
    };
  } catch (error) {
    if (
      signal?.aborted ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      throw error;
    }

    return {
      available: false,
      detail:
        "Local service-health source is unavailable: " +
        safeErrorDetail(error, "diagnostics unavailable", 500),
      sampleCount: 0,
      unhealthy: 0,
      capturedAt: null,
    };
  }
}

function latestHealthStatus(
  events: Awaited<ReturnType<typeof loadEventStore>>["store"]["events"],
  healthId: string,
) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (
      event.source === "service" &&
      event.topic === "health.state" &&
      event.metadata?.healthId === healthId
    ) {
      return event.metadata.status;
    }
  }
  return undefined;
}

export async function syncServiceHealthEvents({
  signal,
  now = new Date(),
  capture = defaultCapture,
}: {
  signal?: AbortSignal;
  now?: Date;
  capture?: DiagnosticsCapture;
} = {}) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid service-health sync time.");
  }

  const snapshot = await capture({ signal, now });
  const loaded = await loadEventStore();
  if (!loaded.available) {
    throw new Error(loaded.detail);
  }

  let skippedBaseline = 0;
  let skippedUnchanged = 0;
  let matchedSubscriptions = 0;
  let records = 0;
  let deliverable = 0;

  const samples = [...snapshot.samples].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  for (const sample of samples) {
    if (signal?.aborted) {
      throw signal.reason instanceof Error
        ? signal.reason
        : new DOMException(
            "Service-health sync aborted.",
            "AbortError",
          );
    }

    const previousStatus = latestHealthStatus(
      loaded.store.events,
      sample.id,
    );

    if (previousStatus === sample.status) {
      skippedUnchanged += 1;
      continue;
    }

    if (
      previousStatus === undefined &&
      (sample.status === "healthy" ||
        sample.status === "not_configured")
    ) {
      skippedBaseline += 1;
      continue;
    }

    const published = await publishIncomingEvent(
      healthSampleToEvent(sample),
      now,
    );

    matchedSubscriptions += published.matchedSubscriptions;
    records += published.records.length;
    deliverable += published.deliverable.length;

    if (published.records.length > 0) {
      loaded.store.events.push(...published.records);
    }
  }

  return {
    capturedAt: snapshot.capturedAt,
    samples: samples.length,
    unhealthy: unhealthyCount(snapshot),
    skippedBaseline,
    skippedUnchanged,
    matchedSubscriptions,
    records,
    deliverable,
  };
}
