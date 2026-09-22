import type { AstraPermissionLevel } from "@/lib/agent/capabilities";

export type AstraExtensionNetworkRequirement =
  | "none"
  | "loopback"
  | "lan"
  | "internet";

export type AstraExtensionInstallState =
  | "available"
  | "installed"
  | "disabled"
  | "incompatible";

export type AstraExtensionTrustState =
  | "builtin"
  | "local_reviewed"
  | "unreviewed";

export type AstraExtensionUpdateState =
  | "current"
  | "update_available"
  | "unknown";

export type AstraExtensionHealthState =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "not_configured"
  | "unknown";

export type AstraExtensionVerificationMethod =
  | "none"
  | "health_check"
  | "provider_status"
  | "tool_probe"
  | "manual_evidence";

export type AstraExtensionRollback = {
  supported: boolean;
  previousVersion?: string;
  detail: string;
};

export type AstraExtensionSkillManifest = {
  id: string;
  version: string;
  provider: string;
  source: string;
  checksum?: string;
  trust: AstraExtensionTrustState;
  installState: AstraExtensionInstallState;
  updateState: AstraExtensionUpdateState;
  capabilities: string[];
  toolMappings: string[];
  permissionLevel: Exclude<AstraPermissionLevel, 4>;
  network: AstraExtensionNetworkRequirement;
  secretReferences: string[];
  verification: AstraExtensionVerificationMethod;
  rollback: AstraExtensionRollback;
  updatedAt: string;
};

export type AstraExtensionSkillStore = {
  schemaVersion: 1;
  skills: AstraExtensionSkillManifest[];
};

export type AstraExtensionMutationAction =
  | "install"
  | "update"
  | "enable"
  | "disable"
  | "remove"
  | "rollback";

export type AstraExtensionVerificationEvidence = {
  method: Exclude<AstraExtensionVerificationMethod, "none">;
  verified: true;
  at: string;
  detail: string;
};

export type AstraExtensionHealthObservation = {
  skillId: string;
  state: AstraExtensionHealthState;
  checkedAt: string;
  detail: string;
};

export type AstraExtensionMutationPlan = {
  skillId: string;
  action: AstraExtensionMutationAction;
  allowed: boolean;
  currentState?: AstraExtensionInstallState;
  targetState?: AstraExtensionInstallState;
  requiredPermissionLevel: 2;
  executionAuthority: false;
  detail: string;
};

export type AstraEnvironmentDeviceKind =
  | "printer"
  | "light"
  | "smart_plug"
  | "sensor"
  | "camera"
  | "service"
  | "custom";

export type AstraEnvironmentDeviceState =
  | "registered"
  | "disabled"
  | "revoked";

export type AstraEnvironmentCapabilityAccess = "read" | "write";

export type AstraEnvironmentCapability = {
  id: string;
  access: AstraEnvironmentCapabilityAccess;
  permissionLevel: Exclude<AstraPermissionLevel, 4>;
  toolId?: string;
  verification: AstraExtensionVerificationMethod;
};

export type AstraEnvironmentDevice = {
  id: string;
  label: string;
  kind: AstraEnvironmentDeviceKind;
  provider: string;
  state: AstraEnvironmentDeviceState;
  network: AstraExtensionNetworkRequirement;
  privacySensitive: boolean;
  secretReferences: string[];
  capabilities: AstraEnvironmentCapability[];
  createdAt: string;
  updatedAt: string;
};

export type AstraEnvironmentStore = {
  schemaVersion: 1;
  devices: AstraEnvironmentDevice[];
};

export type AstraEnvironmentActionPlan = {
  deviceId: string;
  capabilityId: string;
  access: AstraEnvironmentCapabilityAccess;
  allowed: boolean;
  requiredPermissionLevel: Exclude<AstraPermissionLevel, 4>;
  requiresApproval: boolean;
  executionAuthority: false;
  toolId?: string;
  detail: string;
};
