import {
  clampMemoryScore,
  type AstraMemoryPrivacy,
  type AstraMemoryQuery,
  type AstraMemoryRecord,
  type AstraMemorySource,
  type AstraMemorySourceType,
} from "./contracts";

const ALLOWED_SOURCE_TYPES = new Set<AstraMemorySourceType>([
  "local",
  "project",
  "graphify",
  "obsidian",
  "github",
  "sonor",
]);

const ALLOWED_PRIVACY = new Set<AstraMemoryPrivacy>([
  "private_local",
  "project_local",
  "shareable",
]);

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "off", "no"].includes(value);
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  maximum: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(maximum, Math.floor(parsed));
}

function normalizePath(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : "/" + trimmed;
}

function loopbackOrigin(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();

  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname)) {
    throw new Error(
      "Sonor bridge must use a loopback URL. ASTRA should connect to Sonor through 127.0.0.1 on the same PC.",
    );
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Sonor bridge URL must use HTTP or HTTPS.");
  }

  return url.origin;
}

export type SonorBridgeConfig = {
  enabled: boolean;
  baseUrl: string;
  searchPath: string;
  timeoutMs: number;
};

export function getSonorBridgeConfig(): SonorBridgeConfig {
  return {
    enabled: envFlag("ASTRA_SONOR_ENABLED", false),
    baseUrl: loopbackOrigin(
      process.env.ASTRA_SONOR_URL?.trim() || "http://127.0.0.1:55127",
    ),
    searchPath: normalizePath(process.env.ASTRA_SONOR_SEARCH_PATH),
    timeoutMs: parsePositiveInt(
      process.env.ASTRA_SONOR_TIMEOUT_MS,
      4000,
      30000,
    ),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(
  record: Record<string, unknown>,
  field: string,
  max: number,
) {
  const value = record[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Invalid Sonor bridge response.");
  }
  return value.trim().slice(0, max);
}

function optionalString(
  record: Record<string, unknown>,
  field: string,
  max: number,
) {
  const value = record[field];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new Error("Invalid Sonor bridge response.");
  }
  return value.trim().slice(0, max) || undefined;
}

function parseRecord(value: unknown): AstraMemoryRecord {
  if (!isObject(value)) {
    throw new Error("Invalid Sonor bridge response.");
  }

  const provenanceValue = value.provenance;
  if (!isObject(provenanceValue)) {
    throw new Error("Invalid Sonor bridge response.");
  }

  const sourceTypeValue = requiredString(provenanceValue, "sourceType", 40);
  if (!ALLOWED_SOURCE_TYPES.has(sourceTypeValue as AstraMemorySourceType)) {
    throw new Error("Invalid Sonor bridge response.");
  }

  const privacyValue = requiredString(provenanceValue, "privacy", 40);
  if (!ALLOWED_PRIVACY.has(privacyValue as AstraMemoryPrivacy)) {
    throw new Error("Invalid Sonor bridge response.");
  }

  const relevance = Number(value.relevance);
  const confidence = Number(value.confidence);
  if (!Number.isFinite(relevance) || !Number.isFinite(confidence)) {
    throw new Error("Invalid Sonor bridge response.");
  }

  const rawTags = value.tags;
  const tags =
    rawTags === undefined
      ? undefined
      : Array.isArray(rawTags)
        ? rawTags
            .filter((tag): tag is string => typeof tag === "string")
            .map((tag) => tag.trim().slice(0, 80))
            .filter(Boolean)
            .slice(0, 20)
        : (() => {
            throw new Error("Invalid Sonor bridge response.");
          })();

  return {
    id: requiredString(value, "id", 200),
    content: requiredString(value, "content", 4000),
    tags,
    relevance: clampMemoryScore(relevance),
    confidence: clampMemoryScore(confidence),
    provenance: {
      source: requiredString(provenanceValue, "source", 200),
      sourceType: sourceTypeValue as AstraMemorySourceType,
      project: optionalString(provenanceValue, "project", 120),
      timestamp: optionalString(provenanceValue, "timestamp", 80),
      privacy: privacyValue as AstraMemoryPrivacy,
      reference: requiredString(provenanceValue, "reference", 500),
    },
  };
}

export function parseSonorBridgeResponse(value: unknown): AstraMemoryRecord[] {
  if (!isObject(value) || !Array.isArray(value.records)) {
    throw new Error("Invalid Sonor bridge response.");
  }

  return value.records.slice(0, 50).map(parseRecord);
}

function createRequestSignal(signal: AbortSignal | undefined, timeoutMs: number) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

export const sonorMemorySource: AstraMemorySource = {
  id: "sonor",
  type: "sonor",

  async search(query: AstraMemoryQuery) {
    const config = getSonorBridgeConfig();

    if (!config.enabled) {
      return {
        source: "sonor",
        sourceType: "sonor" as const,
        available: false,
        detail: "Sonor bridge is disabled by ASTRA_SONOR_ENABLED.",
        records: [],
      };
    }

    if (!config.searchPath) {
      return {
        source: "sonor",
        sourceType: "sonor" as const,
        available: false,
        detail:
          "Sonor exists locally, but no verified ASTRA-compatible search endpoint is configured yet.",
        records: [],
      };
    }

    const response = await fetch(config.baseUrl + config.searchPath, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-astra-client": "1",
      },
      body: JSON.stringify({
        query: query.input,
        project: query.project,
        limit: Math.max(1, Math.min(20, query.limit)),
        maxChars: Math.max(1, Math.min(16000, query.maxChars)),
      }),
      signal: createRequestSignal(query.signal, config.timeoutMs),
    });

    if (!response.ok) {
      throw new Error("Sonor memory source is unavailable.");
    }

    const payload = (await response.json()) as unknown;
    const records = parseSonorBridgeResponse(payload);

    return {
      source: "sonor",
      sourceType: "sonor" as const,
      available: true,
      detail:
        "Sonor returned " +
        records.length +
        " provenance-aware memory record" +
        (records.length === 1 ? "." : "s."),
      records,
    };
  },
};
