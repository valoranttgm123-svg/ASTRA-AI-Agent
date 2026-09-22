import type {
  AstraHealthSample,
  AstraRecoveryAction,
  AstraRecoveryPlan,
} from "./contracts";

const ACTION_PERMISSION: Record<AstraRecoveryAction, 1 | 2> = {
  reconnect_provider: 1,
  retry_worker: 1,
  fallback_local: 1,
  restart_astra_service: 2,
  clear_transient_cache: 2,
};

export function planSafeRecovery({
  sample,
  supportedActions,
}: {
  sample: AstraHealthSample;
  supportedActions: readonly AstraRecoveryAction[];
}): AstraRecoveryPlan[] {
  if (
    sample.status === "healthy" ||
    sample.status === "not_configured" ||
    sample.status === "unknown"
  ) {
    return [];
  }

  const unique = [...new Set(supportedActions)];
  return unique.map((action) => {
    const permissionLevel = ACTION_PERMISSION[action];
    return {
      healthId: sample.id,
      healthStatus: sample.status,
      action,
      permissionLevel,
      requiresApproval: permissionLevel >= 2,
      executable: false as const,
      detail:
        "Recovery proposal only. ASTRA Tool Runtime/approval must perform and verify any real action.",
    };
  });
}
