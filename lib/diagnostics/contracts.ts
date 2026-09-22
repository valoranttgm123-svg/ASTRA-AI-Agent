import type { AstraPermissionLevel } from "@/lib/agent/capabilities";
import type { AstraAgentKey } from "@/lib/agent/types";

export type AstraHealthStatus =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "not_configured"
  | "unknown";

export type AstraHealthCategory =
  | "runtime"
  | "provider"
  | "memory"
  | "worker"
  | "input"
  | "integration"
  | "storage";

export type AstraHealthSample = {
  id: string;
  category: AstraHealthCategory;
  status: AstraHealthStatus;
  critical: boolean;
  checkedAt: string;
  detail: string;
  latencyMs?: number;
};

export type AstraConnectivityState = "online" | "offline" | "unknown";

export type AstraOperatingMode =
  | "online"
  | "degraded"
  | "offline"
  | "unknown";

export type AstraDiagnosticsSnapshot = {
  capturedAt: string;
  connectivity: AstraConnectivityState;
  operatingMode: AstraOperatingMode;
  samples: AstraHealthSample[];
  healthy: number;
  degraded: number;
  unavailable: number;
  notConfigured: number;
  unknown: number;
};

export type AstraRecoveryAction =
  | "reconnect_provider"
  | "retry_worker"
  | "fallback_local"
  | "restart_astra_service"
  | "clear_transient_cache";

export type AstraRecoveryPlan = {
  healthId: string;
  healthStatus: AstraHealthStatus;
  action: AstraRecoveryAction;
  permissionLevel: AstraPermissionLevel;
  requiresApproval: boolean;
  executable: false;
  detail: string;
};

export type AstraAuditOutcome =
  | "success"
  | "failure"
  | "blocked"
  | "cancelled";

export type AstraAuditCategory =
  | "brain"
  | "tool"
  | "automation"
  | "task"
  | "event"
  | "provider"
  | "memory"
  | "system"
  | "security";

export type AstraAuditActor =
  | { kind: "system"; id: "astra" }
  | { kind: "user"; id: string }
  | { kind: "agent"; id: AstraAgentKey }
  | { kind: "tool"; id: string };

export type AstraAuditEntry = {
  id: string;
  at: string;
  category: AstraAuditCategory;
  actor: AstraAuditActor;
  action: string;
  resource?: string;
  projectId?: string;
  permissionLevel?: AstraPermissionLevel;
  outcome: AstraAuditOutcome;
  detail: string;
  verification?: string;
  failure?: string;
};

export type AstraAuditStore = {
  schemaVersion: 1;
  entries: AstraAuditEntry[];
};
