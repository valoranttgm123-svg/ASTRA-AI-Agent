import {
  clampMemoryScore,
  type AstraMemoryLifecycleListener,
  type AstraMemoryQuery,
  type AstraMemoryRecord,
  type AstraMemorySource,
  type AstraMemorySourceResult,
} from "./contracts";

export type AstraMemoryAggregate = {
  records: AstraMemoryRecord[];
  sources: AstraMemorySourceResult[];
  detail: string;
};

function abortError() {
  const error = new Error("Memory search was cancelled.");
  error.name = "AbortError";
  return error;
}

function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
}

function sameProject(record: AstraMemoryRecord, project?: string) {
  if (!project) return true;
  const recordProject = record.provenance.project?.trim().toLowerCase();
  if (!recordProject) return true;
  return recordProject === project.trim().toLowerCase();
}

function normalizeRecord(record: AstraMemoryRecord): AstraMemoryRecord {
  return {
    ...record,
    content: record.content.slice(0, 4000),
    tags: record.tags?.slice(0, 20),
    relevance: clampMemoryScore(record.relevance),
    confidence: clampMemoryScore(record.confidence),
  };
}

async function querySource(
  source: AstraMemorySource,
  query: AstraMemoryQuery,
): Promise<AstraMemorySourceResult> {
  checkCancelled(query.signal);
  try {
    const result = await source.search(query);
    checkCancelled(query.signal);
    return {
      ...result,
      records: result.records.map(normalizeRecord),
    };
  } catch (error) {
    if (query.signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw abortError();
    }
    return {
      source: source.id,
      sourceType: source.type,
      available: false,
      detail:
        error instanceof Error
          ? source.id + " failed: " + error.message
          : source.id + " failed.",
      records: [],
    };
  }
}

export async function searchMemorySources(
  query: AstraMemoryQuery,
  sources: readonly AstraMemorySource[],
  onEvent?: AstraMemoryLifecycleListener,
): Promise<AstraMemoryAggregate> {
  checkCancelled(query.signal);
  onEvent?.({
    type: "search.started",
    sourceCount: sources.length,
    project: query.project,
  });

  const boundedLimit = Math.max(1, Math.min(20, Math.floor(query.limit || 1)));
  const boundedChars = Math.max(1, Math.min(16000, Math.floor(query.maxChars || 1)));
  const results = await Promise.all(
    sources.map(async (source) => {
      const result = await querySource(source, query);
      onEvent?.({
        type: "source.queried",
        source: result.source,
        sourceType: result.sourceType,
        available: result.available,
        recordCount: result.records.length,
        detail: result.detail,
      });
      const graphMatches = result.records.filter(
        (record) =>
          record.provenance.sourceType === "graphify" ||
          record.provenance.sourceType === "sonor",
      ).length;
      if (graphMatches > 0) {
        onEvent?.({
          type: "graph.matched",
          source: result.source,
          recordCount: graphMatches,
        });
      }
      return result;
    }),
  );

  checkCancelled(query.signal);

  const deduped = new Map<string, AstraMemoryRecord>();

  for (const result of results) {
    for (const record of result.records) {
      if (!sameProject(record, query.project)) continue;
      const key =
        record.provenance.reference ||
        record.provenance.sourceType + ":" + record.id;
      const existing = deduped.get(key);
      if (
        !existing ||
        record.relevance > existing.relevance ||
        (record.relevance === existing.relevance &&
          record.confidence > existing.confidence)
      ) {
        deduped.set(key, record);
      }
    }
  }

  const ranked = [...deduped.values()].sort((a, b) => {
    if (b.relevance !== a.relevance) return b.relevance - a.relevance;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    const aTime = Date.parse(a.provenance.timestamp ?? "") || 0;
    const bTime = Date.parse(b.provenance.timestamp ?? "") || 0;
    return bTime - aTime;
  });

  const selected: AstraMemoryRecord[] = [];
  let usedChars = 0;

  for (const record of ranked) {
    if (selected.length >= boundedLimit) break;
    if (usedChars + record.content.length > boundedChars) continue;
    selected.push(record);
    usedChars += record.content.length;
  }

  const availableSources = results.filter((result) => result.available).length;
  const failedSources = results.length - availableSources;

  onEvent?.({
    type: "context.selected",
    recordCount: selected.length,
    sourceTypes: [...new Set(selected.map((record) => record.provenance.sourceType))],
  });
  onEvent?.({
    type: "search.completed",
    selectedCount: selected.length,
    availableSources,
    unavailableSources: failedSources,
  });

  return {
    records: selected,
    sources: results,
    detail:
      "Selected " +
      selected.length +
      " memory record" +
      (selected.length === 1 ? "" : "s") +
      " from " +
      availableSources +
      " available source" +
      (availableSources === 1 ? "" : "s") +
      (failedSources > 0
        ? "; " +
          failedSources +
          " source" +
          (failedSources === 1 ? "" : "s") +
          " unavailable."
        : "."),
  };
}
