import type {
  AgentResponse,
  AstraAgentKey,
  AstraProviderChoice,
} from "@/lib/agent/types";
import type { AstraMemorySourceType } from "@/lib/memory/contracts";
import type { AstraPlan } from "@/lib/planner/contracts";

export type AstraBrainProvider =
  | "routing_only"
  | "ollama"
  | "codex"
  | "hermes"
  | "cloud";

export type AstraBrainEventType =
  | "request.received"
  | "router.selected"
  | "project.selected"
  | "plan.created"
  | "plan.step.started"
  | "plan.step.progress"
  | "plan.step.completed"
  | "plan.step.failed"
  | "plan.completed"
  | "plan.cancelled"
  | "tool.started"
  | "tool.progress"
  | "tool.completed"
  | "tool.failed"
  | "memory.loaded"
  | "memory.search.started"
  | "memory.source.queried"
  | "memory.graph.matched"
  | "memory.context.selected"
  | "memory.search.completed"
  | "memory.write.requested"
  | "memory.write.completed"
  | "memory.write.denied"
  | "skill.selected"
  | "policy.applied"
  | "approval.requested"
  | "approval.granted"
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
  provider?: AstraBrainProvider;
  label: string;
  detail?: string;
};

export type AstraBrainRunOptions = {
  onEvent?: (event: AstraBrainEvent) => void;
  provider?: AstraProviderChoice;
  signal?: AbortSignal;
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
  state?: "READY" | "OFFLINE" | "NOT_CONFIGURED" | "ERROR";
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
  plan?: AstraPlan;
  context?: {
    memoryEntries: number;
    memorySources?: AstraMemorySourceType[];
    project?: {
      id: string;
      name: string;
      reason: "id" | "name" | "alias" | "recent";
    };
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
    research: AstraBrainFeatureStatus;
    business: AstraBrainFeatureStatus;
    integrations: AstraBrainFeatureStatus;
    creative: AstraBrainFeatureStatus;
    computer: AstraBrainFeatureStatus;
    tools: AstraBrainFeatureStatus;
    cloud: AstraBrainFeatureStatus;
  };
};

export interface AstraBrain {
  chat(input: string, options?: AstraBrainRunOptions): Promise<AstraBrainChatResult>;
  execute(
    task: { input: string; approved?: boolean; approvalToken?: string },
    options?: AstraBrainRunOptions,
  ): Promise<AstraBrainChatResult>;
  cancel(): Promise<void>;
  status(): Promise<AstraBrainStatus>;
}
