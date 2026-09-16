export type AstraOrbState = "idle" | "thinking" | "speaking";

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

export type AgentRequest = {
  message: string;
};

export type AgentResponse = {
  ok: boolean;
  agent: AstraAgentKey;
  agentName: string;
  state: "completed" | "needs_provider" | "error";
  message: string;
  requiresApproval?: boolean;
};
