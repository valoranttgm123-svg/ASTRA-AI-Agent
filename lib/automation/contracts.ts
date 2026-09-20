import type {
  AstraInputContext,
  AstraProviderChoice,
} from "@/lib/agent/types";

export type AstraAutomationSchedule =
  | {
      kind: "once";
      at: string;
    }
  | {
      kind: "interval";
      everyMinutes: number;
    };

export type AstraAutomationMode = "chat" | "execute";

export type AstraAutomationRunStatus =
  | "running"
  | "completed"
  | "waiting_approval"
  | "blocked"
  | "error"
  | "cancelled";

export type AstraAutomationLastRun = {
  runId: string;
  startedAt: string;
  finishedAt?: string;
  status: AstraAutomationRunStatus;
  detail: string;
  requiresApproval?: boolean;
  approval?: {
    level: 3;
    planId: string;
    stepId: string;
    title: string;
    toolId: string;
    expiresAt: string;
  };
};

export type AstraAutomationLease = {
  runId: string;
  startedAt: string;
  leaseUntil: string;
};

export type AstraAutomationRecord = {
  id: string;
  title: string;
  prompt: string;
  enabled: boolean;
  mode: AstraAutomationMode;
  provider: AstraProviderChoice;
  schedule: AstraAutomationSchedule;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  activeRun?: AstraAutomationLease;
  lastRun?: AstraAutomationLastRun;
};

export type AstraAutomationDraft = {
  title: string;
  prompt: string;
  enabled?: boolean;
  mode?: AstraAutomationMode;
  provider?: AstraProviderChoice;
  schedule: AstraAutomationSchedule;
};

export type AstraAutomationSystemStatus = {
  enabled: boolean;
  available: boolean;
  workerRunning: boolean;
  source: string;
  automations: number;
  due: number;
  detail: string;
};

export type AstraAutomationRunResult = {
  ok: boolean;
  state: "completed" | "needs_provider" | "blocked" | "error";
  message: string;
  requiresApproval?: boolean;
  approvalRequest?: {
    token: string;
    level: 3;
    planId: string;
    stepId: string;
    title: string;
    toolId: string;
    expiresAt: string;
  };
};

export interface AstraAutomationRunner {
  chat(
    prompt: string,
    options: {
      provider: AstraProviderChoice;
      inputContext: AstraInputContext;
      signal?: AbortSignal;
    },
  ): Promise<AstraAutomationRunResult>;
  execute(
    task: {
      input: string;
      approved: false;
    },
    options: {
      provider: AstraProviderChoice;
      inputContext: AstraInputContext;
      signal?: AbortSignal;
    },
  ): Promise<AstraAutomationRunResult>;
}
