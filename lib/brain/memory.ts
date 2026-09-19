import { readFile } from "node:fs/promises";
import path from "node:path";

export type AstraMemoryEntry = {
  id: string;
  text: string;
  tags?: string[];
  updatedAt?: string;
};

export type AstraMemoryContext = {
  enabled: boolean;
  available: boolean;
  source: string;
  entries: AstraMemoryEntry[];
  text: string;
  detail: string;
};

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "off", "no"].includes(value);
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.floor(parsed));
}

function memoryPath() {
  const configured = process.env.ASTRA_MEMORY_FILE?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".astra", "memory.json");
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\u1e00-\u1eff]+/gi, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function scoreEntry(inputTokens: Set<string>, entry: AstraMemoryEntry) {
  const haystack = new Set(tokenize(`${entry.text} ${(entry.tags ?? []).join(" ")}`));
  let score = 0;
  for (const token of inputTokens) {
    if (haystack.has(token)) score += 1;
  }
  return score;
}

function normalizeEntries(value: unknown): AstraMemoryEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const text = typeof record.text === "string" ? record.text.trim() : "";
      if (!text) return null;
      const id =
        typeof record.id === "string" && record.id.trim()
          ? record.id.trim()
          : `memory-${index + 1}`;
      const tags = Array.isArray(record.tags)
        ? record.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 20)
        : undefined;
      const updatedAt =
        typeof record.updatedAt === "string" ? record.updatedAt : undefined;
      return { id, text: text.slice(0, 4000), tags, updatedAt };
    })
    .filter((entry): entry is AstraMemoryEntry => Boolean(entry));
}

export async function getMemoryContext(input: string): Promise<AstraMemoryContext> {
  const enabled = envFlag("ASTRA_MEMORY_ENABLED", true);
  const source = memoryPath();

  if (!enabled) {
    return {
      enabled: false,
      available: false,
      source,
      entries: [],
      text: "",
      detail: "Local memory retrieval is disabled by ASTRA_MEMORY_ENABLED.",
    };
  }

  try {
    const raw = await readFile(source, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const entries = normalizeEntries(parsed);
    const limit = parsePositiveInt(process.env.ASTRA_MEMORY_MAX_ENTRIES, 6, 20);
    const maxChars = parsePositiveInt(process.env.ASTRA_MEMORY_MAX_CHARS, 4200, 16000);
    const inputTokens = new Set(tokenize(input));

    const ranked = entries
      .map((entry, index) => ({
        entry,
        index,
        score: scoreEntry(inputTokens, entry),
      }))
      .sort((a, b) => b.score - a.score || b.index - a.index);

    const relevant = ranked
      .filter((item) => item.score > 0)
      .slice(0, limit)
      .map((item) => item.entry);

    const selected = relevant.length > 0 ? relevant : entries.slice(-Math.min(2, limit));
    const lines: string[] = [];
    let used = 0;

    for (const entry of selected) {
      const line = `- [${entry.id}] ${entry.text.replace(/\s+/g, " ").trim()}`;
      if (used + line.length > maxChars) break;
      lines.push(line);
      used += line.length;
    }

    return {
      enabled: true,
      available: true,
      source,
      entries: selected.slice(0, lines.length),
      text: lines.length > 0 ? `Relevant local ASTRA memory:\n${lines.join("\n")}` : "",
      detail:
        entries.length === 0
          ? "Local memory file is readable but contains no entries."
          : `Loaded ${lines.length} relevant memory entr${lines.length === 1 ? "y" : "ies"} from ${entries.length} available.`,
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
        entries: [],
        text: "",
        detail:
          "Local memory is ready; no memory file exists yet. Create .astra/memory.json when durable private context is needed.",
      };
    }

    return {
      enabled: true,
      available: false,
      source,
      entries: [],
      text: "",
      detail:
        error instanceof Error
          ? `Local memory could not be read: ${error.message}`
          : "Local memory could not be read.",
    };
  }
}
