export type AstraMemorySourceType =
  | "local"
  | "project"
  | "graphify"
  | "obsidian"
  | "github"
  | "sonor";

export type AstraMemoryPrivacy =
  | "private_local"
  | "project_local"
  | "shareable";

export type AstraMemoryProvenance = {
  source: string;
  sourceType: AstraMemorySourceType;
  project?: string;
  timestamp?: string;
  privacy: AstraMemoryPrivacy;
  reference: string;
};

export type AstraMemoryRecord = {
  id: string;
  content: string;
  tags?: string[];
  relevance: number;
  confidence: number;
  provenance: AstraMemoryProvenance;
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
  sourceType: AstraMemorySourceType;
  available: boolean;
  detail: string;
  records: AstraMemoryRecord[];
};


export type AstraMemoryLifecycleEvent =
  | {
      type: "search.started";
      sourceCount: number;
      project?: string;
    }
  | {
      type: "source.queried";
      source: string;
      sourceType: AstraMemorySourceType;
      available: boolean;
      recordCount: number;
      detail: string;
    }
  | {
      type: "graph.matched";
      source: string;
      recordCount: number;
    }
  | {
      type: "context.selected";
      recordCount: number;
      sourceTypes: AstraMemorySourceType[];
    }
  | {
      type: "search.completed";
      selectedCount: number;
      availableSources: number;
      unavailableSources: number;
    };

export type AstraMemoryLifecycleListener = (
  event: AstraMemoryLifecycleEvent,
) => void;

export interface AstraMemorySource {
  readonly id: string;
  readonly type: AstraMemorySourceType;
  search(query: AstraMemoryQuery): Promise<AstraMemorySourceResult>;
}

export function clampMemoryScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
