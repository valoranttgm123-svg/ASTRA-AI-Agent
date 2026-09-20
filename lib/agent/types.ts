export type AstraOrbState = "idle" | "thinking" | "speaking";

export type AstraProviderChoice = "auto" | "ollama" | "codex";

export type AstraAgentKey =
  | "chief_of_staff"
  | "memory"
  | "researcher"
  | "developer"
  | "computer"
  | "files"
  | "github"
  | "communication"
  | "business"
  | "trading";

export type AstraAgent = {
  key: AstraAgentKey;
  name: string;
  role: string;
  capabilities: string[];
};

export type AstraApprovalRequest = {
  token: string;
  level: 3;
  planId: string;
  stepId: string;
  title: string;
  toolId: string;
  projectId?: string;
  scope: Record<string, string | number | boolean>;
  expiresAt: string;
};

export type AgentRequest = {
  message: string;
  mode?: "chat" | "execute";
  approved?: boolean;
  approvalToken?: string;
  provider?: AstraProviderChoice;
};

export type AgentResponse = {
  ok: boolean;
  agent: AstraAgentKey;
  agentName: string;
  state: "completed" | "needs_provider" | "blocked" | "error";
  message: string;
  requiresApproval?: boolean;
  approvalRequest?: AstraApprovalRequest;
};
