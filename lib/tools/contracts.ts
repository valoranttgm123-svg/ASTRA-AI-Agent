import type { AstraPermissionLevel } from "@/lib/agent/capabilities";

export type AstraToolCategory =
  | "filesystem"
  | "shell"
  | "github"
  | "research"
  | "browser"
  | "computer"
  | "email"
  | "calendar"
  | "drive"
  | "crm"
  | "analytics"
  | "database"
  | "design"
  | "mcp";

export type AstraToolAvailability =
  | "READY"
  | "OFFLINE"
  | "NOT_CONFIGURED"
  | "ERROR";

export type AstraToolSideEffect =
  | "read"
  | "local_write"
  | "external_write"
  | "high_impact";

export type AstraToolDefinition = {
  id: string;
  name: string;
  category: AstraToolCategory;
  description: string;
  permissionLevel: AstraPermissionLevel;
  sideEffect: AstraToolSideEffect;
  timeoutMs: number;
  supportsCancellation: boolean;
  provider?: string;
  availability: AstraToolAvailability;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
};

export type AstraToolRegistry = {
  list(): readonly AstraToolDefinition[];
  get(id: string): AstraToolDefinition | undefined;
  has(id: string): boolean;
};


export type AstraToolExecutionPolicy = {
  allowShell: boolean;
  allowFileWrite: boolean;
  allowExternalActions: boolean;
};

export type AstraToolExecutionStatus =
  | "completed"
  | "blocked"
  | "failed";

export type AstraToolExecutionResult = {
  status: AstraToolExecutionStatus;
  detail: string;
  verified: boolean;
  output?: unknown;
  provider?: string;
};

export type AstraToolHandler = (
  input: unknown,
  context: {
    definition: AstraToolDefinition;
    signal: AbortSignal;
  },
) => Promise<AstraToolExecutionResult>;

export type AstraToolLifecycleEventType =
  | "tool.started"
  | "tool.completed"
  | "tool.failed";

export type AstraToolLifecycleEvent = {
  type: AstraToolLifecycleEventType;
  toolId: string;
  toolName: string;
  category: AstraToolCategory;
  provider?: string;
  detail: string;
};

export type AstraExecutableToolRegistry = AstraToolRegistry & {
  execute(
    id: string,
    input: unknown,
    options: {
      approvedPermissionLevel: AstraPermissionLevel;
      policy: AstraToolExecutionPolicy;
      signal?: AbortSignal;
      onEvent?: (event: AstraToolLifecycleEvent) => void;
    },
  ): Promise<AstraToolExecutionResult>;
};
