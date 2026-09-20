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

export type {
  AstraAutomationLifecycleEvent,
  AstraAutomationLifecycleEventType,
  AstraAutomationQueueItem,
  AstraAutomationTickPlan,
} from "./queue";

export {
  ASTRA_AUTOMATION_MAX_READY_PER_TICK,
  ASTRA_AUTOMATION_MAX_WAITING_APPROVAL_PER_TICK,
  planAutomationTick,
} from "./queue";

export type {
  AstraAutomationExecutionOutcome,
  AstraAutomationExecutor,
  AstraAutomationRunRecord,
  AstraAutomationTickResult,
} from "./runner";
export type { AstraAutomationClaimResult } from "./store";

export { runAutomationTickFromStore } from "./runner";
export { claimAutomationOccurrence } from "./store";

export type {
  AstraAutomationMutation,
} from "./http";
export type {
  AstraAutomationMutationResult,
  AstraAutomationUpsertInput,
} from "./management";

export { parseAutomationMutation } from "./http";
export {
  deleteAutomationDefinition,
  setAutomationDefinitionStatus,
  upsertAutomationDefinition,
} from "./management";
export { automationEventToBrainEvent } from "./telemetry";
