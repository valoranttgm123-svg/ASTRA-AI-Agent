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
  AstraAutomationDefinition,
  AstraAutomationSchedule,
  AstraAutomationStatus,
} from "./contracts";
import { getAutomationDueState, validateAutomationDefinition } from "./scheduler";

export const ASTRA_AUTOMATION_MAX_ENTRIES = 64;
export const ASTRA_AUTOMATION_MAX_FILE_BYTES = 256 * 1024;

export type AstraAutomationStoreContext = {
  enabled: boolean;
  available: boolean;
  source: string;
  automations: AstraAutomationDefinition[];
  detail: string;
};


let automationMutationTail: Promise<void> = Promise.resolve();

async function withAutomationMutationLock<T>(
  run: () => Promise<T>,
): Promise<T> {
  const previous = automationMutationTail;
  let release!: () => void;
  automationMutationTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await run();
  } finally {
    release();
  }
}

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "off", "no"].includes(value);
}

export function getAutomationStorePath() {
  const configured = process.env.ASTRA_AUTOMATION_FILE?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".astra", "automations.json");
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Automation " + field + " must be an object.");
  }
  return value as Record<string, unknown>;
}

function requiredString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new Error("Automation " + field + " must be a string.");
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) {
    throw new Error(
      "Automation " + field + " must contain 1-" + maxLength + " characters.",
    );
  }
  return cleaned;
}

function optionalString(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, field, maxLength);
}

function status(value: unknown): AstraAutomationStatus {
  if (value === "enabled" || value === "paused" || value === "disabled") {
    return value;
  }
  throw new Error("Automation status is invalid.");
}

function permissionLevel(value: unknown): AstraPermissionLevel {
  if (
    value === 0 ||
    value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4
  ) {
    return value;
  }
  throw new Error("Automation requiredPermissionLevel is invalid.");
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || typeof value !== "number" || value <= 0) {
    throw new Error("Automation " + field + " must be a positive integer.");
  }
  return value;
}

function schedule(value: unknown): AstraAutomationSchedule {
  const source = record(value, "schedule");
  if (source.kind === "once") {
    return {
      kind: "once",
      runAt: requiredString(source.runAt, "schedule.runAt", 80),
    };
  }
  if (source.kind === "interval") {
    return {
      kind: "interval",
      anchorAt: requiredString(source.anchorAt, "schedule.anchorAt", 80),
      everyMinutes: positiveInteger(
        source.everyMinutes,
        "schedule.everyMinutes",
      ),
    };
  }
  throw new Error("Automation schedule kind is invalid.");
}

function normalizeAutomation(
  value: unknown,
  index: number,
): AstraAutomationDefinition {
  const source = record(value, "entry " + (index + 1));
  const automation: AstraAutomationDefinition = {
    id: requiredString(source.id, "id", 120),
    title: requiredString(source.title, "title", 160),
    goal: requiredString(source.goal, "goal", 4000),
    projectId: optionalString(source.projectId, "projectId", 120),
    createdAt: requiredString(source.createdAt, "createdAt", 80),
    updatedAt: requiredString(source.updatedAt, "updatedAt", 80),
    status: status(source.status),
    schedule: schedule(source.schedule),
    requiredPermissionLevel: permissionLevel(
      source.requiredPermissionLevel,
    ),
    maxRuntimeMs: positiveInteger(source.maxRuntimeMs, "maxRuntimeMs"),
    lastRunAt: optionalString(source.lastRunAt, "lastRunAt", 80),
  };

  validateAutomationDefinition(automation);
  return automation;
}

export function normalizeAutomationDefinitions(
  value: unknown,
): AstraAutomationDefinition[] {
  if (!Array.isArray(value)) {
    throw new Error("Automation store root must be an array.");
  }
  if (value.length > ASTRA_AUTOMATION_MAX_ENTRIES) {
    throw new Error(
      "Automation store exceeds " +
        ASTRA_AUTOMATION_MAX_ENTRIES +
        " entries.",
    );
  }

  const automations = value.map(normalizeAutomation);
  const seen = new Set<string>();
  for (const automation of automations) {
    const key = automation.id.toLowerCase();
    if (seen.has(key)) {
      throw new Error("Duplicate automation id: " + automation.id + ".");
    }
    seen.add(key);
  }

  return automations;
}

async function rejectSymlinkTarget(source: string) {
  try {
    const info = await lstat(source);
    if (info.isSymbolicLink()) {
      throw new Error("Automation store file must not be a symbolic link.");
    }
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code !== "ENOENT") throw error;
  }
}

export async function loadAutomationStore(): Promise<AstraAutomationStoreContext> {
  const enabled = envFlag("ASTRA_AUTOMATION_ENABLED", true);
  const source = getAutomationStorePath();

  if (!enabled) {
    return {
      enabled: false,
      available: false,
      source,
      automations: [],
      detail: "Automation is disabled by ASTRA_AUTOMATION_ENABLED.",
    };
  }

  try {
    await rejectSymlinkTarget(source);
    const info = await stat(source);
    if (info.size > ASTRA_AUTOMATION_MAX_FILE_BYTES) {
      throw new Error(
        "Automation store exceeds " +
          ASTRA_AUTOMATION_MAX_FILE_BYTES +
          " bytes.",
      );
    }

    const raw = await readFile(source, "utf8");
    const automations = normalizeAutomationDefinitions(
      JSON.parse(raw) as unknown,
    );
    return {
      enabled: true,
      available: true,
      source,
      automations,
      detail:
        "Loaded " +
        automations.length +
        " automation" +
        (automations.length === 1 ? "." : "s."),
    };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    if (code === "ENOENT") {
      return {
        enabled: true,
        available: true,
        source,
        automations: [],
        detail:
          "Automation store is ready; no .astra/automations.json file exists yet.",
      };
    }

    return {
      enabled: true,
      available: false,
      source,
      automations: [],
      detail:
        error instanceof Error
          ? "Automation store could not be loaded safely: " + error.message
          : "Automation store could not be loaded safely.",
    };
  }
}

export async function saveAutomationStore(
  automations: readonly AstraAutomationDefinition[],
): Promise<{ source: string; count: number }> {
  if (!envFlag("ASTRA_AUTOMATION_ENABLED", true)) {
    throw new Error(
      "Automation is disabled by ASTRA_AUTOMATION_ENABLED.",
    );
  }

  const normalized = normalizeAutomationDefinitions(
    JSON.parse(JSON.stringify(automations)) as unknown,
  );
  const source = getAutomationStorePath();
  const payload = JSON.stringify(normalized, null, 2) + "\n";

  if (Buffer.byteLength(payload, "utf8") > ASTRA_AUTOMATION_MAX_FILE_BYTES) {
    throw new Error(
      "Automation store exceeds " +
        ASTRA_AUTOMATION_MAX_FILE_BYTES +
        " bytes.",
    );
  }

  await mkdir(path.dirname(source), { recursive: true, mode: 0o700 });
  await rejectSymlinkTarget(source);
  await writeFile(source, payload, {
    encoding: "utf8",
    mode: 0o600,
  });

  return {
    source,
    count: normalized.length,
  };
}

export async function mutateAutomationStore<T>(
  mutate: (
    automations: AstraAutomationDefinition[],
  ) =>
    | {
        automations: AstraAutomationDefinition[];
        result: T;
      }
    | Promise<{
        automations: AstraAutomationDefinition[];
        result: T;
      }>,
): Promise<T> {
  return withAutomationMutationLock(async () => {
    const store = await loadAutomationStore();
    if (!store.enabled || !store.available) {
      throw new Error(store.detail);
    }

    const outcome = await mutate([...store.automations]);
    await saveAutomationStore(outcome.automations);
    return outcome.result;
  });
}

export type AstraAutomationClaimResult = {
  claimed: boolean;
  automation?: AstraAutomationDefinition;
  detail: string;
};

export async function claimAutomationOccurrence({
  automationId,
  scheduledFor,
  now = new Date(),
}: {
  automationId: string;
  scheduledFor: string;
  now?: Date;
}): Promise<AstraAutomationClaimResult> {
  const scheduledMs = Date.parse(scheduledFor);
  if (!Number.isFinite(scheduledMs)) {
    throw new Error("Invalid automation scheduledFor timestamp.");
  }
  const normalizedScheduledFor = new Date(scheduledMs).toISOString();

  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid automation claim time.");
  }

  return mutateAutomationStore((automations) => {
    const index = automations.findIndex(
      (automation) =>
        automation.id.toLowerCase() === automationId.trim().toLowerCase(),
    );
    if (index < 0) {
      return {
        automations,
        result: {
          claimed: false,
          detail: "Automation definition was not found.",
        },
      };
    }

    const current = automations[index];
    const due = getAutomationDueState(current, now);
    if (due.kind !== "due") {
      return {
        automations,
        result: {
          claimed: false,
          automation: current,
          detail: "Automation occurrence is no longer due.",
        },
      };
    }
    if (due.scheduledFor !== normalizedScheduledFor) {
      return {
        automations,
        result: {
          claimed: false,
          automation: current,
          detail:
            "Automation occurrence changed before it could be claimed.",
        },
      };
    }

    const updated: AstraAutomationDefinition = {
      ...current,
      lastRunAt: normalizedScheduledFor,
      updatedAt: now.toISOString(),
    };
    const next = [...automations];
    next[index] = updated;

    return {
      automations: next,
      result: {
        claimed: true,
        automation: updated,
        detail:
          "Automation occurrence claimed for single-process execution.",
      },
    };
  });
}
