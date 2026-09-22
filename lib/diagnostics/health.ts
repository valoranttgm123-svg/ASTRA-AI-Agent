import { safeErrorDetail, safePublicDetail } from "@/lib/security/redaction";
import type {
  AstraConnectivityState,
  AstraDiagnosticsSnapshot,
  AstraHealthCategory,
  AstraHealthSample,
  AstraHealthStatus,
  AstraOperatingMode,
} from "./contracts";

export type AstraHealthCheck = {
  id: string;
  category: AstraHealthCategory;
  critical: boolean;
  check: (signal?: AbortSignal) => Promise<{
    status: AstraHealthStatus;
    detail: string;
    latencyMs?: number;
  }>;
};

function validId(value: string) {
  const id = value.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(id)) {
    throw new Error("Health check id is invalid.");
  }
  return id;
}

function deriveOperatingMode(
  connectivity: AstraConnectivityState,
  samples: readonly AstraHealthSample[],
): AstraOperatingMode {
  if (connectivity === "offline") return "offline";

  const criticalFailure = samples.some(
    (sample) =>
      sample.critical &&
      (sample.status === "unavailable" ||
        sample.status === "degraded"),
  );
  const anyFailure = samples.some(
    (sample) =>
      sample.status === "unavailable" ||
      sample.status === "degraded",
  );

  if (criticalFailure || anyFailure) return "degraded";
  if (connectivity === "online") return "online";
  return "unknown";
}

export class AstraHealthRegistry {
  private readonly checks = new Map<string, AstraHealthCheck>();

  register(check: AstraHealthCheck) {
    const id = validId(check.id);
    const key = id.toLowerCase();
    if (this.checks.has(key)) {
      throw new Error("Duplicate health check id: " + id + ".");
    }
    this.checks.set(key, { ...check, id });
    return this;
  }

  list() {
    return [...this.checks.values()].map((check) => ({
      id: check.id,
      category: check.category,
      critical: check.critical,
    }));
  }

  async capture({
    connectivity = "unknown",
    signal,
    now = new Date(),
  }: {
    connectivity?: AstraConnectivityState;
    signal?: AbortSignal;
    now?: Date;
  } = {}): Promise<AstraDiagnosticsSnapshot> {
    if (!Number.isFinite(now.getTime())) {
      throw new Error("Invalid diagnostics capture time.");
    }

    if (signal?.aborted) {
      throw signal.reason instanceof Error
        ? signal.reason
        : new DOMException("Diagnostics capture aborted.", "AbortError");
    }

    const checks = [...this.checks.values()];
    const samples = await Promise.all(
      checks.map(async (check): Promise<AstraHealthSample> => {
        if (signal?.aborted) {
          throw signal.reason instanceof Error
            ? signal.reason
            : new DOMException(
                "Diagnostics capture aborted.",
                "AbortError",
              );
        }

        const started = Date.now();
        try {
          const result = await check.check(signal);
          const latencyMs =
            result.latencyMs === undefined
              ? Date.now() - started
              : Math.max(0, Math.floor(result.latencyMs));
          return {
            id: check.id,
            category: check.category,
            status: result.status,
            critical: check.critical,
            checkedAt: now.toISOString(),
            detail: safePublicDetail(
              result.detail,
              "Health check completed.",
              700,
            ),
            latencyMs,
          };
        } catch (error) {
          const cancelled =
            signal?.aborted ||
            (error instanceof Error && error.name === "AbortError");
          if (cancelled) throw error;

          return {
            id: check.id,
            category: check.category,
            status: "unavailable",
            critical: check.critical,
            checkedAt: now.toISOString(),
            detail:
              "Health check failed: " +
              safeErrorDetail(error, "operation failed", 600),
            latencyMs: Date.now() - started,
          };
        }
      }),
    );

    const count = (status: AstraHealthStatus) =>
      samples.filter((sample) => sample.status === status).length;

    return {
      capturedAt: now.toISOString(),
      connectivity,
      operatingMode: deriveOperatingMode(connectivity, samples),
      samples,
      healthy: count("healthy"),
      degraded: count("degraded"),
      unavailable: count("unavailable"),
      notConfigured: count("not_configured"),
      unknown: count("unknown"),
    };
  }
}
