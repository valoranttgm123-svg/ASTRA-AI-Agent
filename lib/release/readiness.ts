export type ReadinessState =
  | "READY"
  | "OFFLINE"
  | "NOT_CONFIGURED"
  | "ERROR"
  | "UNKNOWN"
  | "NOT_APPLICABLE";

export type ReadinessCheck = {
  state: ReadinessState;
  detail: string;
  data?: Record<string, unknown>;
};

export type BrainReadinessSnapshot = {
  brain: ReadinessCheck;
  ollama: ReadinessCheck;
  permissions: ReadinessCheck;
  capabilities: Record<string, ReadinessState>;
  features: Record<string, ReadinessState>;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function bool(value: unknown) {
  return value === true;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function normalizeReadinessState(
  value: unknown,
): ReadinessState {
  return value === "READY" ||
    value === "OFFLINE" ||
    value === "NOT_CONFIGURED" ||
    value === "ERROR" ||
    value === "UNKNOWN" ||
    value === "NOT_APPLICABLE"
    ? value
    : "UNKNOWN";
}

export function featureState(
  value: unknown,
): ReadinessState {
  if (!isRecord(value)) return "UNKNOWN";

  const explicit = stringValue(value.state);
  if (
    explicit === "READY" ||
    explicit === "OFFLINE" ||
    explicit === "NOT_CONFIGURED" ||
    explicit === "ERROR"
  ) {
    return explicit;
  }

  if (value.enabled === false) return "NOT_CONFIGURED";
  if (value.available === true) return "READY";
  if (value.enabled === true && value.available === false) {
    return "OFFLINE";
  }
  return "UNKNOWN";
}

export function extractBrainReadiness(
  payload: unknown,
): BrainReadinessSnapshot {
  if (!isRecord(payload)) {
    return {
      brain: {
        state: "ERROR",
        detail: "Brain status payload is malformed.",
      },
      ollama: {
        state: "UNKNOWN",
        detail:
          "Ollama readiness cannot be derived from a malformed Brain status payload.",
      },
      permissions: {
        state: "UNKNOWN",
        detail:
          "Permission readiness cannot be derived from a malformed Brain status payload.",
      },
      capabilities: {},
      features: {},
    };
  }

  const provider = stringValue(payload.provider) ?? "unknown";
  const mode = stringValue(payload.mode) ?? "unknown";
  const capabilities = isRecord(payload.capabilities)
    ? payload.capabilities
    : {};
  const features = isRecord(payload.features)
    ? payload.features
    : {};
  const permissions = isRecord(payload.permissions)
    ? payload.permissions
    : {};

  const capabilityStates: Record<string, ReadinessState> =
    Object.fromEntries(
      Object.entries(capabilities).map(([key, value]) => [
        key,
        isRecord(value)
          ? normalizeReadinessState(value.state)
          : "UNKNOWN",
      ]),
    );

  const featureStates: Record<string, ReadinessState> =
    Object.fromEntries(
      Object.entries(features).map(([key, value]) => [
        key,
        featureState(value),
      ]),
    );

  const strategistState =
    typeof capabilityStates.strategist === "string"
      ? capabilityStates.strategist
      : "UNKNOWN";
  const ollama = isRecord(features.ollama) ? features.ollama : null;
  // Strategist may be served by Hermes/NVIDIA. Its readiness is not evidence
  // that the local Ollama service is reachable. Retain older Ollama-only status
  // compatibility, but fail unknown when an older alternate-provider payload
  // has no independent Ollama probe.
  const ollamaState = ollama
    ? featureState(ollama)
    : provider === "ollama" && (strategistState === "READY" || strategistState === "OFFLINE")
      ? strategistState
      : "UNKNOWN";

  return {
    brain: {
      state: bool(payload.ready)
        ? ("READY" as const)
        : ("ERROR" as const),
      detail:
        bool(payload.ready)
          ? "ASTRA Brain status responded ready."
          : "ASTRA Brain status did not report ready.",
      data: {
        provider,
        mode,
        endpoint: stringValue(payload.endpoint) ?? null,
        model: stringValue(payload.model) ?? null,
        fallback: stringValue(payload.fallback) ?? null,
      },
    },
    ollama: {
      state: ollamaState,
      detail: ollama
        ? "Ollama readiness uses the independent Ollama probe in the running Brain status."
        : "Legacy status: Ollama readiness is inferred only when Ollama is the active provider; otherwise UNKNOWN.",
      data: {
        strategistState,
        activeProvider: provider,
        model:
          ollama ? stringValue(ollama.model) ?? null : provider === "ollama"
            ? stringValue(payload.model) ?? null
            : null,
        endpoint:
          ollama ? stringValue(ollama.endpoint) ?? null : provider === "ollama"
            ? stringValue(payload.endpoint) ?? null
            : null,
      },
    },
    permissions: {
      state: "READY" as const,
      detail: "Current running ASTRA permission snapshot.",
      data: {
        requireApproval:
          permissions.requireApproval === true,
        allowShell: permissions.allowShell === true,
        allowFileWrite:
          permissions.allowFileWrite === true,
        allowExternalActions:
          permissions.allowExternalActions === true,
        allowPaidCloud:
          permissions.allowPaidCloud === true,
      },
    },
    capabilities: capabilityStates,
    features: featureStates,
  };
}

export function automationStoreReadiness(
  payload: unknown,
): ReadinessCheck {
  if (!isRecord(payload)) {
    return {
      state: "ERROR",
      detail: "Automation store payload is malformed.",
    };
  }

  const available = payload.available === true;
  const enabled = payload.enabled === true;
  const automations = Array.isArray(payload.automations)
    ? payload.automations
    : [];
  const queue = isRecord(payload.queue)
    ? payload.queue
    : null;

  return {
    state: !available
      ? "ERROR"
      : enabled
        ? "READY"
        : "NOT_CONFIGURED",
    detail: available
      ? enabled
        ? "Automation store is enabled and available."
        : "Automation store is available but disabled."
      : "Automation store is unavailable.",
    data: {
      enabled,
      available,
      definitionCount: automations.length,
      readyCount:
        queue && Array.isArray(queue.ready)
          ? queue.ready.length
          : 0,
      waitingApprovalCount:
        queue && Array.isArray(queue.waitingApproval)
          ? queue.waitingApproval.length
          : 0,
    },
  };
}

export function classifyWindowsStartupTasks(
  states: Record<string, string>,
): ReadinessCheck {
  const required = ["ASTRA-Agent", "ASTRA-Ollama"];
  const missing = required.filter(
    (name) =>
      states[name] === undefined ||
      states[name] === "MISSING",
  );
  const disabled = required.filter(
    (name) =>
      (states[name] ?? "").toLowerCase() ===
      "disabled",
  );
  const unknown = required.filter(
    (name) => !["running", "ready", "queued", "disabled", "missing"].includes(
      (states[name] ?? "MISSING").toLowerCase(),
    ),
  );

  return {
    state:
      missing.length > 0
        ? "NOT_CONFIGURED"
        : disabled.length > 0
          ? "OFFLINE"
          : unknown.length > 0
            ? "UNKNOWN"
            : "READY",
    detail:
      missing.length > 0
        ? "One or more ASTRA startup tasks are not installed."
        : disabled.length > 0
          ? "One or more ASTRA startup tasks are disabled."
          : unknown.length > 0
            ? "One or more ASTRA startup task states could not be determined."
            : "ASTRA startup scheduled tasks are installed.",
    data: {
      tasks: states,
    },
  };
}

export function automationServiceReadiness(
  payload: unknown,
): ReadinessCheck {
  if (!isRecord(payload) || !isRecord(payload.service)) {
    return {
      state: "ERROR",
      detail: "Automation service payload is malformed.",
    };
  }

  const service = payload.service;
  const enabled = service.enabled === true;
  const running = service.running === true;
  const tickActive = service.tickActive === true;

  return {
    state: !enabled
      ? "NOT_CONFIGURED"
      : running
        ? "READY"
        : "OFFLINE",
    detail: !enabled
      ? "Automation background service opt-in is OFF."
      : running
        ? "Automation background service is running."
        : "Automation background service is enabled but not running.",
    data: {
      enabled,
      running,
      tickActive,
      pollIntervalMs:
        typeof service.pollIntervalMs === "number"
          ? service.pollIntervalMs
          : null,
    },
  };
}
