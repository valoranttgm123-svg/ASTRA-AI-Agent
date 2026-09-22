import {
  lstat,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type { AstraPermissionLevel } from "@/lib/agent/capabilities";
import type { AstraToolRegistry } from "@/lib/tools/contracts";
import type {
  AstraEnvironmentCapability,
  AstraEnvironmentCapabilityMode,
  AstraEnvironmentDevice,
  AstraEnvironmentDeviceHealth,
  AstraEnvironmentDeviceKind,
  AstraEnvironmentOperationPlan,
  AstraEnvironmentPrivacyClass,
  AstraEnvironmentStore,
} from "./contracts";

export const ASTRA_ENVIRONMENT_MAX_DEVICES = 128;
export const ASTRA_ENVIRONMENT_MAX_FILE_BYTES = 512 * 1024;

let mutationTail: Promise<void> = Promise.resolve();

async function withMutationLock<T>(run: () => Promise<T>) {
  const previous = mutationTail;
  let release!: () => void;
  mutationTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await run();
  } finally {
    release();
  }
}

export function getEnvironmentRegistryPath() {
  const configured = process.env.ASTRA_ENVIRONMENT_REGISTRY_FILE?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".astra", "environment-devices.json");
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Environment " + field + " must be an object.");
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, max: number) {
  if (typeof value !== "string") {
    throw new Error("Environment " + field + " must be a string.");
  }
  const clean = value.trim();
  if (!clean || clean.length > max) {
    throw new Error(
      "Environment " + field + " must contain 1-" + max + " characters.",
    );
  }
  return clean;
}

function identifier(value: unknown, field: string, max = 160) {
  const clean = requiredString(value, field, max);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(clean)) {
    throw new Error(
      "Environment " + field + " contains unsupported characters.",
    );
  }
  return clean;
}

function iso(value: unknown, field: string) {
  const raw = requiredString(value, field, 80);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error("Environment " + field + " must be an ISO timestamp.");
  }
  return new Date(parsed).toISOString();
}

function permission(value: unknown): AstraPermissionLevel {
  if (
    value === 0 ||
    value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4
  ) {
    return value;
  }
  throw new Error("Environment permissionLevel must be 0-4.");
}

function kind(value: unknown): AstraEnvironmentDeviceKind {
  if (
    value === "light" ||
    value === "smart_plug" ||
    value === "printer" ||
    value === "sensor" ||
    value === "camera" ||
    value === "local_service" ||
    value === "other"
  ) {
    return value;
  }
  throw new Error("Environment device kind is invalid.");
}

function privacy(value: unknown): AstraEnvironmentPrivacyClass {
  if (value === "standard" || value === "sensitive") return value;
  throw new Error("Environment privacy class is invalid.");
}

function mode(value: unknown): AstraEnvironmentCapabilityMode {
  if (value === "read" || value === "write") return value;
  throw new Error("Environment capability mode is invalid.");
}

function normalizeCapability(
  value: unknown,
  index: number,
): AstraEnvironmentCapability {
  const record = object(value, "capability " + (index + 1));
  const capabilityMode = mode(record.mode);
  const requiredPermission = permission(record.permissionLevel);

  if (capabilityMode === "read" && requiredPermission < 1) {
    throw new Error(
      "Environment read capability requires permission level 1 or higher.",
    );
  }
  if (capabilityMode === "write" && requiredPermission < 3) {
    throw new Error(
      "Environment write capability requires permission level 3 or higher.",
    );
  }

  return {
    id: identifier(record.id, "capability.id"),
    mode: capabilityMode,
    toolId: identifier(record.toolId, "capability.toolId"),
    permissionLevel: requiredPermission,
  };
}

export function normalizeEnvironmentDevice(
  value: unknown,
  index = 0,
): AstraEnvironmentDevice {
  const record = object(value, "device " + (index + 1));
  if (!Array.isArray(record.capabilities) || record.capabilities.length > 32) {
    throw new Error("Environment capabilities must be a bounded array.");
  }

  const deviceKind = kind(record.kind);
  const privacyClass = privacy(record.privacyClass);
  if (
    (deviceKind === "camera" || deviceKind === "sensor") &&
    privacyClass !== "sensitive"
  ) {
    throw new Error(
      "Camera and sensor devices must use sensitive privacy classification.",
    );
  }
  if (typeof record.enabled !== "boolean") {
    throw new Error("Environment enabled must be boolean.");
  }

  const capabilities = record.capabilities.map(normalizeCapability);
  const ids = new Set<string>();
  for (const capability of capabilities) {
    const key = capability.id.toLowerCase();
    if (ids.has(key)) {
      throw new Error(
        "Duplicate environment capability id: " + capability.id + ".",
      );
    }
    ids.add(key);
  }

  return {
    id: identifier(record.id, "device.id"),
    label: requiredString(record.label, "device.label", 160),
    kind: deviceKind,
    provider: requiredString(record.provider, "device.provider", 240),
    enabled: record.enabled,
    privacyClass,
    capabilities,
    createdAt: iso(record.createdAt, "createdAt"),
    updatedAt: iso(record.updatedAt, "updatedAt"),
  };
}

export function normalizeEnvironmentStore(
  value: unknown,
): AstraEnvironmentStore {
  const root = object(value, "store");
  if (root.schemaVersion !== 1) {
    throw new Error("Unsupported environment registry schemaVersion.");
  }
  if (!Array.isArray(root.devices)) {
    throw new Error("Environment registry devices must be an array.");
  }
  if (root.devices.length > ASTRA_ENVIRONMENT_MAX_DEVICES) {
    throw new Error("Environment registry device limit exceeded.");
  }

  const devices = root.devices.map(normalizeEnvironmentDevice);
  const ids = new Set<string>();
  for (const device of devices) {
    const key = device.id.toLowerCase();
    if (ids.has(key)) {
      throw new Error("Duplicate environment device id: " + device.id + ".");
    }
    ids.add(key);
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
  const source = getEnvironmentRegistryPath();
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
        " explicitly registered environment device" +
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
          "Environment registry is ready; no private explicit device registry exists yet.",
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
  const source = getEnvironmentRegistryPath();
  const payload = JSON.stringify(normalized, null, 2) + "\n";
  if (
    Buffer.byteLength(payload, "utf8") >
    ASTRA_ENVIRONMENT_MAX_FILE_BYTES
  ) {
    throw new Error("Environment registry exceeds its file-size limit.");
  }

  await mkdir(path.dirname(source), { recursive: true, mode: 0o700 });
  await rejectSymlinkTarget(source);
  await writeFile(source, payload, { encoding: "utf8", mode: 0o600 });
  return { source, count: normalized.devices.length };
}

async function mutateEnvironmentStore<T>(
  mutate: (store: AstraEnvironmentStore) =>
    | { store: AstraEnvironmentStore; result: T }
    | Promise<{ store: AstraEnvironmentStore; result: T }>,
) {
  return withMutationLock(async () => {
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

export async function registerEnvironmentDevice({
  id,
  label,
  kind: deviceKind,
  provider,
  privacyClass,
  capabilities,
  now = new Date(),
}: {
  id: string;
  label: string;
  kind: AstraEnvironmentDeviceKind;
  provider: string;
  privacyClass: AstraEnvironmentPrivacyClass;
  capabilities: AstraEnvironmentCapability[];
  now?: Date;
}) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid environment registration time.");
  }

  return mutateEnvironmentStore((store) => {
    if (
      store.devices.some(
        (device) => device.id.toLowerCase() === id.trim().toLowerCase(),
      )
    ) {
      throw new Error("Environment device id already exists.");
    }

    const device = normalizeEnvironmentDevice({
      id,
      label,
      kind: deviceKind,
      provider,
      enabled: false,
      privacyClass,
      capabilities,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    return {
      store: {
        schemaVersion: 1 as const,
        devices: [...store.devices, device],
      },
      result: device,
    };
  });
}

export async function setEnvironmentDeviceEnabled({
  deviceId,
  enabled,
  now = new Date(),
}: {
  deviceId: string;
  enabled: boolean;
  now?: Date;
}) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid environment mutation time.");
  }

  return mutateEnvironmentStore((store) => {
    const index = store.devices.findIndex(
      (device) =>
        device.id.toLowerCase() === deviceId.trim().toLowerCase(),
    );
    if (index < 0) throw new Error("Environment device was not found.");

    const devices = [...store.devices];
    devices[index] = normalizeEnvironmentDevice({
      ...devices[index],
      enabled,
      updatedAt: now.toISOString(),
    });
    return {
      store: { schemaVersion: 1 as const, devices },
      result: devices[index],
    };
  });
}

export function checkEnvironmentDeviceHealth({
  device,
  tools,
}: {
  device: AstraEnvironmentDevice;
  tools: AstraToolRegistry;
}): AstraEnvironmentDeviceHealth {
  if (!device.enabled) {
    return {
      deviceId: device.id,
      status: "DISABLED",
      detail: "Explicitly registered environment device is disabled.",
    };
  }

  for (const capability of device.capabilities) {
    const tool = tools.get(capability.toolId);
    if (!tool) {
      return {
        deviceId: device.id,
        status: "NOT_CONFIGURED",
        detail:
          "Mapped environment tool is not registered: " +
          capability.toolId +
          ".",
      };
    }
    if (capability.permissionLevel < tool.permissionLevel) {
      return {
        deviceId: device.id,
        status: "ERROR",
        detail:
          "Environment capability " +
          capability.id +
          " understates mapped tool permission.",
      };
    }
    if (capability.mode === "read" && tool.sideEffect !== "read") {
      return {
        deviceId: device.id,
        status: "ERROR",
        detail:
          "Read environment capability " +
          capability.id +
          " maps to a mutating tool.",
      };
    }
    if (capability.mode === "write" && tool.sideEffect === "read") {
      return {
        deviceId: device.id,
        status: "ERROR",
        detail:
          "Write environment capability " +
          capability.id +
          " maps to a read-only tool.",
      };
    }
    if (tool.availability !== "READY") {
      return {
        deviceId: device.id,
        status: "NOT_CONFIGURED",
        detail:
          "Mapped tool " +
          tool.id +
          " is " +
          tool.availability +
          ".",
      };
    }
  }

  return {
    deviceId: device.id,
    status: "READY",
    detail:
      "Explicit environment device is enabled and mapped tools are verified READY.",
  };
}

export function planEnvironmentOperation({
  device,
  capabilityId,
  approvedPermissionLevel,
  privacyConsent = false,
}: {
  device: AstraEnvironmentDevice;
  capabilityId: string;
  approvedPermissionLevel: AstraPermissionLevel;
  privacyConsent?: boolean;
}): AstraEnvironmentOperationPlan {
  const base = {
    deviceId: device.id,
    capabilityId,
  };

  if (!device.enabled) {
    return {
      ...base,
      allowed: false,
      requiresApproval: false,
      detail: "Environment device is disabled.",
    };
  }

  const capability = device.capabilities.find(
    (candidate) =>
      candidate.id.toLowerCase() === capabilityId.trim().toLowerCase(),
  );
  if (!capability) {
    return {
      ...base,
      allowed: false,
      requiresApproval: false,
      detail: "Environment capability is not explicitly registered.",
    };
  }

  const operationBase = {
    ...base,
    toolId: capability.toolId,
    mode: capability.mode,
    requiredPermissionLevel: capability.permissionLevel,
    requiresApproval: capability.mode === "write",
  };

  if (device.privacyClass === "sensitive" && !privacyConsent) {
    return {
      ...operationBase,
      allowed: false,
      detail:
        "Sensitive camera/sensor access requires explicit privacy consent for this operation.",
    };
  }

  if (approvedPermissionLevel < capability.permissionLevel) {
    return {
      ...operationBase,
      allowed: false,
      detail:
        "Approved permission level is below the registered capability requirement.",
    };
  }

  return {
    ...operationBase,
    allowed: true,
    detail:
      capability.mode === "write"
        ? "Environment write is permitted only through the mapped Tool Runtime path; scoped approval remains required."
        : "Environment read may proceed through the mapped read-only Tool Runtime path.",
  };
}
