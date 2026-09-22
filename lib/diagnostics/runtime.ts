import { loadAutomationStore } from "@/lib/automation/store";
import { getAutomationServiceStatus } from "@/lib/automation/service";
import { loadEventStore } from "@/lib/events/store";
import { loadTaskStore } from "@/lib/tasks/store";
import { AstraHealthRegistry } from "./health";

export function createLocalDiagnosticsRegistry() {
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

  return registry;
}
