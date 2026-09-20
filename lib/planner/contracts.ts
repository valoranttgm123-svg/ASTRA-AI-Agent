import type { AstraAgentKey } from "@/lib/agent/types";
import type { AstraPermissionLevel } from "@/lib/agent/capabilities";

export type AstraPlanStatus =
  | "planned"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type AstraPlanStepStatus =
  | "pending"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type AstraPlanStepKind =
  | "inspect"
  | "memory"
  | "research"
  | "reason"
  | "tool"
  | "verify"
  | "approval";

export type AstraPlanStepDraft = {
  id?: string;
  title: string;
  kind: AstraPlanStepKind;
  agent?: AstraAgentKey;
  permissionLevel?: AstraPermissionLevel;
  dependsOn?: string[];
  timeoutMs?: number;
  maxRetries?: number;
};

export type AstraPlanStep = {
  id: string;
  title: string;
  kind: AstraPlanStepKind;
  agent?: AstraAgentKey;
  permissionLevel: AstraPermissionLevel;
  dependsOn: string[];
  timeoutMs: number;
  maxRetries: number;
  status: AstraPlanStepStatus;
};

export type AstraPlan = {
  id: string;
  goal: string;
  projectId?: string;
  createdAt: string;
  status: AstraPlanStatus;
  steps: AstraPlanStep[];
};

export type AstraPlannerLimits = {
  maxSteps: number;
  maxRetriesPerStep: number;
  maxStepTimeoutMs: number;
};
