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
import { ASTRA_AGENT_MAP } from "@/lib/agent/roster";
import type { AstraAgentKey } from "@/lib/agent/types";
import { safePublicDetail } from "@/lib/security/redaction";
import type {
  AstraAuditActor,
  AstraAuditCategory,
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
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) {
    throw new Error(
      "Audit " + field + " must contain 1-" + max + " characters.",
    );
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

function category(value: unknown): AstraAuditCategory {
  if (
    value === "brain" ||
    value === "tool" ||
    value === "automation" ||
    value === "task" ||
    value === "event" ||
    value === "provider" ||
    value === "memory" ||
    value === "system" ||
    value === "security"
  ) {
    return value;
  }
  throw new Error("Audit category is invalid.");
}

function outcome(value: unknown): AstraAuditOutcome {
  if (
    value === "success" ||
    value === "failure" ||
    value === "blocked" ||
    value === "cancelled"
  ) {
    return value;
  }
  throw new Error("Audit outcome is invalid.");
}

function permission(value: unknown): AstraPermissionLevel | undefined {
  if (value === undefined) return undefined;
  if (value === 0 || value === 1 || value === 2 || value === 3 || value === 4) {
    return value;
  }
  throw new Error("Audit permissionLevel is invalid.");
}

function actor(value: unknown): AstraAuditActor {
  const source = record(value, "actor");
  if (source.kind === "system" && source.id === "astra") {
    return { kind: "system", id: "astra" };
  }
  if (source.kind === "user") {
    return {
      kind: "user",
      id: string(source.id, "actor.id", 120),
    };
  }
  if (
    source.kind === "agent" &&
    typeof source.id === "string" &&
    Object.prototype.hasOwnProperty.call(ASTRA_AGENT_MAP, source.id)
  ) {
    return {
      kind: "agent",
      id: source.id as AstraAgentKey,
    };
  }
  if (source.kind === "tool") {
    return {
      kind: "tool",
      id: string(source.id, "actor.id", 160),
    };
  }
  throw new Error("Audit actor is invalid.");
}

function normalizeEntry(value: unknown, index: number): AstraAuditEntry {
  const source = record(value, "entry " + (index + 1));
  return {
    id: string(source.id, "id", 160),
    at: iso(source.at, "at"),
    category: category(source.category),
    actor: actor(source.actor),
    action: string(source.action, "action", 240),
    resource: optionalString(source.resource, "resource", 240),
    projectId: optionalString(source.projectId, "projectId", 120),
    permissionLevel: permission(source.permissionLevel),
    outcome: outcome(source.outcome),
    detail: safePublicDetail(source.detail, "No detail.", 1200),
    verification:
      source.verification === undefined
        ? undefined
        : safePublicDetail(source.verification, "Not verified.", 1200),
    failure:
      source.failure === undefined
        ? undefined
        : safePublicDetail(source.failure, "Operation failed.", 1200),
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
      throw new Error("Duplicate audit entry id: " + entry.id + ".");
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
          ? "Audit journal could not be loaded safely: " + error.message
          : "Audit journal could not be loaded safely.",
    };
  }
}

export async function saveAuditStore(store: AstraAuditStore) {
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

export async function appendAuditEntry(
  input: Omit<AstraAuditEntry, "id" | "at">,
  now = new Date(),
) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid audit timestamp.");
  }

  return withAuditMutationLock(async () => {
    const loaded = await loadAuditStore();
    if (!loaded.available) throw new Error(loaded.detail);

    const entry = normalizeEntry(
      {
        ...input,
        id: randomUUID(),
        at: now.toISOString(),
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

export function queryAuditEntries({
  entries,
  limit = 50,
  category: categoryFilter,
  outcome: outcomeFilter,
  projectId,
}: {
  entries: readonly AstraAuditEntry[];
  limit?: number;
  category?: AstraAuditCategory;
  outcome?: AstraAuditOutcome;
  projectId?: string;
}) {
  const boundedLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  return entries
    .filter(
      (entry) =>
        (!categoryFilter || entry.category === categoryFilter) &&
        (!outcomeFilter || entry.outcome === outcomeFilter) &&
        (!projectId || entry.projectId === projectId),
    )
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
    .slice(0, boundedLimit);
}
