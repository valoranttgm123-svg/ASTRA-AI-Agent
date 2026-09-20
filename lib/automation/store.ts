import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AstraAutomationDraft,
  AstraAutomationLastRun,
  AstraAutomationLease,
  AstraAutomationRecord,
  AstraAutomationSchedule,
} from "./contracts";
import type { AstraProviderChoice } from "@/lib/agent/types";

const MAX_AUTOMATIONS = 100;
const MAX_TITLE_CHARS = 160;
const MAX_PROMPT_CHARS = 4_000;
const MIN_INTERVAL_MINUTES = 5;
const MAX_INTERVAL_MINUTES = 10_080;
const PROVIDERS = new Set<AstraProviderChoice>(["auto", "ollama", "codex"]);

let storeLock: Promise<void> = Promise.resolve();

export function automationEnabled() {
  const value = process.env.ASTRA_AUTOMATION_ENABLED?.trim().toLowerCase();
  if (!value) return false;
  return !["0", "false", "off", "no"].includes(value);
}

export function automationPath() {
  const configured = process.env.ASTRA_AUTOMATION_FILE?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".astra", "automations.json");
}

function iso(value: unknown) {
  if (typeof value !== "string") return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function normalizeSchedule(value: unknown): AstraAutomationSchedule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;

  if (record.kind === "once") {
    const at = iso(record.at);
    return at ? { kind: "once", at } : null;
  }

  if (record.kind === "interval") {
    const raw = Number(record.everyMinutes);
    if (!Number.isFinite(raw)) return null;
    const everyMinutes = Math.floor(raw);
    if (
      everyMinutes < MIN_INTERVAL_MINUTES ||
      everyMinutes > MAX_INTERVAL_MINUTES
    ) {
      return null;
    }
    return { kind: "interval", everyMinutes };
  }

  return null;
}

function normalizeLease(value: unknown): AstraAutomationLease | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const startedAt = iso(record.startedAt);
  const leaseUntil = iso(record.leaseUntil);
  const runId =
    typeof record.runId === "string" ? record.runId.trim().slice(0, 120) : "";
  if (!runId || !startedAt || !leaseUntil) return undefined;
  return { runId, startedAt, leaseUntil };
}

function normalizeLastRun(value: unknown): AstraAutomationLastRun | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const runId =
    typeof record.runId === "string" ? record.runId.trim().slice(0, 120) : "";
  const startedAt = iso(record.startedAt);
  const finishedAt = iso(record.finishedAt);
  const states = new Set([
    "running",
    "completed",
    "waiting_approval",
    "blocked",
    "error",
    "cancelled",
  ]);
  const status =
    typeof record.status === "string" && states.has(record.status)
      ? (record.status as AstraAutomationLastRun["status"])
      : undefined;
  const detail =
    typeof record.detail === "string"
      ? record.detail.trim().slice(0, 2_000)
      : "";
  if (!runId || !startedAt || !status) return undefined;

  let approval: AstraAutomationLastRun["approval"];
  if (record.approval && typeof record.approval === "object" && !Array.isArray(record.approval)) {
    const item = record.approval as Record<string, unknown>;
    const expiresAt = iso(item.expiresAt);
    const planId = typeof item.planId === "string" ? item.planId.trim().slice(0, 120) : "";
    const stepId = typeof item.stepId === "string" ? item.stepId.trim().slice(0, 120) : "";
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 240) : "";
    const toolId = typeof item.toolId === "string" ? item.toolId.trim().slice(0, 160) : "";
    if (item.level === 3 && expiresAt && planId && stepId && title && toolId) {
      approval = {
        level: 3,
        planId,
        stepId,
        title,
        toolId,
        expiresAt,
      };
    }
  }

  return {
    runId,
    startedAt,
    ...(finishedAt ? { finishedAt } : {}),
    status,
    detail,
    ...(record.requiresApproval === true ? { requiresApproval: true } : {}),
    ...(approval ? { approval } : {}),
  };
}

export function normalizeAutomations(value: unknown): AstraAutomationRecord[] {
  if (!Array.isArray(value)) return [];
  const result: AstraAutomationRecord[] = [];
  const seen = new Set<string>();

  for (const item of value.slice(0, MAX_AUTOMATIONS)) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id =
      typeof record.id === "string" ? record.id.trim().slice(0, 120) : "";
    const title =
      typeof record.title === "string"
        ? record.title.trim().slice(0, MAX_TITLE_CHARS)
        : "";
    const prompt =
      typeof record.prompt === "string"
        ? record.prompt.trim().slice(0, MAX_PROMPT_CHARS)
        : "";
    const schedule = normalizeSchedule(record.schedule);
    const createdAt = iso(record.createdAt);
    const updatedAt = iso(record.updatedAt);
    if (
      !id ||
      !title ||
      !prompt ||
      !schedule ||
      !createdAt ||
      !updatedAt ||
      seen.has(id.toLowerCase())
    ) {
      continue;
    }
    seen.add(id.toLowerCase());

    const provider =
      typeof record.provider === "string" &&
      PROVIDERS.has(record.provider as AstraProviderChoice)
        ? (record.provider as AstraProviderChoice)
        : "auto";
    const mode = record.mode === "execute" ? "execute" : "chat";
    const nextRunAt =
      record.nextRunAt === null ? null : iso(record.nextRunAt) ?? null;

    result.push({
      id,
      title,
      prompt,
      enabled: record.enabled === true,
      mode,
      provider,
      schedule,
      nextRunAt,
      createdAt,
      updatedAt,
      ...(normalizeLease(record.activeRun)
        ? { activeRun: normalizeLease(record.activeRun) }
        : {}),
      ...(normalizeLastRun(record.lastRun)
        ? { lastRun: normalizeLastRun(record.lastRun) }
        : {}),
    });
  }

  return result;
}

async function readUnlocked() {
  const source = automationPath();
  try {
    const raw = await readFile(source, "utf8");
    return normalizeAutomations(JSON.parse(raw) as unknown);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "ENOENT") return [];
    throw error;
  }
}

async function writeUnlocked(records: readonly AstraAutomationRecord[]) {
  const source = automationPath();
  await mkdir(path.dirname(source), { recursive: true });
  const temp = source + "." + process.pid + "." + randomUUID() + ".tmp";
  await writeFile(temp, JSON.stringify(records.slice(0, MAX_AUTOMATIONS), null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temp, source);
}

export async function withAutomationStore<T>(
  mutation: (
    records: AstraAutomationRecord[],
  ) =>
    | Promise<{ records: AstraAutomationRecord[]; result: T }>
    | { records: AstraAutomationRecord[]; result: T },
): Promise<T> {
  let release!: () => void;
  const previous = storeLock;
  storeLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    const records = await readUnlocked();
    const next = await mutation(records);
    await writeUnlocked(next.records);
    return next.result;
  } finally {
    release();
  }
}

export async function listAutomations() {
  await storeLock;
  return readUnlocked();
}

export function validateAutomationDraft(
  value: unknown,
): AstraAutomationDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Automation draft must be an object.");
  }
  const record = value as Record<string, unknown>;
  const title =
    typeof record.title === "string"
      ? record.title.trim().slice(0, MAX_TITLE_CHARS)
      : "";
  const prompt =
    typeof record.prompt === "string"
      ? record.prompt.trim().slice(0, MAX_PROMPT_CHARS)
      : "";
  const schedule = normalizeSchedule(record.schedule);
  if (!title) throw new Error("Automation title is required.");
  if (!prompt) throw new Error("Automation prompt is required.");
  if (!schedule) throw new Error("Automation schedule is invalid.");

  const provider =
    typeof record.provider === "string" &&
    PROVIDERS.has(record.provider as AstraProviderChoice)
      ? (record.provider as AstraProviderChoice)
      : "auto";

  return {
    title,
    prompt,
    enabled: record.enabled !== false,
    mode: record.mode === "execute" ? "execute" : "chat",
    provider,
    schedule,
  };
}

export function nextRunFromSchedule(
  schedule: AstraAutomationSchedule,
  now = new Date(),
) {
  if (schedule.kind === "once") return schedule.at;
  return new Date(
    now.getTime() + schedule.everyMinutes * 60_000,
  ).toISOString();
}

export async function createAutomation(
  draftValue: unknown,
  now = new Date(),
) {
  const draft = validateAutomationDraft(draftValue);
  return withAutomationStore((records) => {
    if (records.length >= MAX_AUTOMATIONS) {
      throw new Error("Automation limit reached.");
    }
    const timestamp = now.toISOString();
    const record: AstraAutomationRecord = {
      id: "auto-" + randomUUID(),
      title: draft.title,
      prompt: draft.prompt,
      enabled: draft.enabled ?? true,
      mode: draft.mode ?? "chat",
      provider: draft.provider ?? "auto",
      schedule: draft.schedule,
      nextRunAt: nextRunFromSchedule(draft.schedule, now),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return { records: [...records, record], result: record };
  });
}

export async function deleteAutomation(id: string) {
  const key = id.trim();
  return withAutomationStore((records) => {
    const next = records.filter((record) => record.id !== key);
    return { records: next, result: next.length !== records.length };
  });
}

export async function setAutomationEnabled(
  id: string,
  enabled: boolean,
  now = new Date(),
) {
  const key = id.trim();
  return withAutomationStore((records) => {
    let updated: AstraAutomationRecord | undefined;
    const next = records.map((record) => {
      if (record.id !== key) return record;
      updated = {
        ...record,
        enabled,
        nextRunAt:
          enabled && !record.nextRunAt
            ? nextRunFromSchedule(record.schedule, now)
            : record.nextRunAt,
        updatedAt: now.toISOString(),
      };
      return updated;
    });
    if (!updated) throw new Error("Automation not found.");
    return { records: next, result: updated };
  });
}

export const AUTOMATION_LIMITS = {
  maxAutomations: MAX_AUTOMATIONS,
  maxTitleChars: MAX_TITLE_CHARS,
  maxPromptChars: MAX_PROMPT_CHARS,
  minIntervalMinutes: MIN_INTERVAL_MINUTES,
  maxIntervalMinutes: MAX_INTERVAL_MINUTES,
} as const;
