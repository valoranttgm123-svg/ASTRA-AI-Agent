import {
  lstat,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type { AstraPermissionLevel } from "@/lib/agent/capabilities";
import type { AstraTrustedDeviceState } from "@/lib/identity/contracts";
import type {
  AstraDeviceNode,
  AstraDeviceNodeState,
  AstraDeviceStore,
  AstraDeviceTransport,
} from "./contracts";

export const ASTRA_DEVICE_MAX_ENTRIES = 64;
export const ASTRA_DEVICE_MAX_FILE_BYTES = 512 * 1024;

let deviceMutationTail: Promise<void> = Promise.resolve();

async function withDeviceMutationLock<T>(run: () => Promise<T>) {
  const previous = deviceMutationTail;
  let release!: () => void;
  deviceMutationTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await run();
  } finally {
    release();
  }
}

export function getDeviceStorePath() {
  const configured = process.env.ASTRA_DEVICE_FILE?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".astra", "devices.json");
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Device " + field + " must be an object.");
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string, max: number) {
  if (typeof value !== "string") {
    throw new Error("Device " + field + " must be a string.");
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) {
    throw new Error(
      "Device " + field + " must contain 1-" + max + " characters.",
    );
  }
  return cleaned;
}

function iso(value: unknown, field: string) {
  const raw = string(value, field, 80);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error("Device " + field + " must be a timestamp.");
  }
  return new Date(parsed).toISOString();
}

function state(value: unknown): AstraDeviceNodeState {
  if (value === "pending" || value === "paired" || value === "revoked") {
    return value;
  }
  throw new Error("Device state is invalid.");
}

function transport(value: unknown): AstraDeviceTransport {
  if (
    value === "local" ||
    value === "lan" ||
    value === "ssh" ||
    value === "relay"
  ) {
    return value;
  }
  throw new Error("Device transport is invalid.");
}

function permission(
  value: unknown,
): Exclude<AstraPermissionLevel, 4> {
  if (value === 0 || value === 1 || value === 2 || value === 3) {
    return value;
  }
  throw new Error("Device permission ceiling must be 0-3.");
}

function capabilities(value: unknown) {
  if (!Array.isArray(value) || value.length > 32) {
    throw new Error("Device capabilities are invalid.");
  }
  const result = value.map((entry) => {
    if (typeof entry !== "string") {
      throw new Error("Device capability must be a string.");
    }
    const clean = entry.trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(clean)) {
      throw new Error("Device capability is invalid.");
    }
    return clean;
  });
  return [...new Set(result)];
}

function normalizeDevice(value: unknown, index: number): AstraDeviceNode {
  const source = record(value, "entry " + (index + 1));
  return {
    id: string(source.id, "id", 120),
    trustedDeviceId: string(
      source.trustedDeviceId,
      "trustedDeviceId",
      120,
    ),
    label: string(source.label, "label", 160),
    state: state(source.state),
    transport: transport(source.transport),
    maxPermissionLevel: permission(source.maxPermissionLevel),
    capabilities: capabilities(source.capabilities),
    createdAt: iso(source.createdAt, "createdAt"),
    updatedAt: iso(source.updatedAt, "updatedAt"),
  };
}

export function normalizeDeviceStore(value: unknown): AstraDeviceStore {
  const root = record(value, "store");
  if (root.schemaVersion !== 1) {
    throw new Error("Unsupported device registry schemaVersion.");
  }
  if (!Array.isArray(root.devices)) {
    throw new Error("Device registry devices must be an array.");
  }
  if (root.devices.length > ASTRA_DEVICE_MAX_ENTRIES) {
    throw new Error("Device registry entry limit exceeded.");
  }

  const devices = root.devices.map(normalizeDevice);
  const ids = new Set<string>();
  const trustIds = new Set<string>();
  for (const device of devices) {
    const id = device.id.toLowerCase();
    if (ids.has(id)) {
      throw new Error("Duplicate device id: " + device.id + ".");
    }
    const trustId = device.trustedDeviceId.toLowerCase();
    if (trustIds.has(trustId)) {
      throw new Error(
        "One trusted-device identity may map to only one paired node.",
      );
    }
    ids.add(id);
    trustIds.add(trustId);
  }

  return { schemaVersion: 1, devices };
}

async function rejectSymlinkTarget(source: string) {
  try {
    const info = await lstat(source);
    if (info.isSymbolicLink()) {
      throw new Error("Device registry must not be a symbolic link.");
    }
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code !== "ENOENT") throw error;
  }
}

export async function loadDeviceStore() {
  const source = getDeviceStorePath();
  try {
    await rejectSymlinkTarget(source);
    const info = await stat(source);
    if (info.size > ASTRA_DEVICE_MAX_FILE_BYTES) {
      throw new Error("Device registry exceeds its file-size limit.");
    }
    const raw = await readFile(source, "utf8");
    const store = normalizeDeviceStore(JSON.parse(raw) as unknown);
    return {
      available: true,
      source,
      store,
      detail:
        "Loaded " +
        store.devices.length +
        " paired-device metadata record" +
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
          "Device registry is ready; no private .astra/devices.json file exists yet.",
      };
    }
    return {
      available: false,
      source,
      store: { schemaVersion: 1 as const, devices: [] },
      detail:
        error instanceof Error
          ? "Device registry could not be loaded safely: " + error.message
          : "Device registry could not be loaded safely.",
    };
  }
}

export async function saveDeviceStore(store: AstraDeviceStore) {
  const normalized = normalizeDeviceStore(
    JSON.parse(JSON.stringify(store)) as unknown,
  );
  const source = getDeviceStorePath();
  const payload = JSON.stringify(normalized, null, 2) + "\n";
  if (Buffer.byteLength(payload, "utf8") > ASTRA_DEVICE_MAX_FILE_BYTES) {
    throw new Error("Device registry exceeds its file-size limit.");
  }

  await mkdir(path.dirname(source), { recursive: true, mode: 0o700 });
  await rejectSymlinkTarget(source);
  await writeFile(source, payload, { encoding: "utf8", mode: 0o600 });
  return { source, count: normalized.devices.length };
}

export async function mutateDeviceStore<T>(
  mutate: (store: AstraDeviceStore) =>
    | { store: AstraDeviceStore; result: T }
    | Promise<{ store: AstraDeviceStore; result: T }>,
) {
  return withDeviceMutationLock(async () => {
    const loaded = await loadDeviceStore();
    if (!loaded.available) throw new Error(loaded.detail);
    const outcome = await mutate({
      schemaVersion: 1,
      devices: [...loaded.store.devices],
    });
    await saveDeviceStore(outcome.store);
    return outcome.result;
  });
}

export async function registerPendingDeviceNode({
  id,
  trustedDeviceId,
  label,
  transport,
  maxPermissionLevel,
  capabilities,
  now = new Date(),
}: {
  id: string;
  trustedDeviceId: string;
  label: string;
  transport: AstraDeviceTransport;
  maxPermissionLevel: Exclude<AstraPermissionLevel, 4>;
  capabilities: string[];
  now?: Date;
}) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid device registration time.");
  }

  return mutateDeviceStore((store) => {
    const node = normalizeDevice(
      {
        id,
        trustedDeviceId,
        label,
        state: "pending",
        transport,
        maxPermissionLevel,
        capabilities,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      0,
    );

    if (
      store.devices.some(
        (device) =>
          device.id.toLowerCase() === node.id.toLowerCase() ||
          device.trustedDeviceId.toLowerCase() ===
            node.trustedDeviceId.toLowerCase(),
      )
    ) {
      throw new Error("Device id or trusted-device identity already exists.");
    }

    const devices = [...store.devices, node];
    return {
      store: { schemaVersion: 1 as const, devices },
      result: node,
    };
  });
}

export async function setDeviceNodeState({
  id,
  state: nextState,
  trustedDeviceState,
  now = new Date(),
}: {
  id: string;
  state: AstraDeviceNodeState;
  trustedDeviceState: AstraTrustedDeviceState;
  now?: Date;
}) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid device state mutation time.");
  }

  return mutateDeviceStore((store) => {
    const index = store.devices.findIndex(
      (device) => device.id.toLowerCase() === id.trim().toLowerCase(),
    );
    if (index < 0) throw new Error("Device node was not found.");

    const current = store.devices[index];
    if (current.state === "revoked" && nextState !== "revoked") {
      throw new Error(
        "Revoked device nodes cannot be reactivated; pair a new identity.",
      );
    }
    if (nextState === "paired" && trustedDeviceState !== "trusted") {
      throw new Error(
        "Device node cannot be paired until its trusted-device identity is trusted.",
      );
    }
    if (current.state === "paired" && nextState === "pending") {
      throw new Error(
        "Paired device nodes cannot return to pending; revoke and re-pair.",
      );
    }

    const updated: AstraDeviceNode = {
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
