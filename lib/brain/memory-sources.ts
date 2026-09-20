export type AstraMemorySourceKind =
  | "local"
  | "sonor"
  | "graphify"
  | "obsidian"
  | "github"
  | "project_docs";

export type AstraMemoryPrivacy = "private_local" | "project_local" | "external";

export type AstraMemoryRecord = {
  id: string;
  source: string;
  sourceType: AstraMemorySourceKind;
  project?: string;
  timestamp?: string;
  relevance?: number;
  confidence?: number;
  privacy: AstraMemoryPrivacy;
  reference?: string;
  content: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type AstraMemoryQuery = {
  input: string;
  project?: string;
  limit: number;
  maxChars: number;
  signal?: AbortSignal;
};

export type AstraMemorySourceResult = {
  source: string;
  sourceType: AstraMemorySourceKind;
  available: boolean;
  records: AstraMemoryRecord[];
  detail: string;
};

export interface AstraMemorySource {
  id: string;
  kind: AstraMemorySourceKind;
  search(query: AstraMemoryQuery): Promise<AstraMemorySourceResult>;
  status?(): Promise<{
    available: boolean;
    detail: string;
  }>;
}

export function clampUnit(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(1, value));
}

export function normalizeMemoryRecord(record: AstraMemoryRecord): AstraMemoryRecord {
  return {
    ...record,
    relevance: clampUnit(record.relevance),
    confidence: clampUnit(record.confidence),
    content: record.content.trim().slice(0, 8000),
  };
}
