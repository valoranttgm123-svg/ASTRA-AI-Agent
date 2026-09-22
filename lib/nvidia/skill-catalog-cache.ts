import {
  lstat,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type {
  NvidiaSkillStateRecord,
  NvidiaSkillTruthState,
} from "./skill-state";

export const NVIDIA_SKILL_CATALOG_MAX_ENTRIES = 1024;
export const NVIDIA_SKILL_CATALOG_MAX_FILE_BYTES = 2 * 1024 * 1024;

export type NvidiaSkillCatalogEntry = {
  id: string;
  title?: string;
  description?: string;
  version?: string;
  checksum?: string;
  categories: string[];
};

export type NvidiaSkillCatalogSnapshot = {
  schemaVersion: 1;
  source: string;
  capturedAt: string;
  skills: NvidiaSkillCatalogEntry[];
};

export type NvidiaSkillCatalogProvider = {
  id: string;
  discover: (signal?: AbortSignal) => Promise<NvidiaSkillCatalogSnapshot>;
};

export type NvidiaSkillCatalogContext = {
  available: boolean;
  source: string;
  snapshot?: NvidiaSkillCatalogSnapshot;
  detail: string;
};

export type NvidiaSkillCatalogView = NvidiaSkillCatalogEntry & {
  state: NvidiaSkillTruthState;
  stateDetail?: string;
};

function catalogPath() {
  const configured = process.env.ASTRA_NVIDIA_SKILL_CATALOG_FILE?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".astra", "nvidia-skill-catalog.json");
}

export function getNvidiaSkillCatalogPath() {
  return catalogPath();
}

function requiredString(
  value: unknown,
  field: string,
  maxLength: number,
) {
  if (typeof value !== "string") {
    throw new Error("NVIDIA catalog " + field + " must be a string.");
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) {
    throw new Error(
      "NVIDIA catalog " +
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

function stringList(value: unknown, maxItems: number, maxLength: number) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error("NVIDIA catalog categories must be an array.");
  }
  return value
    .slice(0, maxItems)
    .map((entry) => requiredString(entry, "category", maxLength));
}

function normalizeEntry(
  value: unknown,
  index: number,
): NvidiaSkillCatalogEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      "NVIDIA catalog entry " + (index + 1) + " must be an object.",
    );
  }
  const record = value as Record<string, unknown>;
  return {
    id: requiredString(record.id, "id", 160),
    title: optionalString(record.title, "title", 240),
    description: optionalString(record.description, "description", 2000),
    version: optionalString(record.version, "version", 160),
    checksum: optionalString(record.checksum, "checksum", 256),
    categories: stringList(record.categories, 20, 120),
  };
}

export function normalizeNvidiaSkillCatalog(
  value: unknown,
): NvidiaSkillCatalogSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("NVIDIA skill catalog snapshot must be an object.");
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1) {
    throw new Error("Unsupported NVIDIA skill catalog schemaVersion.");
  }
  if (!Array.isArray(record.skills)) {
    throw new Error("NVIDIA skill catalog skills must be an array.");
  }
  if (record.skills.length > NVIDIA_SKILL_CATALOG_MAX_ENTRIES) {
    throw new Error(
      "NVIDIA skill catalog exceeds " +
        NVIDIA_SKILL_CATALOG_MAX_ENTRIES +
        " entries.",
    );
  }

  const capturedAtRaw = requiredString(
    record.capturedAt,
    "capturedAt",
    80,
  );
  const capturedAtMs = Date.parse(capturedAtRaw);
  if (!Number.isFinite(capturedAtMs)) {
    throw new Error("NVIDIA catalog capturedAt must be an ISO timestamp.");
  }

  const skills = record.skills.map(normalizeEntry);
  const seen = new Set<string>();
  for (const skill of skills) {
    const key = skill.id.toLowerCase();
    if (seen.has(key)) {
      throw new Error("Duplicate NVIDIA catalog skill id: " + skill.id + ".");
    }
    seen.add(key);
  }

  return {
    schemaVersion: 1,
    source: requiredString(record.source, "source", 500),
    capturedAt: new Date(capturedAtMs).toISOString(),
    skills,
  };
}

async function rejectSymlinkTarget(source: string) {
  try {
    const info = await lstat(source);
    if (info.isSymbolicLink()) {
      throw new Error("NVIDIA catalog cache must not be a symbolic link.");
    }
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code !== "ENOENT") throw error;
  }
}

export async function loadNvidiaSkillCatalog(): Promise<NvidiaSkillCatalogContext> {
  const source = catalogPath();

  try {
    await rejectSymlinkTarget(source);
    const info = await stat(source);
    if (info.size > NVIDIA_SKILL_CATALOG_MAX_FILE_BYTES) {
      throw new Error(
        "NVIDIA catalog cache exceeds " +
          NVIDIA_SKILL_CATALOG_MAX_FILE_BYTES +
          " bytes.",
      );
    }
    const raw = await readFile(source, "utf8");
    const snapshot = normalizeNvidiaSkillCatalog(
      JSON.parse(raw) as unknown,
    );
    return {
      available: true,
      source,
      snapshot,
      detail:
        "Loaded NVIDIA skill catalog snapshot with " +
        snapshot.skills.length +
        " entries.",
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
        detail:
          "NVIDIA skill catalog cache is ready; no private snapshot exists yet.",
      };
    }

    return {
      available: false,
      source,
      detail:
        error instanceof Error
          ? "NVIDIA skill catalog cache could not be loaded safely: " +
            error.message
          : "NVIDIA skill catalog cache could not be loaded safely.",
    };
  }
}

export async function refreshNvidiaSkillCatalog({
  provider,
  signal,
}: {
  provider: NvidiaSkillCatalogProvider;
  signal?: AbortSignal;
}) {
  if (signal?.aborted) {
    throw new DOMException("NVIDIA skill catalog refresh aborted.", "AbortError");
  }

  const discovered = await provider.discover(signal);

  if (signal?.aborted) {
    throw new DOMException("NVIDIA skill catalog refresh aborted.", "AbortError");
  }

  const normalized = normalizeNvidiaSkillCatalog(discovered);
  const saved = await saveNvidiaSkillCatalog(normalized);
  return {
    provider: provider.id,
    snapshot: normalized,
    source: saved.source,
    count: saved.count,
  };
}

export async function saveNvidiaSkillCatalog(
  snapshot: NvidiaSkillCatalogSnapshot,
) {
  const normalized = normalizeNvidiaSkillCatalog(
    JSON.parse(JSON.stringify(snapshot)) as unknown,
  );
  const source = catalogPath();
  const payload = JSON.stringify(normalized, null, 2) + "\n";

  if (
    Buffer.byteLength(payload, "utf8") >
    NVIDIA_SKILL_CATALOG_MAX_FILE_BYTES
  ) {
    throw new Error(
      "NVIDIA catalog cache exceeds " +
        NVIDIA_SKILL_CATALOG_MAX_FILE_BYTES +
        " bytes.",
    );
  }

  await mkdir(path.dirname(source), { recursive: true, mode: 0o700 });
  await rejectSymlinkTarget(source);
  await writeFile(source, payload, {
    encoding: "utf8",
    mode: 0o600,
  });

  return { source, count: normalized.skills.length };
}

export function mergeNvidiaSkillCatalogState(
  snapshot: NvidiaSkillCatalogSnapshot,
  state: readonly NvidiaSkillStateRecord[],
): NvidiaSkillCatalogView[] {
  const byId = new Map(
    state.map((record) => [record.id.toLowerCase(), record]),
  );

  return snapshot.skills.map((skill) => {
    const current = byId.get(skill.id.toLowerCase());
    return {
      ...skill,
      state: current?.state ?? "available",
      stateDetail: current?.detail,
    };
  });
}
