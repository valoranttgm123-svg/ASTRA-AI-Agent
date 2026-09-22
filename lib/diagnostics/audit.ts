import {
  lstat,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import type { AstraPermissionLevel } from "@/lib/agent/capabilities";
import { redactSensitiveText } from "@/lib/security/redaction";
import type {
  AstraAuditActorKind,
  AstraAuditEntry,
  AstraAuditOutcome,
  AstraAuditStore,
} from "./contracts";

export const ASTRA_AUDIT_MAX_ENTRIES = 2048;
export const ASTRA_AUDIT_MAX_FILE_BYTES = 4 * 1024 * 1024;

let auditMutationTail: Promise<void> = Promise.resolve();

async function withAuditMutationLock<T>(run: () => Promise<T>) {
  const previous = auditMutationTail;
  let release!: () => void;
  auditMutationTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await run();
  } finally {
    release();
  }
}

export function getAuditStorePath() {
  const configured = process.env.ASTRA_AUDIT_FILE?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".astra", "audit.json");
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Audit " + field + " must be an object.");
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string, max: number) {
  if (typeof value !== "string") {
    throw new Error("Audit " + field + " must be a string.");
  }
  const cleaned = redactSensitiveText(value, max);
  if (!cleaned) {
    throw new Error("Audit " + field + " cannot be empty.");
  }
  return cleaned;
}

function optionalString(value: unknown, field: string, max: number) {
  if (value === undefined) return undefined;
  return string(value, field, max);
}

function iso(value: unknown, field: string) {
  const raw = string(value, field, 80);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error("Audit " + field + " must be a timestamp.");
  }
  return new Date(parsed).toISOString();
}

function actorKind(value: unknown): AstraAuditActorKind {
  if (
    value === "user" ||
    value === "agent" ||
    value === "tool" ||
    value === "service"
  ) {
    return value;
  }
  throw new Error("Audit actorKind is invalid.");
}

function outcome(value: unknown): AstraAuditOutcome {
  if (
    value === "attempted" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "blocked" ||
    value === "cancelled"
  ) {
    return value;
  }
  throw new Error("Audit outcome is invalid.");
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
  throw new Error("Audit permissionLevel is invalid.");
}

function normalizeEntry(value: unknown, index: number): AstraAuditEntry {
  const entry = record(value, "entry " + (index + 1));
  return {
    id: string(entry.id, "id", 160),
    at: iso(entry.at, "at"),
    actorKind: actorKind(entry.actorKind),
    actorId: string(entry.actorId, "actorId", 160),
    action: string(entry.action, "action", 240),
    target: optionalString(entry.target, "target", 300),
    projectId: optionalString(entry.projectId, "projectId", 120),
    permissionLevel: permission(entry.permissionLevel),
    outcome: outcome(entry.outcome),
    verified: entry.verified === true,
    verification: optionalString(
      entry.verification,
      "verification",
      1000,
    ),
    detail: string(entry.detail, "detail", 2000),
  };
}

export function normalizeAuditStore(value: unknown): AstraAuditStore {
  const root = record(value, "store");
  if (root.schemaVersion !== 1) {
    throw new Error("Unsupported audit schemaVersion.");
  }
  if (!Array.isArray(root.entries)) {
    throw new Error("Audit entries must be an array.");
  }
  if (root.entries.length > ASTRA_AUDIT_MAX_ENTRIES) {
    throw new Error("Audit entry limit exceeded.");
  }

  const entries = root.entries.map(normalizeEntry);
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new Error("Duplicate audit id: " + entry.id + ".");
    }
    seen.add(entry.id);
  }

  return { schemaVersion: 1, entries };
}

async function rejectSymlinkTarget(source: string) {
  try {
    const info = await lstat(source);
    if (info.isSymbolicLink()) {
      throw new Error("Audit store must not be a symbolic link.");
    }
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code !== "ENOENT") throw error;
  }
}

export async function loadAuditStore() {
  const source = getAuditStorePath();
  try {
    await rejectSymlinkTarget(source);
    const info = await stat(source);
    if (info.size > ASTRA_AUDIT_MAX_FILE_BYTES) {
      throw new Error("Audit store exceeds its file-size limit.");
    }
    const raw = await readFile(source, "utf8");
    const store = normalizeAuditStore(JSON.parse(raw) as unknown);
    return {
      available: true,
      source,
      store,
      detail:
        "Loaded " +
        store.entries.length +
        " bounded audit entr" +
        (store.entries.length === 1 ? "y." : "ies."),
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
        store: { schemaVersion: 1 as const, entries: [] },
        detail:
          "Audit journal is ready; no private .astra/audit.json file exists yet.",
      };
    }
    return {
      available: false,
      source,
      store: { schemaVersion: 1 as const, entries: [] },
      detail:
        error instanceof Error
          ? "Audit store could not be loaded safely: " + error.message
          : "Audit store could not be loaded safely.",
    };
  }
}

async function saveAuditStore(store: AstraAuditStore) {
  const normalized = normalizeAuditStore(
    JSON.parse(JSON.stringify(store)) as unknown,
  );
  const source = getAuditStorePath();
  const payload = JSON.stringify(normalized, null, 2) + "\n";
  if (Buffer.byteLength(payload, "utf8") > ASTRA_AUDIT_MAX_FILE_BYTES) {
    throw new Error("Audit store exceeds its file-size limit.");
  }
  await mkdir(path.dirname(source), { recursive: true, mode: 0o700 });
  await rejectSymlinkTarget(source);
  await writeFile(source, payload, {
    encoding: "utf8",
    mode: 0o600,
  });
  return { source, count: normalized.entries.length };
}

export type AstraAuditInput = Omit<AstraAuditEntry, "id" | "at"> & {
  at?: string;
};

export async function appendAuditEntry(
  input: AstraAuditInput,
  now = new Date(),
) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid audit time.");
  }

  return withAuditMutationLock(async () => {
    const loaded = await loadAuditStore();
    if (!loaded.available) throw new Error(loaded.detail);

    const entry = normalizeEntry(
      {
        ...input,
        id: randomUUID(),
        at: input.at ?? now.toISOString(),
      },
      0,
    );

    const entries = [...loaded.store.entries, entry].slice(
      -ASTRA_AUDIT_MAX_ENTRIES,
    );
    await saveAuditStore({ schemaVersion: 1, entries });
    return entry;
  });
}

export function queryAuditEntries(
  entries: readonly AstraAuditEntry[],
  options: {
    actorId?: string;
    projectId?: string;
    outcome?: AstraAuditOutcome;
    since?: string;
    limit?: number;
  } = {},
) {
  const limit = Math.max(
    1,
    Math.min(200, Math.floor(options.limit ?? 50)),
  );
  const sinceMs = options.since ? Date.parse(options.since) : 0;
  if (options.since && !Number.isFinite(sinceMs)) {
    throw new Error("Audit since must be a timestamp.");
  }

  return entries
    .filter((entry) => {
      if (
        options.actorId &&
        entry.actorId.toLowerCase() !== options.actorId.toLowerCase()
      ) {
        return false;
      }
      if (
        options.projectId &&
        entry.projectId?.toLowerCase() !==
          options.projectId.toLowerCase()
      ) {
        return false;
      }
      if (options.outcome && entry.outcome !== options.outcome) {
        return false;
      }
      if (sinceMs && Date.parse(entry.at) < sinceMs) return false;
      return true;
    })
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
    .slice(0, limit);
}
