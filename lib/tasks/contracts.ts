import type { AstraPermissionLevel } from "@/lib/agent/capabilities";
import type { AstraAgentKey } from "@/lib/agent/types";

export type AstraBackgroundTaskStatus =
  | "queued"
  | "running"
  | "paused"
  | "retry_wait"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AstraTaskCheckpoint = {
  sequence: number;
  summary: string;
  updatedAt: string;
};

export type AstraBackgroundTask = {
  id: string;
  title: string;
  goal: string;
  agent: AstraAgentKey;
  projectId?: string;
  priority: number;
  requiredPermissionLevel: AstraPermissionLevel;
  maxRuntimeMs: number;
  maxAttempts: number;
  retryBackoffMs: number;
  dependencies: string[];
  resourceLocks: string[];
  status: AstraBackgroundTaskStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt?: string;
  checkpoint?: AstraTaskCheckpoint;
  lastError?: string;
  resultSummary?: string;
};

export type AstraTaskStore = {
  schemaVersion: 1;
  tasks: AstraBackgroundTask[];
};

export type AstraTaskQueueItem = {
  taskId: string;
  priority: number;
  requiredPermissionLevel: AstraPermissionLevel;
  resourceLocks: string[];
  detail: string;
};

export type AstraTaskTickPlan = {
  ready: AstraTaskQueueItem[];
  waitingApproval: AstraTaskQueueItem[];
  waitingDependency: AstraTaskQueueItem[];
  blockedDependency: AstraTaskQueueItem[];
  deferredCapacity: AstraTaskQueueItem[];
};

export type AstraTaskLifecycleEvent = {
  type:
    | "task.claimed"
    | "task.started"
    | "task.checkpoint"
    | "task.succeeded"
    | "task.retry_wait"
    | "task.failed"
    | "task.paused"
    | "task.cancelled"
    | "task.waiting_approval";
  taskId: string;
  at: string;
  detail: string;
};
