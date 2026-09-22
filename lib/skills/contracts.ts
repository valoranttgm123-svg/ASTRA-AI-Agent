import type { AstraPermissionLevel } from "@/lib/agent/capabilities";

export type AstraSkillTrustState = "untrusted" | "reviewed";
export type AstraSkillInstallState =
  | "registered"
  | "installed"
  | "incompatible";
export type AstraSkillUpdateState =
  | "current"
  | "update_available"
  | "error";
export type AstraSkillNetworkRequirement = "none" | "local" | "internet";
export type AstraSkillHealthStatus =
  | "READY"
  | "DISABLED"
  | "NOT_CONFIGURED"
  | "ERROR";

export type AstraSkillRollbackMetadata = {
  version: string;
  checksum?: string;
  artifactRef?: string;
  recordedAt: string;
};

export type AstraSkillManifest = {
  id: string;
  version: string;
  capability: string;
  toolIds: string[];
  provider: string;
  permissionLevel: AstraPermissionLevel;
  network: AstraSkillNetworkRequirement;
  secretNames: string[];
  verificationMethod: string;
  installState: AstraSkillInstallState;
  updateState: AstraSkillUpdateState;
  trustState: AstraSkillTrustState;
  enabled: boolean;
  checksum?: string;
  installedAt?: string;
  updatedAt: string;
  rollback?: AstraSkillRollbackMetadata;
};

export type AstraSkillStore = {
  schemaVersion: 1;
  skills: AstraSkillManifest[];
};

export type AstraSkillMutationAction =
  | "review"
  | "install"
  | "enable"
  | "disable"
  | "update"
  | "rollback"
  | "remove";

export type AstraSkillMutationPlan = {
  action: AstraSkillMutationAction;
  skillId: string;
  allowed: boolean;
  requiredPermissionLevel: 2;
  requiresVerification: boolean;
  detail: string;
};

export type AstraSkillHealth = {
  skillId: string;
  status: AstraSkillHealthStatus;
  detail: string;
};
