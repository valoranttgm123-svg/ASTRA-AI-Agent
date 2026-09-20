export type {
  AstraAutomationDefinition,
  AstraAutomationDueState,
  AstraAutomationRunDecision,
  AstraAutomationSchedule,
  AstraAutomationStatus,
} from "./contracts";

export {
  ASTRA_AUTOMATION_MAX_INTERVAL_MINUTES,
  ASTRA_AUTOMATION_MAX_RUNTIME_MS,
  ASTRA_AUTOMATION_MIN_INTERVAL_MINUTES,
  evaluateAutomationRun,
  getAutomationDueState,
  validateAutomationDefinition,
} from "./scheduler";

export type { AstraAutomationStoreContext } from "./store";

export {
  ASTRA_AUTOMATION_MAX_ENTRIES,
  ASTRA_AUTOMATION_MAX_FILE_BYTES,
  getAutomationStorePath,
  loadAutomationStore,
  normalizeAutomationDefinitions,
  saveAutomationStore,
} from "./store";
