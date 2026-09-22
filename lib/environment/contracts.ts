import type { AstraPermissionLevel } from "@/lib/agent/capabilities";

export type AstraEnvironmentDeviceKind =
  | "light"
  | "smart_plug"
  | "printer"
  | "sensor"
  | "camera"
  | "local_service"
  | "other";

export type AstraEnvironmentPrivacyClass = "standard" | "sensitive";
export type AstraEnvironmentCapabilityMode = "read" | "write";

export type AstraEnvironmentCapability = {
  id: string;
  mode: AstraEnvironmentCapabilityMode;
  toolId: string;
  permissionLevel: AstraPermissionLevel;
};

export type AstraEnvironmentDevice = {
  id: string;
  label: string;
  kind: AstraEnvironmentDeviceKind;
  provider: string;
  enabled: boolean;
  privacyClass: AstraEnvironmentPrivacyClass;
  capabilities: AstraEnvironmentCapability[];
  createdAt: string;
  updatedAt: string;
};

export type AstraEnvironmentStore = {
  schemaVersion: 1;
  devices: AstraEnvironmentDevice[];
};

export type AstraEnvironmentHealthStatus =
  | "READY"
  | "DISABLED"
  | "NOT_CONFIGURED"
  | "ERROR";

export type AstraEnvironmentDeviceHealth = {
  deviceId: string;
  status: AstraEnvironmentHealthStatus;
  detail: string;
};

export type AstraEnvironmentOperationPlan = {
  allowed: boolean;
  deviceId: string;
  capabilityId: string;
  toolId?: string;
  mode?: AstraEnvironmentCapabilityMode;
  requiredPermissionLevel?: AstraPermissionLevel;
  requiresApproval: boolean;
  detail: string;
};
