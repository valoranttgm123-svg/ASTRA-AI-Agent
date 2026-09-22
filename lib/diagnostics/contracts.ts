import type { AstraPermissionLevel } from "@/lib/agent/capabilities";

export type AstraHealthStatus =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "not_configured";

export type AstraHealthScope =
  | "local_core"
  | "local_optional"
  | "cloud"
  | "integration";

export type AstraRuntimeMode =
  | "online_capable"
  | "local_only"
  | "degraded"
  | "unknown";

export type AstraRecoveryKind =
  | "reconnect"
  | "retry_worker"
  | "clear_transient_cache"
  | "restart_owned_service";

export type AstraHealthProbeResult = {
  status: AstraHealthStatus;
  detail: string;
};

export type AstraHealthProbe = {
  id: string;
  label: string;
  scope: AstraHealthScope;
  critical: boolean;
  recovery?: {
    kind: AstraRecoveryKind;
    requiredPermissionLevel: AstraPermissionLevel;
  };
  check: (signal: AbortSignal) => Promise<AstraHealthProbeResult>;
};

export type AstraMeasuredHealthResult = {
  id: string;
  label: string;
  scope: AstraHealthScope;
  critical: boolean;
  status: AstraHealthStatus;
  detail: string;
  latencyMs: number;
  recovery?: {
    kind: AstraRecoveryKind;
    requiredPermissionLevel: AstraPermissionLevel;
  };
};

export type AstraHealthSnapshot = {
  capturedAt: string;
  mode: AstraRuntimeMode;
  results: AstraMeasuredHealthResult[];
};

export type AstraRecoveryProposal = {
  probeId: string;
  kind: AstraRecoveryKind;
  requiredPermissionLevel: AstraPermissionLevel;
  autoEligible: boolean;
  detail: string;
};

export type AstraAuditActorKind =
  | "user"
  | "agent"
  | "tool"
  | "service";

export type AstraAuditOutcome =
  | "attempted"
  | "succeeded"
  | "failed"
  | "blocked"
  | "cancelled";

export type AstraAuditEntry = {
  id: string;
  at: string;
  actorKind: AstraAuditActorKind;
  actorId: string;
  action: string;
  target?: string;
  projectId?: string;
  permissionLevel: AstraPermissionLevel;
  outcome: AstraAuditOutcome;
  verified: boolean;
  verification?: string;
  detail: string;
};

export type AstraAuditStore = {
  schemaVersion: 1;
  entries: AstraAuditEntry[];
};
