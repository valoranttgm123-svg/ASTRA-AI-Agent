export const NVIDIA_DOCUMENT_MAX_FILE_BYTES = 64 * 1024 * 1024;
export const NVIDIA_DOCUMENT_MAX_PAGES = 250;
export const NVIDIA_DOCUMENT_MAX_BLOCKS = 5000;

export type NvidiaDocumentExtractionRequest = {
  sourceId: string;
  mimeType: string;
  sizeBytes: number;
  pageLimit: number;
  immutableOriginal: true;
};

export type NvidiaDocumentBlock = {
  id: string;
  page: number;
  kind: "text" | "table" | "layout" | "ocr";
  text: string;
  reference: string;
};

export type NvidiaDocumentExtractionResult = {
  ok: boolean;
  provider: string;
  detail: string;
  sourceId: string;
  blocks: NvidiaDocumentBlock[];
};

export interface NvidiaDocumentIntelligenceProvider {
  readonly provider: string;
  status(input: {
    signal: AbortSignal;
  }): Promise<{
    configured: boolean;
    available: boolean;
    detail: string;
  }>;
  extract(
    input: NvidiaDocumentExtractionRequest & {
      content: Uint8Array;
      signal: AbortSignal;
    },
  ): Promise<NvidiaDocumentExtractionResult>;
}

function clean(value: string, max: number) {
  return value.replace(/\0/g, "").trim().slice(0, max);
}

export function normalizeNvidiaDocumentRequest(input: {
  sourceId: string;
  mimeType: string;
  sizeBytes: number;
  pageLimit?: number;
}): NvidiaDocumentExtractionRequest {
  const sourceId = clean(input.sourceId ?? "", 240);
  const mimeType = clean(input.mimeType ?? "", 120).toLowerCase();
  if (!sourceId) throw new Error("Document sourceId is required.");
  if (!mimeType) throw new Error("Document mimeType is required.");
  if (
    !Number.isInteger(input.sizeBytes) ||
    input.sizeBytes <= 0 ||
    input.sizeBytes > NVIDIA_DOCUMENT_MAX_FILE_BYTES
  ) {
    throw new Error("Document size is outside the ASTRA bound.");
  }

  return {
    sourceId,
    mimeType,
    sizeBytes: input.sizeBytes,
    pageLimit: Number.isFinite(input.pageLimit)
      ? Math.max(
          1,
          Math.min(NVIDIA_DOCUMENT_MAX_PAGES, Math.floor(input.pageLimit!)),
        )
      : 50,
    immutableOriginal: true,
  };
}

export function normalizeNvidiaDocumentResult(
  result: NvidiaDocumentExtractionResult,
  request: NvidiaDocumentExtractionRequest,
) {
  if (result.sourceId !== request.sourceId) {
    throw new Error("Document extraction sourceId mismatch.");
  }

  return {
    ok: result.ok === true,
    provider: clean(result.provider, 120),
    detail: clean(result.detail, 1000),
    sourceId: request.sourceId,
    blocks: result.blocks
      .filter(
        (block) =>
          Number.isInteger(block.page) &&
          block.page >= 1 &&
          block.page <= request.pageLimit,
      )
      .slice(0, NVIDIA_DOCUMENT_MAX_BLOCKS)
      .map((block) => ({
        id: clean(block.id, 160),
        page: block.page,
        kind:
          block.kind === "table" ||
          block.kind === "layout" ||
          block.kind === "ocr"
            ? block.kind
            : ("text" as const),
        text: clean(block.text, 12_000),
        reference: clean(block.reference, 500),
      }))
      .filter((block) => block.id && block.text && block.reference),
  };
}
