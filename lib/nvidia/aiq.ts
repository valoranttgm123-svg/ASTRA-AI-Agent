export const NVIDIA_AIQ_MAX_WORKERS = 6;
export const NVIDIA_AIQ_MAX_SOURCES = 20;
export const NVIDIA_AIQ_DEFAULT_TIMEOUT_MS = 90_000;

export type NvidiaAiqDepth = "shallow" | "deep";

export type NvidiaAiqStatus = {
  configured: boolean;
  available: boolean;
  provider: string;
  detail: string;
};

export type NvidiaAiqResearchRequest = {
  query: string;
  depth: NvidiaAiqDepth;
  maxWorkers: number;
  maxSources: number;
};

export type NvidiaAiqSource = {
  sourceId: string;
  title: string;
  url: string;
  snippet?: string;
  publishedAt?: string;
  untrusted: true;
  provenance: {
    provider: string;
    reference: string;
  };
};

export type NvidiaAiqResearchResult = {
  ok: boolean;
  provider: string;
  detail: string;
  summary: string;
  sources: NvidiaAiqSource[];
  artifacts?: Array<{
    id: string;
    kind: string;
    reference?: string;
  }>;
};

export interface NvidiaAiqResearchProvider {
  readonly provider: string;
  status(input: { signal: AbortSignal }): Promise<NvidiaAiqStatus>;
  research(
    input: NvidiaAiqResearchRequest & { signal: AbortSignal },
  ): Promise<NvidiaAiqResearchResult>;
}

export type NvidiaAiqFallback = (
  input: NvidiaAiqResearchRequest & { signal: AbortSignal },
) => Promise<NvidiaAiqResearchResult>;

function cleanText(value: string, max: number) {
  return value.replace(/\0/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function safePublicUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      !url.hostname
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeNvidiaAiqRequest(input: {
  query: string;
  depth?: NvidiaAiqDepth;
  maxWorkers?: number;
  maxSources?: number;
}): NvidiaAiqResearchRequest {
  const query = cleanText(input.query ?? "", 2000);
  if (!query) {
    throw new Error("AI-Q research query is required.");
  }

  const maxWorkers = Number.isFinite(input.maxWorkers)
    ? Math.max(
        1,
        Math.min(NVIDIA_AIQ_MAX_WORKERS, Math.floor(input.maxWorkers!)),
      )
    : input.depth === "deep"
      ? 4
      : 2;

  const maxSources = Number.isFinite(input.maxSources)
    ? Math.max(
        1,
        Math.min(NVIDIA_AIQ_MAX_SOURCES, Math.floor(input.maxSources!)),
      )
    : input.depth === "deep"
      ? 12
      : 6;

  return {
    query,
    depth: input.depth === "deep" ? "deep" : "shallow",
    maxWorkers,
    maxSources,
  };
}

export function normalizeNvidiaAiqResult(
  result: NvidiaAiqResearchResult,
): NvidiaAiqResearchResult {
  const provider = cleanText(result.provider, 120);
  if (!provider) throw new Error("AI-Q result provider is required.");

  const sources: NvidiaAiqSource[] = [];
  for (const item of result.sources.slice(0, NVIDIA_AIQ_MAX_SOURCES)) {
    const url = safePublicUrl(item.url);
    const title = cleanText(item.title, 300);
    if (!url || !title) continue;

    sources.push({
      sourceId:
        cleanText(item.sourceId, 80) || "S" + String(sources.length + 1),
      title,
      url,
      snippet: item.snippet
        ? cleanText(item.snippet, 1500)
        : undefined,
      publishedAt: item.publishedAt
        ? cleanText(item.publishedAt, 120)
        : undefined,
      untrusted: true,
      provenance: {
        provider: cleanText(
          item.provenance?.provider || provider,
          120,
        ),
        reference:
          safePublicUrl(item.provenance?.reference || url) || url,
      },
    });
  }

  return {
    ok: result.ok === true,
    provider,
    detail: cleanText(result.detail, 1000),
    summary: result.ok ? result.summary.slice(0, 30_000).trim() : "",
    sources,
    artifacts: Array.isArray(result.artifacts)
      ? result.artifacts.slice(0, 20).map((artifact) => ({
          id: cleanText(artifact.id, 120),
          kind: cleanText(artifact.kind, 120),
          reference: artifact.reference
            ? cleanText(artifact.reference, 500)
            : undefined,
        }))
      : undefined,
  };
}

async function withTimeout<T>({
  timeoutMs,
  signal,
  run,
}: {
  timeoutMs: number;
  signal?: AbortSignal;
  run: (signal: AbortSignal) => Promise<T>;
}) {
  const controller = new AbortController();
  const relay = () => controller.abort(signal?.reason);
  if (signal?.aborted) relay();
  else signal?.addEventListener("abort", relay, { once: true });

  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException("AI-Q research timed out.", "TimeoutError"),
      ),
    Math.max(1000, Math.min(300_000, Math.floor(timeoutMs))),
  );

  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", relay);
  }
}

export async function runNvidiaAiqResearch({
  provider,
  request,
  fallback,
  timeoutMs = NVIDIA_AIQ_DEFAULT_TIMEOUT_MS,
  signal,
}: {
  provider: NvidiaAiqResearchProvider;
  request: NvidiaAiqResearchRequest;
  fallback?: NvidiaAiqFallback;
  timeoutMs?: number;
  signal?: AbortSignal;
}) {
  return withTimeout({
    timeoutMs,
    signal,
    run: async (requestSignal) => {
      const status = await provider.status({ signal: requestSignal });
      requestSignal.throwIfAborted();

      if (!status.configured || !status.available) {
        if (!fallback) {
          return {
            usedFallback: false,
            result: normalizeNvidiaAiqResult({
              ok: false,
              provider: provider.provider,
              detail: status.detail,
              summary: "",
              sources: [],
            }),
          };
        }

        return {
          usedFallback: true,
          result: normalizeNvidiaAiqResult(
            await fallback({ ...request, signal: requestSignal }),
          ),
        };
      }

      return {
        usedFallback: false,
        result: normalizeNvidiaAiqResult(
          await provider.research({
            ...request,
            signal: requestSignal,
          }),
        ),
      };
    },
  });
}
