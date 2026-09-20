import type { AstraMemoryEntry, AstraMemoryContext } from "./memory";
import { getMemoryContext } from "./memory";
import type { AstraMemorySource } from "@/lib/memory/contracts";
import { searchMemorySources } from "@/lib/memory/manager";
import { sonorMemorySource } from "@/lib/memory/sonor";

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  maximum: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(maximum, Math.floor(parsed));
}

function recordToEntry(
  record: Awaited<ReturnType<typeof searchMemorySources>>["records"][number],
): AstraMemoryEntry {
  return {
    id: record.id,
    text: record.content,
    tags: record.tags,
    updatedAt: record.provenance.timestamp,
    project: record.provenance.project,
  };
}

export async function getUnifiedMemoryContext(
  input: string,
  project?: string,
  signal?: AbortSignal,
): Promise<AstraMemoryContext> {
  const local = await getMemoryContext(input);

  const localSource: AstraMemorySource = {
    id: "astra-local-memory",
    type: "local",
    async search() {
      return {
        source: "astra-local-memory",
        sourceType: "local" as const,
        available: local.available,
        detail: local.detail,
        records: local.records,
      };
    },
  };

  const limit = parsePositiveInt(process.env.ASTRA_MEMORY_MAX_ENTRIES, 6, 20);
  const maxChars = parsePositiveInt(process.env.ASTRA_MEMORY_MAX_CHARS, 4200, 16000);

  const aggregate = await searchMemorySources(
    {
      input,
      project,
      limit,
      maxChars,
      signal,
    },
    [localSource, sonorMemorySource],
  );

  const records = aggregate.records;
  const entries = records.map(recordToEntry);
  const lines: string[] = [];
  let used = 0;

  for (const record of records) {
    const prefix =
      "[" +
      record.provenance.sourceType +
      ":" +
      record.provenance.reference +
      "]";
    const line =
      "- " +
      prefix +
      " " +
      record.content.replace(/\s+/g, " ").trim();
    if (used + line.length > maxChars) break;
    lines.push(line);
    used += line.length;
  }

  const sonorResult = aggregate.sources.find(
    (source) => source.sourceType === "sonor",
  );
  const enabled =
    local.enabled ||
    Boolean(process.env.ASTRA_SONOR_ENABLED?.match(/^(1|true|on|yes)$/i));

  return {
    enabled,
    available:
      local.available || Boolean(sonorResult?.available),
    source: "astra-memory-manager",
    entries: entries.slice(0, lines.length),
    records: records.slice(0, lines.length),
    text:
      lines.length > 0
        ? "Relevant ASTRA memory context:\n" + lines.join("\n")
        : "",
    detail: aggregate.detail,
  };
}
