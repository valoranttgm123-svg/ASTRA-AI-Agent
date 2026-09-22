import type { AstraPermissionLevel } from "@/lib/agent/capabilities";

export type AstraDeviceNodeState = "pending" | "paired" | "revoked";
export type AstraDeviceTransport = "local" | "lan" | "ssh" | "relay";

export type AstraDeviceNode = {
  id: string;
  trustedDeviceId: string;
  label: string;
  state: AstraDeviceNodeState;
  transport: AstraDeviceTransport;
  maxPermissionLevel: Exclude<AstraPermissionLevel, 4>;
  capabilities: string[];
  createdAt: string;
  updatedAt: string;
};

export type AstraDeviceStore = {
  schemaVersion: 1;
  devices: AstraDeviceNode[];
};

export type AstraDeviceAdvertisement = {
  deviceId: string;
  online: true;
  capabilities: string[];
  observedAt: string;
  expiresAt: string;
};

export type AstraDeviceRouteRequest = {
  capability: string;
  requiredPermissionLevel: Exclude<AstraPermissionLevel, 4>;
  projectId?: string;
};

export type AstraDeviceRouteCandidate = {
  deviceId: string;
  label: string;
  transport: AstraDeviceTransport;
  capability: string;
  permissionCeiling: Exclude<AstraPermissionLevel, 4>;
  requiresApproval: boolean;
  detail: string;
};

export type AstraDeviceRoutePlan = {
  selected?: AstraDeviceRouteCandidate;
  candidates: AstraDeviceRouteCandidate[];
  detail: string;
};

export type AstraPairingChallengePublic = {
  id: string;
  deviceId: string;
  token: string;
  expiresAt: string;
};
