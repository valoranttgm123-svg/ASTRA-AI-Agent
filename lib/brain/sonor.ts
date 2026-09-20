import type {
  AstraMemoryQuery,
  AstraMemorySource,
  AstraMemorySourceResult,
} from "./memory-sources";

export type SonorBridgeConfig = {
  enabled: boolean;
  baseUrl: string;
  searchPath: string | null;
  healthPath: string | null;
};

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "off", "no"].includes(value);
}

function normalizePath(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function assertLoopbackUrl(value: string): string {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
    throw new Error(
      "ASTRA Sonor bridge must use a loopback URL. Use Sonor's local 127.0.0.1 address from ASTRA.",
    );
  }
  return url.origin;
}

export function getSonorBridgeConfig(): SonorBridgeConfig {
  const enabled = envFlag("ASTRA_SONOR_ENABLED", false);
  const rawUrl = process.env.ASTRA_SONOR_URL?.trim() || "http://127.0.0.1:55127";

  return {
    enabled,
    baseUrl: assertLoopbackUrl(rawUrl),
    searchPath: normalizePath(process.env.ASTRA_SONOR_SEARCH_PATH),
    healthPath: normalizePath(process.env.ASTRA_SONOR_HEALTH_PATH),
  };
}

export async function getSonorBridgeStatus(): Promise<{
  enabled: boolean;
  available: boolean;
  detail: string;
}> {
  const config = getSonorBridgeConfig();

  if (!config.enabled) {
    return {
      enabled: false,
      available: false,
      detail: "Sonor bridge is disabled by ASTRA_SONOR_ENABLED.",
    };
  }

  if (!config.searchPath) {
    return {
      enabled: true,
      available: false,
      detail:
        "Sonor is configured locally, but no verified search endpoint contract is registered yet. Do not guess an API path from the Sonor UI.",
    };
  }

  return {
    enabled: true,
    available: true,
    detail: `Sonor bridge contract is configured at ${config.baseUrl}${config.searchPath}.`,
  };
}

export const sonorMemorySource: AstraMemorySource = {
  id: "sonor",
  kind: "sonor",
  async status() {
    const status = await getSonorBridgeStatus();
    return {
      available: status.available,
      detail: status.detail,
    };
  },
  async search(_query: AstraMemoryQuery): Promise<AstraMemorySourceResult> {
    const status = await getSonorBridgeStatus();

    if (!status.available) {
      return {
        source: "sonor",
        sourceType: "sonor",
        available: false,
        records: [],
        detail: status.detail,
      };
    }

    // The existing Sonor UI at 127.0.0.1:55127 is already the user's
    // Graphify/Obsidian/workflow aggregation layer. Its API schema has not been
    // verified in this repository yet, so ASTRA intentionally does not invent
    // request/response fields here. Phase 2 will implement the real adapter
    // after the local Sonor endpoint contract is inspected.
    return {
      source: "sonor",
      sourceType: "sonor",
      available: false,
      records: [],
      detail:
        "Sonor endpoint path is configured, but the response schema has not been verified yet.",
    };
  },
};
