import type { AstraPermissionLevel } from "@/lib/agent/capabilities";
import type {
  AstraHealthSnapshot,
  AstraRecoveryKind,
  AstraRecoveryProposal,
} from "./contracts";

const RECOVERY_PERMISSION_FLOOR: Record<
  AstraRecoveryKind,
  AstraPermissionLevel
> = {
  reconnect: 1,
  retry_worker: 1,
  clear_transient_cache: 2,
  restart_owned_service: 2,
};

function maxPermission(
  left: AstraPermissionLevel,
  right: AstraPermissionLevel,
): AstraPermissionLevel {
  return Math.max(left, right) as AstraPermissionLevel;
}

export function planSafeRecovery(
  snapshot: AstraHealthSnapshot,
): AstraRecoveryProposal[] {
  return snapshot.results.flatMap((result) => {
    if (
      (result.status !== "degraded" &&
        result.status !== "unavailable") ||
      !result.recovery
    ) {
      return [];
    }

    const requiredPermissionLevel = maxPermission(
      result.recovery.requiredPermissionLevel,
      RECOVERY_PERMISSION_FLOOR[result.recovery.kind],
    );

    return [
      {
        probeId: result.id,
        kind: result.recovery.kind,
        requiredPermissionLevel,
        autoEligible:
          requiredPermissionLevel <= 1 &&
          (result.recovery.kind === "reconnect" ||
            result.recovery.kind === "retry_worker"),
        detail:
          "Recovery is a proposal only. Execution must go through ASTRA Tool Runtime and permission policy.",
      },
    ];
  });
}
