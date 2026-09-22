export const NVIDIA_RETRIEVER_MAX_RESULTS = 20;
export const NVIDIA_RETRIEVER_MAX_TEXT_CHARS = 8_000;

export type NvidiaRetrieverRequest = {
  query: string;
  projectId: string;
  namespace: string;
  limit: number;
};

export type NvidiaRetrieverRecord = {
  id: string;
  text: string;
  score?: number;
  sourceType: "sonor" | "project" | "document" | "external";
  reference: string;
  projectId: string;
  namespace: string;
  untrusted: true;
};

export type NvidiaRetrieverResult = {
  ok: boolean;
  provider: string;
  detail: string;
  records: NvidiaRetrieverRecord[];
};

export interface NvidiaRetrieverProvider {
  readonly provider: string;
  status(input: {
    signal: AbortSignal;
  }): Promise<{
    configured: boolean;
    available: boolean;
    detail: string;
  }>;
  search(
    input: NvidiaRetrieverRequest & { signal: AbortSignal },
  ): Promise<NvidiaRetrieverResult>;
}

function clean(value: string, max: number) {
  return value.replace(/\0/g, "").trim().slice(0, max);
}

export function normalizeNvidiaRetrieverRequest(input: {
  query: string;
  projectId: string;
  namespace?: string;
  limit?: number;
}): NvidiaRetrieverRequest {
  const query = clean(input.query ?? "", 2000);
  const projectId = clean(input.projectId ?? "", 120);
  const namespace = clean(input.namespace || projectId, 120);
  if (!query) throw new Error("Retriever query is required.");
  if (!projectId) throw new Error("Retriever projectId is required.");
  if (!namespace) throw new Error("Retriever namespace is required.");

  return {
    query,
    projectId,
    namespace,
    limit: Number.isFinite(input.limit)
      ? Math.max(
          1,
          Math.min(NVIDIA_RETRIEVER_MAX_RESULTS, Math.floor(input.limit!)),
        )
      : 8,
  };
}

export function normalizeNvidiaRetrieverResult(
  result: NvidiaRetrieverResult,
  request: NvidiaRetrieverRequest,
): NvidiaRetrieverResult {
  const records: NvidiaRetrieverRecord[] = [];

  for (const item of result.records.slice(0, request.limit)) {
    if (item.projectId !== request.projectId) continue;
    if (item.namespace !== request.namespace) continue;

    const id = clean(item.id, 160);
    const text = clean(item.text, NVIDIA_RETRIEVER_MAX_TEXT_CHARS);
    const reference = clean(item.reference, 500);
    if (!id || !text || !reference) continue;

    records.push({
      id,
      text,
      score:
        typeof item.score === "number" && Number.isFinite(item.score)
          ? Math.max(0, Math.min(1, item.score))
          : undefined,
      sourceType:
        item.sourceType === "sonor" ||
        item.sourceType === "project" ||
        item.sourceType === "document"
          ? item.sourceType
          : "external",
      reference,
      projectId: request.projectId,
      namespace: request.namespace,
      untrusted: true,
    });
  }

  return {
    ok: result.ok === true,
    provider: clean(result.provider, 120),
    detail: clean(result.detail, 1000),
    records,
  };
}
