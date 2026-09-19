import type { AgentResponse, AstraAgentKey } from "@/lib/agent/types";

export type AstraBrainProvider =
  | "routing_only"
  | "ollama"
  | "codex"
  | "hermes"
  | "cloud";

export type AstraBrainEventType =
  | "request.received"
  | "router.selected"
  | "memory.loaded"
  | "skill.selected"
  | "policy.applied"
  | "provider.selected"
  | "provider.unavailable"
  | "agent.started"
  | "agent.completed"
  | "agent.blocked"
  | "response.ready";

export type AstraBrainEvent = {
  id: string;
  type: AstraBrainEventType;
  at: number;
  agent?: AstraAgentKey;
  visualNode?: string;
  label: string;
  detail?: string;
};

export type AstraBrainPermissionSnapshot = {
  requireApproval: boolean;
  allowShell: boolean;
  allowFileWrite: boolean;
  allowExternalActions: boolean;
  allowPaidCloud: boolean;
};

export type AstraBrainFeatureStatus = {
  enabled: boolean;
  available: boolean;
  detail: string;
  model?: string;
  endpoint?: string;
};

export type AstraBrainEnvelope = {
  provider: AstraBrainProvider;
  execution: "routing_only" | "executed" | "blocked";
  requestedMode?: "chat" | "execute";
  route: AstraAgentKey[];
  visualNodes: string[];
  events: AstraBrainEvent[];
  context?: {
    memoryEntries: number;
    skills: string[];
  };
  permissions?: AstraBrainPermissionSnapshot;
};

export type AstraBrainChatResult = AgentResponse & {
  brain: AstraBrainEnvelope;
};

export type AstraBrainStatus = {
  ready: boolean;
  provider: AstraBrainProvider;
  mode: "routing_only" | "local" | "cloud";
  detail: string;
  endpoint?: string;
  model?: string;
  fallback?: AstraBrainProvider;
  permissions?: AstraBrainPermissionSnapshot;
  features?: {
    memory: AstraBrainFeatureStatus;
    skills: AstraBrainFeatureStatus;
    codex: AstraBrainFeatureStatus;
    tools: AstraBrainFeatureStatus;
    cloud: AstraBrainFeatureStatus;
  };
};

export interface AstraBrain {
  chat(input: string): Promise<AstraBrainChatResult>;
  execute(task: { input: string; approved?: boolean }): Promise<AstraBrainChatResult>;
  cancel(): Promise<void>;
  status(): Promise<AstraBrainStatus>;
}
