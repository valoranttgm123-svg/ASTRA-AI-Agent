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

export type AstraBrainEnvelope = {
  provider: AstraBrainProvider;
  execution: "routing_only" | "executed";
  route: AstraAgentKey[];
  visualNodes: string[];
  events: AstraBrainEvent[];
};

export type AstraBrainChatResult = AgentResponse & {
  brain: AstraBrainEnvelope;
};

export type AstraBrainStatus = {
  ready: boolean;
  provider: AstraBrainProvider;
  mode: "routing_only" | "local" | "cloud";
  detail: string;
};

export interface AstraBrain {
  chat(input: string): Promise<AstraBrainChatResult>;
  execute(task: { input: string }): Promise<AstraBrainChatResult>;
  cancel(): Promise<void>;
  status(): Promise<AstraBrainStatus>;
}
