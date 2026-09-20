export type AstraOrbState = "idle" | "thinking" | "speaking";

export type AstraProviderChoice = "auto" | "ollama" | "codex";

export type AstraAgentKey =
  | "chief_of_staff"
  | "memory"
  | "strategist"
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
  mode?: "chat" | "execute";
  approved?: boolean;
  provider?: AstraProviderChoice;
};

export type AgentResponse = {
  ok: boolean;
  agent: AstraAgentKey;
  agentName: string;
  state: "completed" | "needs_provider" | "blocked" | "error";
  message: string;
  requiresApproval?: boolean;
};
