import {
  lstat,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type { AstraPermissionLevel } from "@/lib/agent/capabilities";
import type {
  AstraEnvironmentCapability,
  AstraEnvironmentCapabilityAccess,
  AstraEnvironmentDevice,
  AstraEnvironmentDeviceKind,
  AstraEnvironmentDeviceState,
  AstraEnvironmentStore,
  AstraExtensionNetworkRequirement,
  AstraExtensionVerificationMethod,
} from "./contracts";

export const ASTRA_ENVIRONMENT_MAX_DEVICES = 128;
export const ASTRA_ENVIRONMENT_MAX_FILE_BYTES = 1024 * 1024;

let environmentMutationTail: Promise<void> = Promise.resolve();

async function withEnvironmentMutationLock<T>(run: () => Promise<T>) {
  const previous = environmentMutationTail;
  let release!: () => void;
  environmentMutationTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await run();
  } finally {
    release();
  }
}

export function getEnvironmentStorePath() {
  const configured = process.env.ASTRA_ENVIRONMENT_FILE?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".astra", "environment.json");
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Environment " + field + " must be an object.");
  }
  return value as Record<string, unknown>;
}

function requiredString(
  value: unknown,
  field: string,
  max: number,
) {
  if (typeof value !== "string") {
    throw new Error("Environment " + field + " must be a string.");
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) {
    throw new Error(
      "Environment " + field + " must contain 1-" + max + " characters.",
    );
  }
  return cleaned;
}

function iso(value: unknown, field: string) {
  const raw = requiredString(value, field, 80);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error("Environment " + field + " must be a timestamp.");
  }
  return new Date(parsed).toISOString();
}

function kind(value: unknown): AstraEnvironmentDeviceKind {
  if (
    value === "printer" ||
    value === "light" ||
    value === "smart_plug" ||
    value === "sensor" ||
    value === "camera" ||
    value === "service" ||
    value === "custom"
  ) {
    return value;
  }
  throw new Error("Environment device kind is invalid.");
}

function state(value: unknown): AstraEnvironmentDeviceState {
  if (
    value === "registered" ||
    value === "disabled" ||
    value === "revoked"
  ) {
    return value;
  }
  throw new Error("Environment device state is invalid.");
}

function network(value: unknown): AstraExtensionNetworkRequirement {
  if (
    value === "none" ||
    value === "loopback" ||
    value === "lan" ||
    value === "internet"
  ) {
    return value;
  }
  throw new Error("Environment network requirement is invalid.");
}

function access(value: unknown): AstraEnvironmentCapabilityAccess {
  if (value === "read" || value === "write") return value;
  throw new Error("Environment capability access is invalid.");
}

function verification(value: unknown): AstraExtensionVerificationMethod {
  if (
    value === "none" ||
    value === "health_check" ||
    value === "provider_status" ||
    value === "tool_probe" ||
    value === "manual_evidence"
  ) {
    return value;
  }
  throw new Error("Environment verification method is invalid.");
}

function permission(
  value: unknown,
): Exclude<AstraPermissionLevel, 4> {
  if (value === 0 || value === 1 || value === 2 || value === 3) {
    return value;
  }
  throw new Error("Environment permissionLevel must be 0-3.");
}

function idList(value: unknown, field: string, maxItems: number) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(
      "Environment " + field + " must be a bounded array.",
    );
  }
  const values = value.map((entry) => {
    const clean = requiredString(entry, field + " entry", 160);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(clean)) {
      throw new Error("Environment " + field + " entry is invalid.");
    }
    return clean;
  });
  return [...new Set(values)];
}

function capability(
  value: unknown,
  index: number,
): AstraEnvironmentCapability {
  const source = record(value, "capability " + (index + 1));
  const capabilityAccess = access(source.access);
  const level = permission(source.permissionLevel);
  if (capabilityAccess === "write" && level < 2) {
    throw new Error(
      "Environment write capability requires permission Level 2 or 3.",
    );
  }

  const toolId =
    source.toolId === undefined
      ? undefined
      : requiredString(source.toolId, "capability.toolId", 160);

  return {
    id: requiredString(source.id, "capability.id", 120),
    access: capabilityAccess,
    permissionLevel: level,
    ...(toolId ? { toolId } : {}),
    verification: verification(source.verification),
  };
}

export function normalizeEnvironmentDevice(
  value: unknown,
  index = 0,
): AstraEnvironmentDevice {
  const source = record(value, "device " + (index + 1));
  if (!Array.isArray(source.capabilities) || source.capabilities.length > 32) {
    throw new Error("Environment capabilities must be a bounded array.");
  }

  const deviceKind = kind(source.kind);
  const privacySensitive = source.privacySensitive === true;
  if (
    (deviceKind === "camera" || deviceKind === "sensor") &&
    !privacySensitive
  ) {
    throw new Error(
      "Camera/sensor environment devices must be marked privacySensitive.",
    );
  }

  const capabilities = source.capabilities.map(capability);
  const ids = new Set<string>();
  for (const entry of capabilities) {
    if (ids.has(entry.id)) {
      throw new Error(
        "Duplicate environment capability id: " + entry.id + ".",
      );
    }
    ids.add(entry.id);
  }

  return {
    id: requiredString(source.id, "id", 120),
    label: requiredString(source.label, "label", 160),
    kind: deviceKind,
    provider: requiredString(source.provider, "provider", 160),
    state: state(source.state),
    network: network(source.network),
    privacySensitive,
    secretReferences: idList(
      source.secretReferences,
      "secretReferences",
      24,
    ),
    capabilities,
    createdAt: iso(source.createdAt, "createdAt"),
    updatedAt: iso(source.updatedAt, "updatedAt"),
  };
}

export function normalizeEnvironmentStore(
  value: unknown,
): AstraEnvironmentStore {
  const root = record(value, "store");
  if (root.schemaVersion !== 1) {
    throw new Error("Unsupported environment registry schemaVersion.");
  }
  if (!Array.isArray(root.devices)) {
    throw new Error("Environment devices must be an array.");
  }
  if (root.devices.length > ASTRA_ENVIRONMENT_MAX_DEVICES) {
    throw new Error("Environment device limit exceeded.");
  }

  const devices = root.devices.map(normalizeEnvironmentDevice);
  const seen = new Set<string>();
  for (const device of devices) {
    const id = device.id.toLowerCase();
    if (seen.has(id)) {
      throw new Error("Duplicate environment device id: " + device.id + ".");
    }
    seen.add(id);
  }

  return { schemaVersion: 1, devices };
}

async function rejectSymlinkTarget(source: string) {
  try {
    const info = await lstat(source);
    if (info.isSymbolicLink()) {
      throw new Error("Environment registry must not be a symbolic link.");
    }
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code !== "ENOENT") throw error;
  }
}

export async function loadEnvironmentStore() {
  const source = getEnvironmentStorePath();
  try {
    await rejectSymlinkTarget(source);
    const info = await stat(source);
    if (info.size > ASTRA_ENVIRONMENT_MAX_FILE_BYTES) {
      throw new Error("Environment registry exceeds its file-size limit.");
    }
    const raw = await readFile(source, "utf8");
    const store = normalizeEnvironmentStore(JSON.parse(raw) as unknown);
    return {
      available: true,
      source,
      store,
      detail:
        "Loaded " +
        store.devices.length +
        " registered environment device" +
        (store.devices.length === 1 ? "." : "s."),
    };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "ENOENT") {
      return {
        available: true,
        source,
        store: { schemaVersion: 1 as const, devices: [] },
        detail:
          "Environment registry is ready; no private registry exists yet.",
      };
    }
    return {
      available: false,
      source,
      store: { schemaVersion: 1 as const, devices: [] },
      detail:
        error instanceof Error
          ? "Environment registry could not be loaded safely: " +
            error.message
          : "Environment registry could not be loaded safely.",
    };
  }
}

export async function saveEnvironmentStore(store: AstraEnvironmentStore) {
  const normalized = normalizeEnvironmentStore(
    JSON.parse(JSON.stringify(store)) as unknown,
  );
  const source = getEnvironmentStorePath();
  const payload = JSON.stringify(normalized, null, 2) + "\n";

  if (
    Buffer.byteLength(payload, "utf8") >
    ASTRA_ENVIRONMENT_MAX_FILE_BYTES
  ) {
    throw new Error("Environment registry exceeds its file-size limit.");
  }

  await mkdir(path.dirname(source), { recursive: true, mode: 0o700 });
  await rejectSymlinkTarget(source);
  await writeFile(source, payload, {
    encoding: "utf8",
    mode: 0o600,
  });
  return { source, count: normalized.devices.length };
}

export async function mutateEnvironmentStore<T>(
  mutate: (store: AstraEnvironmentStore) =>
    | { store: AstraEnvironmentStore; result: T }
    | Promise<{ store: AstraEnvironmentStore; result: T }>,
) {
  return withEnvironmentMutationLock(async () => {
    const loaded = await loadEnvironmentStore();
    if (!loaded.available) throw new Error(loaded.detail);
    const outcome = await mutate({
      schemaVersion: 1,
      devices: [...loaded.store.devices],
    });
    await saveEnvironmentStore(outcome.store);
    return outcome.result;
  });
}

export async function registerEnvironmentDevice(
  device: AstraEnvironmentDevice,
) {
  return mutateEnvironmentStore((store) => {
    const normalized = normalizeEnvironmentDevice(device);
    if (
      store.devices.some(
        (entry) => entry.id.toLowerCase() === normalized.id.toLowerCase(),
      )
    ) {
      throw new Error("Environment device id already exists.");
    }

    const safeDevice: AstraEnvironmentDevice = {
      ...normalized,
      state: "disabled",
    };
    const devices = [...store.devices, safeDevice];
    return {
      store: { schemaVersion: 1 as const, devices },
      result: safeDevice,
    };
  });
}

export async function setEnvironmentDeviceState({
  id,
  state: nextState,
  approvedPermissionLevel,
  now = new Date(),
}: {
  id: string;
  state: AstraEnvironmentDeviceState;
  approvedPermissionLevel: Exclude<AstraPermissionLevel, 4>;
  now?: Date;
}) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid environment state mutation time.");
  }
  return mutateEnvironmentStore((store) => {
    const index = store.devices.findIndex(
      (device) => device.id.toLowerCase() === id.trim().toLowerCase(),
    );
    if (index < 0) throw new Error("Environment device was not found.");

    const current = store.devices[index];
    const requiredPermissionLevel =
      nextState === "registered"
        ? Math.max(
            2,
            ...current.capabilities.map(
              (capability) => capability.permissionLevel,
            ),
          )
        : 2;

    if (approvedPermissionLevel < requiredPermissionLevel) {
      throw new Error(
        "Environment device state change requires permission Level-" +
          requiredPermissionLevel +
          ".",
      );
    }

    if (current.state === "revoked" && nextState !== "revoked") {
      throw new Error(
        "Revoked environment device cannot be reactivated; register a new identity.",
      );
    }
    const updated: AstraEnvironmentDevice = {
      ...current,
      state: nextState,
      updatedAt: now.toISOString(),
    };
    const devices = [...store.devices];
    devices[index] = updated;
    return {
      store: { schemaVersion: 1 as const, devices },
      result: updated,
    };
  });
}
