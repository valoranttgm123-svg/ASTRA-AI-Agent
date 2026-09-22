import {
  lstat,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type {
  AstraIdentityScope,
  AstraTrustedDevice,
  AstraTrustedDeviceState,
  AstraTrustStore,
} from "./contracts";

export const ASTRA_TRUST_MAX_DEVICES = 64;
export const ASTRA_TRUST_MAX_FILE_BYTES = 256 * 1024;

let trustMutationTail: Promise<void> = Promise.resolve();

async function withTrustMutationLock<T>(run: () => Promise<T>) {
  const previous = trustMutationTail;
  let release!: () => void;
  trustMutationTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await run();
  } finally {
    release();
  }
}

export function getTrustStorePath() {
  const configured = process.env.ASTRA_TRUST_FILE?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".astra", "trust.json");
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Trust " + field + " must be an object.");
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string, max: number) {
  if (typeof value !== "string") {
    throw new Error("Trust " + field + " must be a string.");
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) {
    throw new Error(
      "Trust " + field + " must contain 1-" + max + " characters.",
    );
  }
  return cleaned;
}

function iso(value: unknown, field: string) {
  const raw = string(value, field, 80);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error("Trust " + field + " must be a timestamp.");
  }
  return new Date(parsed).toISOString();
}

function state(value: unknown): AstraTrustedDeviceState {
  if (value === "pending" || value === "trusted" || value === "revoked") {
    return value;
  }
  throw new Error("Trusted device state is invalid.");
}

const SCOPES = new Set<AstraIdentityScope>([
  "brain.chat",
  "memory.read",
  "files.read",
  "computer.local",
  "automation.manage",
  "external.write",
  "secrets.use",
  "device.route",
]);

function scopes(value: unknown) {
  if (!Array.isArray(value) || value.length > SCOPES.size) {
    throw new Error("Trusted device scopes are invalid.");
  }
  const result = value.map((entry) => {
    if (typeof entry !== "string" || !SCOPES.has(entry as AstraIdentityScope)) {
      throw new Error("Trusted device scope is invalid.");
    }
    return entry as AstraIdentityScope;
  });
  return [...new Set(result)];
}

function normalizeDevice(value: unknown, index: number): AstraTrustedDevice {
  const source = record(value, "device " + (index + 1));
  const fingerprintHash = string(
    source.fingerprintHash,
    "fingerprintHash",
    64,
  ).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(fingerprintHash)) {
    throw new Error("Trusted device fingerprintHash must be a SHA-256 hex hash.");
  }

  return {
    id: string(source.id, "id", 120),
    label: string(source.label, "label", 160),
    fingerprintHash,
    state: state(source.state),
    scopes: scopes(source.scopes),
    createdAt: iso(source.createdAt, "createdAt"),
    updatedAt: iso(source.updatedAt, "updatedAt"),
    lastSeenAt:
      source.lastSeenAt === undefined
        ? undefined
        : iso(source.lastSeenAt, "lastSeenAt"),
  };
}

export function normalizeTrustStore(value: unknown): AstraTrustStore {
  const root = record(value, "store");
  if (root.schemaVersion !== 1) {
    throw new Error("Unsupported trust schemaVersion.");
  }
  if (!Array.isArray(root.devices)) {
    throw new Error("Trust devices must be an array.");
  }
  if (root.devices.length > ASTRA_TRUST_MAX_DEVICES) {
    throw new Error("Trusted device limit exceeded.");
  }

  const devices = root.devices.map(normalizeDevice);
  const ids = new Set<string>();
  const fingerprints = new Set<string>();
  for (const device of devices) {
    const id = device.id.toLowerCase();
    if (ids.has(id)) {
      throw new Error("Duplicate trusted device id: " + device.id + ".");
    }
    if (fingerprints.has(device.fingerprintHash)) {
      throw new Error("Duplicate trusted device fingerprint.");
    }
    ids.add(id);
    fingerprints.add(device.fingerprintHash);
  }

  return { schemaVersion: 1, devices };
}

async function rejectSymlinkTarget(source: string) {
  try {
    const info = await lstat(source);
    if (info.isSymbolicLink()) {
      throw new Error("Trust store must not be a symbolic link.");
    }
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code !== "ENOENT") throw error;
  }
}

export async function loadTrustStore() {
  const source = getTrustStorePath();
  try {
    await rejectSymlinkTarget(source);
    const info = await stat(source);
    if (info.size > ASTRA_TRUST_MAX_FILE_BYTES) {
      throw new Error("Trust store exceeds its file-size limit.");
    }
    const raw = await readFile(source, "utf8");
    const store = normalizeTrustStore(JSON.parse(raw) as unknown);
    return {
      available: true,
      source,
      store,
      detail:
        "Loaded " +
        store.devices.length +
        " trusted-device metadata record" +
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
          "Trust registry is ready; no private .astra/trust.json file exists yet.",
      };
    }
    return {
      available: false,
      source,
      store: { schemaVersion: 1 as const, devices: [] },
      detail:
        error instanceof Error
          ? "Trust registry could not be loaded safely: " + error.message
          : "Trust registry could not be loaded safely.",
    };
  }
}

export async function saveTrustStore(store: AstraTrustStore) {
  const normalized = normalizeTrustStore(
    JSON.parse(JSON.stringify(store)) as unknown,
  );
  const source = getTrustStorePath();
  const payload = JSON.stringify(normalized, null, 2) + "\n";
  if (Buffer.byteLength(payload, "utf8") > ASTRA_TRUST_MAX_FILE_BYTES) {
    throw new Error("Trust store exceeds its file-size limit.");
  }

  await mkdir(path.dirname(source), { recursive: true, mode: 0o700 });
  await rejectSymlinkTarget(source);
  await writeFile(source, payload, { encoding: "utf8", mode: 0o600 });
  return { source, count: normalized.devices.length };
}

export async function mutateTrustStore<T>(
  mutate: (store: AstraTrustStore) =>
    | { store: AstraTrustStore; result: T }
    | Promise<{ store: AstraTrustStore; result: T }>,
) {
  return withTrustMutationLock(async () => {
    const loaded = await loadTrustStore();
    if (!loaded.available) throw new Error(loaded.detail);
    const outcome = await mutate({
      schemaVersion: 1,
      devices: [...loaded.store.devices],
    });
    await saveTrustStore(outcome.store);
    return outcome.result;
  });
}

export async function registerPendingDevice({
  id,
  label,
  fingerprintHash,
  scopes: requestedScopes,
  now = new Date(),
}: {
  id: string;
  label: string;
  fingerprintHash: string;
  scopes: AstraIdentityScope[];
  now?: Date;
}) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid trusted-device registration time.");
  }

  return mutateTrustStore((store) => {
    const normalized = normalizeDevice(
      {
        id,
        label,
        fingerprintHash,
        state: "pending",
        scopes: requestedScopes,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      0,
    );

    if (
      store.devices.some(
        (device) =>
          device.id.toLowerCase() === normalized.id.toLowerCase() ||
          device.fingerprintHash === normalized.fingerprintHash,
      )
    ) {
      throw new Error("Trusted device id or fingerprint already exists.");
    }

    const devices = [...store.devices, normalized];
    return {
      store: { schemaVersion: 1 as const, devices },
      result: normalized,
    };
  });
}

export async function setTrustedDeviceState({
  id,
  state: nextState,
  now = new Date(),
}: {
  id: string;
  state: AstraTrustedDeviceState;
  now?: Date;
}) {
  return mutateTrustStore((store) => {
    const index = store.devices.findIndex(
      (device) => device.id.toLowerCase() === id.trim().toLowerCase(),
    );
    if (index < 0) throw new Error("Trusted device was not found.");

    const current = store.devices[index];
    if (
      current.state === "revoked" &&
      nextState !== "revoked"
    ) {
      throw new Error(
        "Revoked devices cannot be silently re-trusted; pair a new device identity.",
      );
    }
    if (current.state === "trusted" && nextState === "pending") {
      throw new Error(
        "Trusted devices cannot return to pending; revoke and pair a new identity instead.",
      );
    }

    const updated: AstraTrustedDevice = {
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
