import type { AstraPermissionLevel } from "@/lib/agent/capabilities";

export type AstraAutomationStatus = "enabled" | "paused" | "disabled";

export type AstraAutomationSchedule =
  | {
      kind: "once";
      runAt: string;
    }
  | {
      kind: "interval";
      anchorAt: string;
      everyMinutes: number;
    };

export type AstraAutomationDefinition = {
  id: string;
  title: string;
  goal: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  status: AstraAutomationStatus;
  schedule: AstraAutomationSchedule;
  requiredPermissionLevel: AstraPermissionLevel;
  maxRuntimeMs: number;
  lastRunAt?: string;
};

export type AstraAutomationDueState =
  | {
      kind: "not_due";
      nextRunAt: string | null;
      detail: string;
    }
  | {
      kind: "due";
      scheduledFor: string;
      nextRunAt: string | null;
      detail: string;
    };

export type AstraAutomationRunDecision =
  | {
      kind: "not_due";
      nextRunAt: string | null;
      detail: string;
    }
  | {
      kind: "waiting_approval";
      scheduledFor: string;
      requiredPermissionLevel: AstraPermissionLevel;
      detail: string;
    }
  | {
      kind: "blocked";
      scheduledFor: string;
      requiredPermissionLevel: AstraPermissionLevel;
      detail: string;
    }
  | {
      kind: "ready";
      scheduledFor: string;
      approvedPermissionLevel: AstraPermissionLevel;
      detail: string;
    };
