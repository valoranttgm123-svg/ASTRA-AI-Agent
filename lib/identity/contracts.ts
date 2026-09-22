import type { AstraPermissionLevel } from "@/lib/agent/capabilities";

export type AstraTrustRole = "guest" | "trusted_user" | "owner";
export type AstraSessionState = "locked" | "unlocked";
export type AstraTrustedDeviceState = "pending" | "trusted" | "revoked";

export type AstraIdentityScope =
  | "brain.chat"
  | "memory.read"
  | "files.read"
  | "computer.local"
  | "automation.manage"
  | "external.write"
  | "secrets.use"
  | "device.route";

export type AstraTrustedDevice = {
  id: string;
  label: string;
  fingerprintHash: string;
  state: AstraTrustedDeviceState;
  scopes: AstraIdentityScope[];
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
};

export type AstraTrustStore = {
  schemaVersion: 1;
  devices: AstraTrustedDevice[];
};

export type AstraSessionUnlockEvidence = {
  method: "os_session" | "explicit_owner_approval";
  verifiedAt: string;
  detail: string;
};

export type AstraIdentitySession = {
  id: string;
  principalId: string;
  role: AstraTrustRole;
  deviceId?: string;
  state: AstraSessionState;
  scopes: AstraIdentityScope[];
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
  unlockedAt?: string;
  unlockEvidence?: AstraSessionUnlockEvidence;
};

export type AstraIdentityPermissionView = {
  sessionId: string;
  role: AstraTrustRole;
  state: AstraSessionState;
  permissionCeiling: AstraPermissionLevel;
  scopes: AstraIdentityScope[];
  canUseSecrets: boolean;
  canRequestExternalWrite: boolean;
  detail: string;
};

export type AstraSecretReference = {
  id: string;
  providerId: string;
  secretName: string;
  purpose: string;
};

export type AstraSecretPresence = {
  referenceId: string;
  providerId: string;
  configured: boolean;
  detail: string;
};
