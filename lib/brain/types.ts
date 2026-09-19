import type { AgentResponse, AstraAgentKey } from "@/lib/agent/types";

export type AstraBrainProvider =
  | "routing_only"
  | "ollama"
  | "codex"
  | "hermes"
  | "cloud" | "tools";

export type ProviderChoice = "auto" | "ollama" | "hermes" | "codex";
export type ToolCall = { name: string; arguments: Record<string, unknown> };
export type BrainRequest = {
  message: string; projectId: string; provider: ProviderChoice; model?: string;
  codexMode?: "read-only" | "workspace-write"; tool?: ToolCall; approvalId?: string;
};
export type BrainOptions = { signal?: AbortSignal; requestId?: string; emit?: (event: AstraBrainEvent) => void };
export type Approval = { id: string; label: string; detail: string; expiresAt: number };
export type ProviderHealth = { provider: ProviderChoice; available: boolean; detail: string; model?: string; models?: string[] };
export type ToolInfo = { name: string; description: string; requiresApproval: boolean; inputSchema: Record<string, unknown> };

export type AstraBrainEventType =
  | "request.received"
  | "router.selected"
  | "provider.selected"
  | "provider.unavailable"
  | "agent.started"
  | "agent.completed"
  | "agent.blocked"
  | "response.ready" | "agent.error" | "memory.retrieved" | "memory.saved"
  | "tool.started" | "tool.completed" | "tool.error" | "approval.required"
  | "approval.granted" | "request.cancelled";

export type AstraBrainEvent = {
  id: string;
  requestId: string;
  tool?: string;
  type: AstraBrainEventType;
  at: number;
  agent?: AstraAgentKey;
  visualNode?: string;
  label: string;
  detail?: string;
};

export type AstraBrainEnvelope = {
  requestId: string;
  model?: string;
  sources?: string[];
  approval?: Approval;
  provider: AstraBrainProvider;
  execution: "routing_only" | "executed" | "blocked";
  route: AstraAgentKey[];
  visualNodes: string[];
  events: AstraBrainEvent[];
};

export type AstraBrainChatResult = AgentResponse & {
  brain: AstraBrainEnvelope;
};

export type AstraBrainStatus = {
  providers: ProviderHealth[];
  projects: Array<{ id: string; name: string }>;
  tools: ToolInfo[];
  codexWriteEnabled: boolean;
  ready: boolean;
  provider: AstraBrainProvider;
  mode: "routing_only" | "local" | "cloud";
  detail: string;
  endpoint?: string;
  model?: string;
  fallback?: AstraBrainProvider;
};

export interface AstraBrain {
  chat(request: BrainRequest, options?: BrainOptions): Promise<AstraBrainChatResult>;
  execute(request: BrainRequest, options?: BrainOptions): Promise<AstraBrainChatResult>;
  status(): Promise<AstraBrainStatus>;
}
