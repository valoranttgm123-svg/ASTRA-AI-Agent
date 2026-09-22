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
  AstraExtensionInstallState,
  AstraExtensionNetworkRequirement,
  AstraExtensionRollback,
  AstraExtensionReviewEvidence,
  AstraExtensionSkillManifest,
  AstraExtensionSkillStore,
  AstraExtensionTrustState,
  AstraExtensionUpdateState,
  AstraExtensionVerificationEvidence,
  AstraExtensionVerificationMethod,
} from "./contracts";

export const ASTRA_EXTENSION_MAX_SKILLS = 256;
export const ASTRA_EXTENSION_MAX_FILE_BYTES = 1024 * 1024;

let skillMutationTail: Promise<void> = Promise.resolve();

async function withSkillMutationLock<T>(run: () => Promise<T>) {
  const previous = skillMutationTail;
  let release!: () => void;
  skillMutationTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await run();
  } finally {
    release();
  }
}

export function getExtensionSkillStorePath() {
  const configured = process.env.ASTRA_EXTENSION_SKILL_FILE?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".astra", "extension-skills.json");
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Extension " + field + " must be an object.");
  }
  return value as Record<string, unknown>;
}

function requiredString(
  value: unknown,
  field: string,
  max: number,
): string {
  if (typeof value !== "string") {
    throw new Error("Extension " + field + " must be a string.");
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) {
    throw new Error(
      "Extension " + field + " must contain 1-" + max + " characters.",
    );
  }
  return cleaned;
}

function optionalString(
  value: unknown,
  field: string,
  max: number,
) {
  if (value === undefined) return undefined;
  return requiredString(value, field, max);
}

function iso(value: unknown, field: string) {
  const raw = requiredString(value, field, 80);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error("Extension " + field + " must be a timestamp.");
  }
  return new Date(parsed).toISOString();
}

function installState(value: unknown): AstraExtensionInstallState {
  if (
    value === "available" ||
    value === "installed" ||
    value === "disabled" ||
    value === "incompatible"
  ) {
    return value;
  }
  throw new Error("Extension installState is invalid.");
}

function updateState(value: unknown): AstraExtensionUpdateState {
  if (
    value === "current" ||
    value === "update_available" ||
    value === "unknown"
  ) {
    return value;
  }
  throw new Error("Extension updateState is invalid.");
}

function trust(value: unknown): AstraExtensionTrustState {
  if (
    value === "builtin" ||
    value === "local_reviewed" ||
    value === "unreviewed"
  ) {
    return value;
  }
  throw new Error("Extension trust state is invalid.");
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
  throw new Error("Extension network requirement is invalid.");
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
  throw new Error("Extension verification method is invalid.");
}

function permission(
  value: unknown,
): Exclude<AstraPermissionLevel, 4> {
  if (value === 0 || value === 1 || value === 2 || value === 3) {
    return value;
  }
  throw new Error("Extension permissionLevel must be 0-3.");
}

function idList(
  value: unknown,
  field: string,
  maxItems: number,
) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(
      "Extension " + field + " must be an array with at most " +
        maxItems +
        " entries.",
    );
  }
  const result = value.map((entry) => {
    const clean = requiredString(entry, field + " entry", 160);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(clean)) {
      throw new Error("Extension " + field + " entry is invalid.");
    }
    return clean;
  });
  return [...new Set(result)];
}

function rollback(value: unknown): AstraExtensionRollback {
  const source = record(value, "rollback");
  if (typeof source.supported !== "boolean") {
    throw new Error("Extension rollback.supported must be boolean.");
  }
  return {
    supported: source.supported,
    previousVersion: optionalString(
      source.previousVersion,
      "rollback.previousVersion",
      120,
    ),
    detail: requiredString(source.detail, "rollback.detail", 800),
  };
}

export function normalizeExtensionSkill(
  value: unknown,
  index = 0,
): AstraExtensionSkillManifest {
  const source = record(value, "skill " + (index + 1));
  const state = installState(source.installState);
  const verify = verification(source.verification);

  if (
    (state === "installed" || state === "disabled") &&
    verify === "none"
  ) {
    throw new Error(
      "Installed/disabled extension skill must declare a verification method.",
    );
  }

  return {
    id: requiredString(source.id, "id", 120),
    version: requiredString(source.version, "version", 120),
    provider: requiredString(source.provider, "provider", 160),
    source: requiredString(source.source, "source", 500),
    checksum: optionalString(source.checksum, "checksum", 256),
    trust: trust(source.trust),
    installState: state,
    updateState: updateState(source.updateState),
    capabilities: idList(source.capabilities, "capabilities", 32),
    toolMappings: idList(source.toolMappings, "toolMappings", 24),
    permissionLevel: permission(source.permissionLevel),
    network: network(source.network),
    secretReferences: idList(
      source.secretReferences,
      "secretReferences",
      24,
    ),
    verification: verify,
    rollback: rollback(source.rollback),
    updatedAt: iso(source.updatedAt, "updatedAt"),
  };
}

export function normalizeExtensionSkillStore(
  value: unknown,
): AstraExtensionSkillStore {
  const root = record(value, "store");
  if (root.schemaVersion !== 1) {
    throw new Error("Unsupported extension skill schemaVersion.");
  }
  if (!Array.isArray(root.skills)) {
    throw new Error("Extension skills must be an array.");
  }
  if (root.skills.length > ASTRA_EXTENSION_MAX_SKILLS) {
    throw new Error("Extension skill limit exceeded.");
  }

  const skills = root.skills.map(normalizeExtensionSkill);
  const seen = new Set<string>();
  for (const skill of skills) {
    const id = skill.id.toLowerCase();
    if (seen.has(id)) {
      throw new Error("Duplicate extension skill id: " + skill.id + ".");
    }
    seen.add(id);
  }
  return { schemaVersion: 1, skills };
}

async function rejectSymlinkTarget(source: string) {
  try {
    const info = await lstat(source);
    if (info.isSymbolicLink()) {
      throw new Error("Extension skill registry must not be a symbolic link.");
    }
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code !== "ENOENT") throw error;
  }
}

export async function loadExtensionSkillStore() {
  const source = getExtensionSkillStorePath();
  try {
    await rejectSymlinkTarget(source);
    const info = await stat(source);
    if (info.size > ASTRA_EXTENSION_MAX_FILE_BYTES) {
      throw new Error("Extension skill registry exceeds its file-size limit.");
    }
    const raw = await readFile(source, "utf8");
    const store = normalizeExtensionSkillStore(JSON.parse(raw) as unknown);
    return {
      available: true,
      source,
      store,
      detail:
        "Loaded " +
        store.skills.length +
        " governed extension skill" +
        (store.skills.length === 1 ? "." : "s."),
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
        store: { schemaVersion: 1 as const, skills: [] },
        detail:
          "Extension skill registry is ready; no private registry exists yet.",
      };
    }
    return {
      available: false,
      source,
      store: { schemaVersion: 1 as const, skills: [] },
      detail:
        error instanceof Error
          ? "Extension skill registry could not be loaded safely: " +
            error.message
          : "Extension skill registry could not be loaded safely.",
    };
  }
}

export async function saveExtensionSkillStore(
  store: AstraExtensionSkillStore,
) {
  const normalized = normalizeExtensionSkillStore(
    JSON.parse(JSON.stringify(store)) as unknown,
  );
  const source = getExtensionSkillStorePath();
  const payload = JSON.stringify(normalized, null, 2) + "\n";

  if (
    Buffer.byteLength(payload, "utf8") >
    ASTRA_EXTENSION_MAX_FILE_BYTES
  ) {
    throw new Error("Extension skill registry exceeds its file-size limit.");
  }

  await mkdir(path.dirname(source), { recursive: true, mode: 0o700 });
  await rejectSymlinkTarget(source);
  await writeFile(source, payload, {
    encoding: "utf8",
    mode: 0o600,
  });
  return { source, count: normalized.skills.length };
}

export async function mutateExtensionSkillStore<T>(
  mutate: (store: AstraExtensionSkillStore) =>
    | { store: AstraExtensionSkillStore; result: T }
    | Promise<{ store: AstraExtensionSkillStore; result: T }>,
) {
  return withSkillMutationLock(async () => {
    const loaded = await loadExtensionSkillStore();
    if (!loaded.available) throw new Error(loaded.detail);
    const outcome = await mutate({
      schemaVersion: 1,
      skills: [...loaded.store.skills],
    });
    await saveExtensionSkillStore(outcome.store);
    return outcome.result;
  });
}

export async function registerExtensionSkill(
  manifest: AstraExtensionSkillManifest,
) {
  return mutateExtensionSkillStore((store) => {
    const normalized = normalizeExtensionSkill(manifest);
    if (
      store.skills.some(
        (skill) => skill.id.toLowerCase() === normalized.id.toLowerCase(),
      )
    ) {
      throw new Error("Extension skill id already exists.");
    }
    const safeManifest: AstraExtensionSkillManifest =
      normalized.trust === "unreviewed" &&
      (normalized.installState === "installed" ||
        normalized.installState === "disabled")
        ? {
            ...normalized,
            installState: "available",
          }
        : normalized;

    const skills = [...store.skills, safeManifest];
    return {
      store: { schemaVersion: 1 as const, skills },
      result: safeManifest,
    };
  });
}


export async function recordVerifiedExtensionState({
  skillId,
  installState: nextInstallState,
  version,
  updateState: nextUpdateState,
  evidence,
}: {
  skillId: string;
  installState: AstraExtensionInstallState;
  version?: string;
  updateState?: AstraExtensionUpdateState;
  evidence: AstraExtensionVerificationEvidence;
}) {
  return mutateExtensionSkillStore((store) => {
    const index = store.skills.findIndex(
      (skill) => skill.id.toLowerCase() === skillId.trim().toLowerCase(),
    );
    if (index < 0) throw new Error("Extension skill was not found.");

    const current = store.skills[index];
    if (current.verification === "none") {
      throw new Error(
        "Extension skill does not declare a verification method.",
      );
    }
    if (evidence.method !== current.verification) {
      throw new Error(
        "Extension verification evidence does not match the declared method.",
      );
    }
    const evidenceTime = Date.parse(evidence.at);
    if (!Number.isFinite(evidenceTime)) {
      throw new Error("Extension verification evidence timestamp is invalid.");
    }
    if (!evidence.detail.trim() || evidence.detail.trim().length > 1000) {
      throw new Error("Extension verification evidence detail is invalid.");
    }

    const nextVersion = version?.trim() || current.version;
    if (!nextVersion || nextVersion.length > 120) {
      throw new Error("Extension verified version is invalid.");
    }

    const updated: AstraExtensionSkillManifest = {
      ...current,
      version: nextVersion,
      installState: nextInstallState,
      updateState: nextUpdateState ?? current.updateState,
      updatedAt: new Date(evidenceTime).toISOString(),
    };
    const normalized = normalizeExtensionSkill(updated);
    const skills = [...store.skills];
    skills[index] = normalized;
    return {
      store: { schemaVersion: 1 as const, skills },
      result: {
        skill: normalized,
        verification: {
          method: evidence.method,
          at: new Date(evidenceTime).toISOString(),
          detail: evidence.detail.trim(),
        },
      },
    };
  });
}


export async function recordExtensionReview({
  skillId,
  evidence,
}: {
  skillId: string;
  evidence: AstraExtensionReviewEvidence;
}) {
  return mutateExtensionSkillStore((store) => {
    const index = store.skills.findIndex(
      (skill) => skill.id.toLowerCase() === skillId.trim().toLowerCase(),
    );
    if (index < 0) throw new Error("Extension skill was not found.");

    const current = store.skills[index];
    if (current.trust === "builtin") {
      throw new Error("Builtin extension trust is repository-defined.");
    }

    const reviewedAt = Date.parse(evidence.at);
    if (!Number.isFinite(reviewedAt)) {
      throw new Error("Extension review timestamp is invalid.");
    }
    const reviewer = evidence.reviewer.trim();
    const detail = evidence.detail.trim();
    if (!reviewer || reviewer.length > 120) {
      throw new Error("Extension reviewer is invalid.");
    }
    if (!detail || detail.length > 1000) {
      throw new Error("Extension review detail is invalid.");
    }

    const updated: AstraExtensionSkillManifest = {
      ...current,
      trust: "local_reviewed",
      updatedAt: new Date(reviewedAt).toISOString(),
    };
    const skills = [...store.skills];
    skills[index] = updated;
    return {
      store: { schemaVersion: 1 as const, skills },
      result: {
        skill: updated,
        review: {
          reviewer,
          at: new Date(reviewedAt).toISOString(),
          detail,
        },
      },
    };
  });
}
