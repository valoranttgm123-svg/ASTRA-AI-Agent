import { loadAutomationStore } from "@/lib/automation/store";
import { getAutomationServiceStatus } from "@/lib/automation/service";
import { getCloudStatus } from "@/lib/brain/cloud";
import { getCodexStatus } from "@/lib/brain/codex";
import { getHermesStatus } from "@/lib/brain/hermes";
import { getNvidiaStatus } from "@/lib/brain/nvidia";
import { getOllamaStatus } from "@/lib/brain/ollama";
import { getPermissionPolicy } from "@/lib/brain/policy";
import { loadEventStore } from "@/lib/events/store";
import { getSonorBridgeConfig } from "@/lib/memory/sonor";
import { loadTaskStore } from "@/lib/tasks/store";
import type { AstraHealthStatus } from "./contracts";
import { AstraHealthRegistry } from "./health";

type ProviderProbeStatus = {
  enabled: boolean;
  available: boolean;
  detail: string;
};

export type AstraDiagnosticsProviderProbes = {
  ollama: () => Promise<ProviderProbeStatus>;
  codex: () => Promise<ProviderProbeStatus>;
  nvidia: () => Promise<ProviderProbeStatus>;
  hermes: () => Promise<ProviderProbeStatus>;
  cloud: () => Promise<ProviderProbeStatus>;
};

function providerHealth(status: ProviderProbeStatus): {
  status: AstraHealthStatus;
  detail: string;
} {
  if (!status.enabled) {
    return {
      status: "not_configured",
      detail: status.detail,
    };
  }

  return {
    status: status.available ? "healthy" : "unavailable",
    detail: status.detail,
  };
}

function defaultProviderProbes(): AstraDiagnosticsProviderProbes {
  const policy = getPermissionPolicy();
  return {
    ollama: getOllamaStatus,
    codex: () => getCodexStatus(policy),
    nvidia: getNvidiaStatus,
    hermes: getHermesStatus,
    cloud: () => getCloudStatus(policy),
  };
}

export function createLocalDiagnosticsRegistry({
  providerProbes = defaultProviderProbes(),
}: {
  providerProbes?: AstraDiagnosticsProviderProbes;
} = {}) {
  const registry = new AstraHealthRegistry();

  registry.register({
    id: "storage.events",
    category: "storage",
    critical: false,
    check: async () => {
      const loaded = await loadEventStore();
      return {
        status: loaded.available ? "healthy" : "unavailable",
        detail: loaded.detail,
      };
    },
  });

  registry.register({
    id: "storage.tasks",
    category: "storage",
    critical: true,
    check: async () => {
      const loaded = await loadTaskStore();
      return {
        status: loaded.available ? "healthy" : "unavailable",
        detail: loaded.detail,
      };
    },
  });

  registry.register({
    id: "storage.automation",
    category: "storage",
    critical: false,
    check: async () => {
      const loaded = await loadAutomationStore();
      if (!loaded.enabled) {
        return {
          status: "not_configured" as const,
          detail: loaded.detail,
        };
      }
      return {
        status: loaded.available ? "healthy" as const : "unavailable" as const,
        detail: loaded.detail,
      };
    },
  });

  registry.register({
    id: "worker.automation",
    category: "worker",
    critical: false,
    check: async () => {
      const status = getAutomationServiceStatus();
      if (!status.enabled) {
        return {
          status: "not_configured" as const,
          detail: status.lastDetail,
        };
      }
      return {
        status: status.running ? "healthy" as const : "degraded" as const,
        detail: status.lastDetail,
      };
    },
  });

  for (const [id, probe] of Object.entries(providerProbes) as Array<
    [keyof AstraDiagnosticsProviderProbes, () => Promise<ProviderProbeStatus>]
  >) {
    registry.register({
      id: "provider." + id,
      category: "provider",
      critical: false,
      check: async () => providerHealth(await probe()),
    });
  }

  registry.register({
    id: "memory.sonor",
    category: "memory",
    critical: false,
    check: async () => {
      const config = getSonorBridgeConfig();
      if (!config.enabled) {
        return {
          status: "not_configured" as const,
          detail: "Sonor bridge is disabled by ASTRA_SONOR_ENABLED.",
        };
      }
      if (!config.searchPath) {
        return {
          status: "not_configured" as const,
          detail:
            "Sonor is configured locally, but no verified ASTRA-compatible search endpoint is configured.",
        };
      }
      return {
        status: "unknown" as const,
        detail:
          "Sonor bridge configuration is present, but Diagnostics does not claim live Sonor health without verified real search or a non-destructive health endpoint.",
      };
    },
  });

  return registry;
}
