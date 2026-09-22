import {
  lstat,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export const NVIDIA_SKILL_STATE_MAX_ENTRIES = 512;
export const NVIDIA_SKILL_STATE_MAX_FILE_BYTES = 512 * 1024;

export type NvidiaSkillTruthState =
  | "available"
  | "installed"
  | "disabled"
  | "incompatible";

export type NvidiaSkillStateRecord = {
  id: string;
  state: NvidiaSkillTruthState;
  source: string;
  version?: string;
  checksum?: string;
  installedAt?: string;
  updatedAt: string;
  detail?: string;
};

export type NvidiaSkillStateContext = {
  available: boolean;
  source: string;
  skills: NvidiaSkillStateRecord[];
  detail: string;
};

export type NvidiaSkillMutationAction =
  | "install"
  | "update"
  | "disable"
  | "enable"
  | "remove";

export type NvidiaSkillMutationPlan = {
  skillId: string;
  action: NvidiaSkillMutationAction;
  allowed: boolean;
  currentState?: NvidiaSkillTruthState;
  targetState?: NvidiaSkillTruthState;
  requiredPermissionLevel: 2;
  writesLocalState: true;
  detail: string;
};

function skillStatePath() {
  const configured = process.env.ASTRA_NVIDIA_SKILL_REGISTRY_FILE?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".astra", "nvidia-skills.json");
}

export function getNvidiaSkillStatePath() {
  return skillStatePath();
}

function requiredString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new Error("NVIDIA skill " + field + " must be a string.");
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) {
    throw new Error(
      "NVIDIA skill " +
        field +
        " must contain 1-" +
        maxLength +
        " characters.",
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

function isoTimestamp(value: unknown, field: string) {
  const raw = requiredString(value, field, 80);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error("NVIDIA skill " + field + " must be an ISO timestamp.");
  }
  return new Date(parsed).toISOString();
}

function truthState(value: unknown): NvidiaSkillTruthState {
  if (
    value === "available" ||
    value === "installed" ||
    value === "disabled" ||
    value === "incompatible"
  ) {
    return value;
  }
  throw new Error("NVIDIA skill state is invalid.");
}

function normalizeSkillStateRecord(
  value: unknown,
  index: number,
): NvidiaSkillStateRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      "NVIDIA skill state entry " + (index + 1) + " must be an object.",
    );
  }

  const record = value as Record<string, unknown>;
  const state = truthState(record.state);
  const installedAt =
    record.installedAt === undefined
      ? undefined
      : isoTimestamp(record.installedAt, "installedAt");

  if (
    (state === "installed" || state === "disabled") &&
    installedAt === undefined
  ) {
    throw new Error(
      "Installed or disabled NVIDIA skill state requires installedAt.",
    );
  }

  return {
    id: requiredString(record.id, "id", 160),
    state,
    source: requiredString(record.source, "source", 500),
    version: optionalString(record.version, "version", 160),
    checksum: optionalString(record.checksum, "checksum", 256),
    installedAt,
    updatedAt: isoTimestamp(record.updatedAt, "updatedAt"),
    detail: optionalString(record.detail, "detail", 1000),
  };
}

export function normalizeNvidiaSkillState(
  value: unknown,
): NvidiaSkillStateRecord[] {
  if (!Array.isArray(value)) {
    throw new Error("NVIDIA skill state root must be an array.");
  }
  if (value.length > NVIDIA_SKILL_STATE_MAX_ENTRIES) {
    throw new Error(
      "NVIDIA skill state exceeds " +
        NVIDIA_SKILL_STATE_MAX_ENTRIES +
        " entries.",
    );
  }

  const records = value.map(normalizeSkillStateRecord);
  const seen = new Set<string>();
  for (const record of records) {
    const key = record.id.toLowerCase();
    if (seen.has(key)) {
      throw new Error("Duplicate NVIDIA skill id: " + record.id + ".");
    }
    seen.add(key);
  }
  return records;
}

async function rejectSymlinkTarget(source: string) {
  try {
    const info = await lstat(source);
    if (info.isSymbolicLink()) {
      throw new Error("NVIDIA skill state file must not be a symbolic link.");
    }
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code !== "ENOENT") throw error;
  }
}

export async function loadNvidiaSkillState(): Promise<NvidiaSkillStateContext> {
  const source = skillStatePath();

  try {
    await rejectSymlinkTarget(source);
    const info = await stat(source);
    if (info.size > NVIDIA_SKILL_STATE_MAX_FILE_BYTES) {
      throw new Error(
        "NVIDIA skill state exceeds " +
          NVIDIA_SKILL_STATE_MAX_FILE_BYTES +
          " bytes.",
      );
    }

    const raw = await readFile(source, "utf8");
    const skills = normalizeNvidiaSkillState(JSON.parse(raw) as unknown);
    return {
      available: true,
      source,
      skills,
      detail:
        "Loaded " +
        skills.length +
        " NVIDIA skill state record" +
        (skills.length === 1 ? "." : "s."),
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
        skills: [],
        detail:
          "NVIDIA Skill Hub state is ready; no private registry exists yet.",
      };
    }

    return {
      available: false,
      source,
      skills: [],
      detail:
        error instanceof Error
          ? "NVIDIA skill state could not be loaded safely: " + error.message
          : "NVIDIA skill state could not be loaded safely.",
    };
  }
}

export async function saveNvidiaSkillState(
  skills: readonly NvidiaSkillStateRecord[],
) {
  const normalized = normalizeNvidiaSkillState(
    JSON.parse(JSON.stringify(skills)) as unknown,
  );
  const source = skillStatePath();
  const payload = JSON.stringify(normalized, null, 2) + "\n";

  if (
    Buffer.byteLength(payload, "utf8") >
    NVIDIA_SKILL_STATE_MAX_FILE_BYTES
  ) {
    throw new Error(
      "NVIDIA skill state exceeds " +
        NVIDIA_SKILL_STATE_MAX_FILE_BYTES +
        " bytes.",
    );
  }

  await mkdir(path.dirname(source), { recursive: true, mode: 0o700 });
  await rejectSymlinkTarget(source);
  await writeFile(source, payload, {
    encoding: "utf8",
    mode: 0o600,
  });

  return { source, count: normalized.length };
}

export function planNvidiaSkillMutation({
  skillId,
  action,
  currentState,
}: {
  skillId: string;
  action: NvidiaSkillMutationAction;
  currentState?: NvidiaSkillTruthState;
}): NvidiaSkillMutationPlan {
  const id = requiredString(skillId, "id", 160);
  const base = {
    skillId: id,
    action,
    requiredPermissionLevel: 2 as const,
    writesLocalState: true as const,
    currentState,
  };

  switch (action) {
    case "install":
      if (currentState === "installed") {
        return {
          ...base,
          allowed: false,
          detail: "Skill is already installed.",
        };
      }
      if (currentState === "incompatible") {
        return {
          ...base,
          allowed: false,
          detail:
            "Skill is marked incompatible and must not be installed until compatibility is resolved.",
        };
      }
      return {
        ...base,
        allowed: true,
        targetState: "installed",
        detail:
          "Dry-run only: installation requires a Level-2 local mutation path and verified provider/Codex mechanism.",
      };
    case "update":
      return currentState === "installed" || currentState === "disabled"
        ? {
            ...base,
            allowed: true,
            targetState: currentState,
            detail:
              "Dry-run only: update preserves enabled/disabled truth state and requires Level-2 local mutation approval.",
          }
        : {
            ...base,
            allowed: false,
            detail: "Only installed/disabled skills can be updated.",
          };
    case "disable":
      return currentState === "installed"
        ? {
            ...base,
            allowed: true,
            targetState: "disabled",
            detail: "Dry-run only: disable keeps the skill installed.",
          }
        : {
            ...base,
            allowed: false,
            detail: "Only an installed skill can be disabled.",
          };
    case "enable":
      return currentState === "disabled"
        ? {
            ...base,
            allowed: true,
            targetState: "installed",
            detail: "Dry-run only: enable reactivates an installed skill.",
          }
        : {
            ...base,
            allowed: false,
            detail: "Only a disabled installed skill can be enabled.",
          };
    case "remove":
      return currentState === "installed" || currentState === "disabled"
        ? {
            ...base,
            allowed: true,
            targetState: "available",
            detail:
              "Dry-run only: removal requires verified rollback-safe local mutation.",
          }
        : {
            ...base,
            allowed: false,
            detail: "Only installed/disabled skills can be removed.",
          };
  }
}
