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
  AstraSkillHealth,
  AstraSkillInstallState,
  AstraSkillManifest,
  AstraSkillMutationAction,
  AstraSkillMutationPlan,
  AstraSkillNetworkRequirement,
  AstraSkillRollbackMetadata,
  AstraSkillStore,
  AstraSkillTrustState,
  AstraSkillUpdateState,
} from "./contracts";

export const ASTRA_SKILL_MAX_ENTRIES = 512;
export const ASTRA_SKILL_MAX_FILE_BYTES = 1024 * 1024;

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

export function getSkillRegistryPath() {
  const configured = process.env.ASTRA_GENERIC_SKILL_REGISTRY_FILE?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".astra", "generic-skills.json");
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Skill " + field + " must be an object.");
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, max: number) {
  if (typeof value !== "string") {
    throw new Error("Skill " + field + " must be a string.");
  }
  const clean = value.trim();
  if (!clean || clean.length > max) {
    throw new Error(
      "Skill " + field + " must contain 1-" + max + " characters.",
    );
  }
  return clean;
}

function optionalString(
  value: unknown,
  field: string,
  max: number,
): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, field, max);
}

function identifier(value: unknown, field: string, max = 160) {
  const clean = requiredString(value, field, max);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(clean)) {
    throw new Error("Skill " + field + " contains unsupported characters.");
  }
  return clean;
}

function iso(value: unknown, field: string) {
  const raw = requiredString(value, field, 80);
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) {
    throw new Error("Skill " + field + " must be an ISO timestamp.");
  }
  return new Date(timestamp).toISOString();
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
  throw new Error("Skill permissionLevel must be 0-4.");
}

function network(value: unknown): AstraSkillNetworkRequirement {
  if (value === "none" || value === "local" || value === "internet") {
    return value;
  }
  throw new Error("Skill network requirement is invalid.");
}

function trust(value: unknown): AstraSkillTrustState {
  if (value === "untrusted" || value === "reviewed") return value;
  throw new Error("Skill trust state is invalid.");
}

function installState(value: unknown): AstraSkillInstallState {
  if (
    value === "registered" ||
    value === "installed" ||
    value === "incompatible"
  ) {
    return value;
  }
  throw new Error("Skill install state is invalid.");
}

function updateState(value: unknown): AstraSkillUpdateState {
  if (
    value === "current" ||
    value === "update_available" ||
    value === "error"
  ) {
    return value;
  }
  throw new Error("Skill update state is invalid.");
}

function stringList(
  value: unknown,
  field: string,
  maxItems: number,
  maxLength: number,
) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error("Skill " + field + " must be a bounded array.");
  }
  const result = value.map((entry) => identifier(entry, field, maxLength));
  return [...new Set(result)];
}

function rollback(
  value: unknown,
): AstraSkillRollbackMetadata | undefined {
  if (value === undefined) return undefined;
  const record = object(value, "rollback");
  return {
    version: requiredString(record.version, "rollback.version", 160),
    checksum: optionalString(record.checksum, "rollback.checksum", 256),
    artifactRef: optionalString(record.artifactRef, "rollback.artifactRef", 500),
    recordedAt: iso(record.recordedAt, "rollback.recordedAt"),
  };
}

export function normalizeSkillManifest(
  value: unknown,
  index = 0,
): AstraSkillManifest {
  const record = object(value, "entry " + (index + 1));
  const state = installState(record.installState);
  const enabled =
    typeof record.enabled === "boolean"
      ? record.enabled
      : (() => {
          throw new Error("Skill enabled must be boolean.");
        })();
  const installedAt =
    record.installedAt === undefined
      ? undefined
      : iso(record.installedAt, "installedAt");

  if (enabled && state !== "installed") {
    throw new Error("Only installed skills may be enabled.");
  }
  if (state === "installed" && installedAt === undefined) {
    throw new Error("Installed skills require installedAt.");
  }

  return {
    id: identifier(record.id, "id"),
    version: requiredString(record.version, "version", 160),
    capability: identifier(record.capability, "capability", 160),
    toolIds: stringList(record.toolIds, "toolIds", 32, 160),
    provider: requiredString(record.provider, "provider", 240),
    permissionLevel: permission(record.permissionLevel),
    network: network(record.network),
    secretNames: stringList(record.secretNames, "secretNames", 32, 160),
    verificationMethod: requiredString(
      record.verificationMethod,
      "verificationMethod",
      1000,
    ),
    installState: state,
    updateState: updateState(record.updateState),
    trustState: trust(record.trustState),
    enabled,
    checksum: optionalString(record.checksum, "checksum", 256),
    installedAt,
    updatedAt: iso(record.updatedAt, "updatedAt"),
    rollback: rollback(record.rollback),
  };
}

export function normalizeSkillStore(value: unknown): AstraSkillStore {
  const root = object(value, "store");
  if (root.schemaVersion !== 1) {
    throw new Error("Unsupported skill registry schemaVersion.");
  }
  if (!Array.isArray(root.skills)) {
    throw new Error("Skill registry skills must be an array.");
  }
  if (root.skills.length > ASTRA_SKILL_MAX_ENTRIES) {
    throw new Error("Skill registry entry limit exceeded.");
  }

  const skills = root.skills.map(normalizeSkillManifest);
  const ids = new Set<string>();
  for (const skill of skills) {
    const key = skill.id.toLowerCase();
    if (ids.has(key)) {
      throw new Error("Duplicate skill id: " + skill.id + ".");
    }
    ids.add(key);
  }
  return { schemaVersion: 1, skills };
}

async function rejectSymlinkTarget(source: string) {
  try {
    const info = await lstat(source);
    if (info.isSymbolicLink()) {
      throw new Error("Skill registry must not be a symbolic link.");
    }
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code !== "ENOENT") throw error;
  }
}

export async function loadSkillStore() {
  const source = getSkillRegistryPath();
  try {
    await rejectSymlinkTarget(source);
    const info = await stat(source);
    if (info.size > ASTRA_SKILL_MAX_FILE_BYTES) {
      throw new Error("Skill registry exceeds its file-size limit.");
    }
    const raw = await readFile(source, "utf8");
    const store = normalizeSkillStore(JSON.parse(raw) as unknown);
    return {
      available: true,
      source,
      store,
      detail:
        "Loaded " +
        store.skills.length +
        " generic skill record" +
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
          "Generic skill registry is ready; no private .astra/generic-skills.json exists yet.",
      };
    }
    return {
      available: false,
      source,
      store: { schemaVersion: 1 as const, skills: [] },
      detail:
        error instanceof Error
          ? "Skill registry could not be loaded safely: " + error.message
          : "Skill registry could not be loaded safely.",
    };
  }
}

export async function saveSkillStore(store: AstraSkillStore) {
  const normalized = normalizeSkillStore(
    JSON.parse(JSON.stringify(store)) as unknown,
  );
  const source = getSkillRegistryPath();
  const payload = JSON.stringify(normalized, null, 2) + "\n";
  if (Buffer.byteLength(payload, "utf8") > ASTRA_SKILL_MAX_FILE_BYTES) {
    throw new Error("Skill registry exceeds its file-size limit.");
  }
  await mkdir(path.dirname(source), { recursive: true, mode: 0o700 });
  await rejectSymlinkTarget(source);
  await writeFile(source, payload, { encoding: "utf8", mode: 0o600 });
  return { source, count: normalized.skills.length };
}

async function mutateSkillStore<T>(
  mutate: (store: AstraSkillStore) =>
    | { store: AstraSkillStore; result: T }
    | Promise<{ store: AstraSkillStore; result: T }>,
) {
  return withMutationLock(async () => {
    const loaded = await loadSkillStore();
    if (!loaded.available) throw new Error(loaded.detail);
    const outcome = await mutate({
      schemaVersion: 1,
      skills: [...loaded.store.skills],
    });
    await saveSkillStore(outcome.store);
    return outcome.result;
  });
}

export async function registerSkill({
  id,
  version,
  capability,
  toolIds,
  provider,
  permissionLevel,
  network = "none",
  secretNames = [],
  verificationMethod,
  checksum,
  now = new Date(),
}: {
  id: string;
  version: string;
  capability: string;
  toolIds: string[];
  provider: string;
  permissionLevel: AstraPermissionLevel;
  network?: AstraSkillNetworkRequirement;
  secretNames?: string[];
  verificationMethod: string;
  checksum?: string;
  now?: Date;
}) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid skill registration time.");
  }

  return mutateSkillStore((store) => {
    if (
      store.skills.some(
        (skill) => skill.id.toLowerCase() === id.trim().toLowerCase(),
      )
    ) {
      throw new Error("Skill id already exists.");
    }

    const manifest = normalizeSkillManifest({
      id,
      version,
      capability,
      toolIds,
      provider,
      permissionLevel,
      network,
      secretNames,
      verificationMethod,
      installState: "registered",
      updateState: "current",
      trustState: "untrusted",
      enabled: false,
      checksum,
      updatedAt: now.toISOString(),
    });

    return {
      store: {
        schemaVersion: 1 as const,
        skills: [...store.skills, manifest],
      },
      result: manifest,
    };
  });
}

export function planSkillMutation(
  skill: AstraSkillManifest,
  action: AstraSkillMutationAction,
): AstraSkillMutationPlan {
  const base = {
    action,
    skillId: skill.id,
    requiredPermissionLevel: 2 as const,
  };

  switch (action) {
    case "review":
      return skill.trustState === "untrusted"
        ? {
            ...base,
            allowed: true,
            requiresVerification: false,
            detail:
              "Review records explicit local trust metadata only; it does not grant execution authority.",
          }
        : {
            ...base,
            allowed: false,
            requiresVerification: false,
            detail: "Skill is already reviewed.",
          };
    case "install":
      if (skill.trustState !== "reviewed") {
        return {
          ...base,
          allowed: false,
          requiresVerification: true,
          detail: "Untrusted skills cannot be installed.",
        };
      }
      return skill.installState === "registered"
        ? {
            ...base,
            allowed: true,
            requiresVerification: true,
            detail:
              "Install must use a verified provider mechanism and remains disabled until explicitly enabled.",
          }
        : {
            ...base,
            allowed: false,
            requiresVerification: true,
            detail: "Only a registered skill can be installed.",
          };
    case "enable":
      return skill.trustState === "reviewed" &&
        skill.installState === "installed" &&
        !skill.enabled
        ? {
            ...base,
            allowed: true,
            requiresVerification: false,
            detail:
              "Enable changes local skill state only; Tool Runtime permissions remain authoritative.",
          }
        : {
            ...base,
            allowed: false,
            requiresVerification: false,
            detail: "Skill must be reviewed, installed, and disabled before enable.",
          };
    case "disable":
      return skill.installState === "installed" && skill.enabled
        ? {
            ...base,
            allowed: true,
            requiresVerification: false,
            detail: "Disable prevents the skill from being selected.",
          }
        : {
            ...base,
            allowed: false,
            requiresVerification: false,
            detail: "Only an enabled installed skill can be disabled.",
          };
    case "update":
      return skill.trustState === "reviewed" &&
        skill.installState === "installed"
        ? {
            ...base,
            allowed: true,
            requiresVerification: true,
            detail:
              "Update requires a verified provider mechanism and records rollback metadata.",
          }
        : {
            ...base,
            allowed: false,
            requiresVerification: true,
            detail: "Only a reviewed installed skill can be updated.",
          };
    case "rollback":
      return skill.trustState === "reviewed" &&
        skill.installState === "installed" &&
        Boolean(skill.rollback)
        ? {
            ...base,
            allowed: true,
            requiresVerification: true,
            detail:
              "Rollback requires verified restoration and preserves the prior version as recovery metadata.",
          }
        : {
            ...base,
            allowed: false,
            requiresVerification: true,
            detail: "Rollback metadata is not available for this installed skill.",
          };
    case "remove":
      return skill.installState === "installed"
        ? {
            ...base,
            allowed: true,
            requiresVerification: true,
            detail:
              "Removal requires verified provider cleanup and returns the manifest to registered/disabled state.",
          }
        : {
            ...base,
            allowed: false,
            requiresVerification: true,
            detail: "Only an installed skill can be removed.",
          };
  }
}

export async function applySkillMutation({
  skillId,
  action,
  verificationEvidence,
  targetVersion,
  targetChecksum,
  now = new Date(),
}: {
  skillId: string;
  action: AstraSkillMutationAction;
  verificationEvidence?: string;
  targetVersion?: string;
  targetChecksum?: string;
  now?: Date;
}) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid skill mutation time.");
  }

  return mutateSkillStore((store) => {
    const index = store.skills.findIndex(
      (skill) => skill.id.toLowerCase() === skillId.trim().toLowerCase(),
    );
    if (index < 0) throw new Error("Skill was not found.");

    const current = store.skills[index];
    const plan = planSkillMutation(current, action);
    if (!plan.allowed) throw new Error(plan.detail);
    if (
      plan.requiresVerification &&
      !(verificationEvidence?.trim())
    ) {
      throw new Error(
        "Verified evidence is required before applying " + action + ".",
      );
    }

    const timestamp = now.toISOString();
    let updated: AstraSkillManifest = { ...current, updatedAt: timestamp };

    switch (action) {
      case "review":
        updated = { ...updated, trustState: "reviewed" };
        break;
      case "install":
        updated = {
          ...updated,
          installState: "installed",
          enabled: false,
          installedAt: timestamp,
          updateState: "current",
        };
        break;
      case "enable":
        updated = { ...updated, enabled: true };
        break;
      case "disable":
        updated = { ...updated, enabled: false };
        break;
      case "update": {
        const version = requiredString(targetVersion, "targetVersion", 160);
        const prior: AstraSkillRollbackMetadata = {
          version: current.version,
          checksum: current.checksum,
          recordedAt: timestamp,
        };
        updated = {
          ...updated,
          version,
          checksum:
            targetChecksum === undefined
              ? current.checksum
              : requiredString(targetChecksum, "targetChecksum", 256),
          updateState: "current",
          rollback: prior,
        };
        break;
      }
      case "rollback": {
        if (!current.rollback) {
          throw new Error("Rollback metadata is not available.");
        }
        const prior: AstraSkillRollbackMetadata = {
          version: current.version,
          checksum: current.checksum,
          recordedAt: timestamp,
        };
        updated = {
          ...updated,
          version: current.rollback.version,
          checksum: current.rollback.checksum,
          updateState: "current",
          rollback: prior,
        };
        break;
      }
      case "remove":
        updated = {
          ...updated,
          installState: "registered",
          enabled: false,
          installedAt: undefined,
          rollback: undefined,
          updateState: "current",
        };
        break;
    }

    const normalized = normalizeSkillManifest(updated);
    const skills = [...store.skills];
    skills[index] = normalized;
    return {
      store: { schemaVersion: 1 as const, skills },
      result: normalized,
    };
  });
}

export function checkSkillHealth({
  skill,
  tools,
  availableSecrets = new Set<string>(),
  localNetworkAvailable = false,
  internetAvailable = false,
}: {
  skill: AstraSkillManifest;
  tools: AstraToolRegistry;
  availableSecrets?: ReadonlySet<string>;
  localNetworkAvailable?: boolean;
  internetAvailable?: boolean;
}): AstraSkillHealth {
  if (skill.trustState !== "reviewed") {
    return {
      skillId: skill.id,
      status: "DISABLED",
      detail: "Skill remains untrusted until explicit review.",
    };
  }
  if (skill.installState !== "installed" || !skill.enabled) {
    return {
      skillId: skill.id,
      status: "DISABLED",
      detail: "Skill is not both installed and enabled.",
    };
  }

  const missingSecrets = skill.secretNames.filter(
    (name) => !availableSecrets.has(name),
  );
  if (missingSecrets.length > 0) {
    return {
      skillId: skill.id,
      status: "NOT_CONFIGURED",
      detail:
        "Required secret names are not available: " +
        missingSecrets.join(", ") +
        ".",
    };
  }

  if (skill.network === "local" && !localNetworkAvailable) {
    return {
      skillId: skill.id,
      status: "NOT_CONFIGURED",
      detail: "Local network capability has not been verified available.",
    };
  }
  if (skill.network === "internet" && !internetAvailable) {
    return {
      skillId: skill.id,
      status: "NOT_CONFIGURED",
      detail: "Internet capability has not been verified available.",
    };
  }

  for (const toolId of skill.toolIds) {
    const tool = tools.get(toolId);
    if (!tool) {
      return {
        skillId: skill.id,
        status: "NOT_CONFIGURED",
        detail: "Mapped tool is not registered: " + toolId + ".",
      };
    }
    if (skill.permissionLevel < tool.permissionLevel) {
      return {
        skillId: skill.id,
        status: "ERROR",
        detail:
          "Skill permission declaration understates mapped tool " +
          tool.id +
          ".",
      };
    }
    if (tool.availability !== "READY") {
      return {
        skillId: skill.id,
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
    skillId: skill.id,
    status: "READY",
    detail:
      "Reviewed skill is installed, enabled, and all mapped requirements are verified.",
  };
}
