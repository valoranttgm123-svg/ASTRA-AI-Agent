import { safeErrorDetail, safePublicDetail } from "@/lib/security/redaction";
import type {
  AstraHealthProbe,
  AstraHealthSnapshot,
  AstraMeasuredHealthResult,
  AstraRuntimeMode,
} from "./contracts";

export const ASTRA_HEALTH_MAX_PROBES = 64;
export const ASTRA_HEALTH_DEFAULT_TIMEOUT_MS = 2500;

function validProbeId(value: string) {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(value);
}

function deriveRuntimeMode(
  results: readonly AstraMeasuredHealthResult[],
): AstraRuntimeMode {
  const core = results.filter((result) => result.scope === "local_core");
  if (core.length === 0) return "unknown";

  if (
    core.some(
      (result) =>
        result.status === "unavailable" ||
        result.status === "not_configured",
    )
  ) {
    return "degraded";
  }
  if (core.some((result) => result.status === "degraded")) {
    return "degraded";
  }

  const cloud = results.filter((result) => result.scope === "cloud");
  if (
    cloud.some(
      (result) =>
        result.status === "healthy" || result.status === "degraded",
    )
  ) {
    return "online_capable";
  }

  const configuredCloudUnavailable = cloud.some(
    (result) => result.status === "unavailable",
  );
  if (configuredCloudUnavailable) return "local_only";

  return "unknown";
}

function timeoutError() {
  const error = new Error("Health probe timed out.");
  error.name = "TimeoutError";
  return error;
}

async function runProbe(
  probe: AstraHealthProbe,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<AstraMeasuredHealthResult> {
  const controller = new AbortController();
  const started = performance.now();
  const timer = setTimeout(
    () => controller.abort(timeoutError()),
    timeoutMs,
  );
  const onExternalAbort = () =>
    controller.abort(
      externalSignal?.reason instanceof Error
        ? externalSignal.reason
        : new DOMException("Health snapshot cancelled.", "AbortError"),
    );

  if (externalSignal?.aborted) onExternalAbort();
  else {
    externalSignal?.addEventListener("abort", onExternalAbort, {
      once: true,
    });
  }

  let removeAbort = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    const fail = () => {
      const reason = controller.signal.reason;
      reject(
        reason instanceof Error
          ? reason
          : new DOMException("Health probe cancelled.", "AbortError"),
      );
    };
    if (controller.signal.aborted) {
      fail();
      return;
    }
    controller.signal.addEventListener("abort", fail, { once: true });
    removeAbort = () =>
      controller.signal.removeEventListener("abort", fail);
  });

  try {
    const result = await Promise.race([
      probe.check(controller.signal),
      aborted,
    ]);
    return {
      id: probe.id,
      label: probe.label,
      scope: probe.scope,
      critical: probe.critical,
      status: result.status,
      detail: safePublicDetail(
        result.detail,
        "Health probe returned no detail.",
        800,
      ),
      latencyMs: Math.max(0, performance.now() - started),
      ...(probe.recovery ? { recovery: probe.recovery } : {}),
    };
  } catch (error) {
    if (externalSignal?.aborted) throw error;
    return {
      id: probe.id,
      label: probe.label,
      scope: probe.scope,
      critical: probe.critical,
      status: "unavailable",
      detail:
        error instanceof Error && error.name === "TimeoutError"
          ? "Health probe timed out."
          : safeErrorDetail(error, "Health probe failed.", 800),
      latencyMs: Math.max(0, performance.now() - started),
      ...(probe.recovery ? { recovery: probe.recovery } : {}),
    };
  } finally {
    clearTimeout(timer);
    removeAbort();
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

export async function runHealthSnapshot({
  probes,
  timeoutMs = ASTRA_HEALTH_DEFAULT_TIMEOUT_MS,
  signal,
  now = new Date(),
}: {
  probes: readonly AstraHealthProbe[];
  timeoutMs?: number;
  signal?: AbortSignal;
  now?: Date;
}): Promise<AstraHealthSnapshot> {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid health snapshot time.");
  }
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 100 ||
    timeoutMs > 30_000
  ) {
    throw new Error("Health probe timeout must be 100-30000ms.");
  }
  if (probes.length > ASTRA_HEALTH_MAX_PROBES) {
    throw new Error("Health probe limit exceeded.");
  }

  const seen = new Set<string>();
  for (const probe of probes) {
    if (!validProbeId(probe.id)) {
      throw new Error("Health probe id is invalid: " + probe.id + ".");
    }
    const key = probe.id.toLowerCase();
    if (seen.has(key)) {
      throw new Error("Duplicate health probe id: " + probe.id + ".");
    }
    seen.add(key);
  }

  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException("Health snapshot cancelled.", "AbortError");
  }

  const results = await Promise.all(
    probes.map((probe) => runProbe(probe, timeoutMs, signal)),
  );

  return {
    capturedAt: now.toISOString(),
    mode: deriveRuntimeMode(results),
    results,
  };
}
