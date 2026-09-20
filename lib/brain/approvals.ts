import { createHash, randomUUID } from "node:crypto";
import type { AstraApprovalRequest } from "@/lib/agent/types";
import type { AstraPlan, AstraPlanStep } from "@/lib/planner/contracts";

const APPROVAL_TTL_MS = 5 * 60_000;
const MAX_PENDING_APPROVALS = 64;

type StoredApproval = {
  inputHash: string;
  plan: AstraPlan;
  request: AstraApprovalRequest;
};

const pending = new Map<string, StoredApproval>();

function hashInput(input: string) {
  return createHash("sha256")
    .update(input.trim(), "utf8")
    .digest("hex");
}

function clonePlan(plan: AstraPlan): AstraPlan {
  return JSON.parse(JSON.stringify(plan)) as AstraPlan;
}

function prune(now = Date.now()) {
  for (const [token, stored] of pending) {
    if (Date.parse(stored.request.expiresAt) <= now) {
      pending.delete(token);
    }
  }

  if (pending.size <= MAX_PENDING_APPROVALS) return;
  const oldest = [...pending.entries()]
    .sort(
      (a, b) =>
        Date.parse(a[1].request.expiresAt) -
        Date.parse(b[1].request.expiresAt),
    )
    .slice(0, pending.size - MAX_PENDING_APPROVALS);

  for (const [token] of oldest) pending.delete(token);
}

function safeScope(
  step: AstraPlanStep,
): Record<string, string | number | boolean> {
  const allowed = new Set([
    "projectId",
    "branch",
    "remote",
    "base",
    "head",
    "title",
    "path",
    "script",
    "limit",
  ]);
  const scope: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(step.toolInput ?? {})) {
    if (!allowed.has(key)) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      scope[key] =
        typeof value === "string" ? value.slice(0, 240) : value;
    }
  }

  return scope;
}

export function createLevel3Approval({
  input,
  plan,
  step,
}: {
  input: string;
  plan: AstraPlan;
  step: AstraPlanStep;
}): AstraApprovalRequest {
  if (step.permissionLevel !== 3) {
    throw new Error("Scoped Level-3 approval requires a Level-3 plan step.");
  }
  if (!step.toolId) {
    throw new Error("Scoped Level-3 approval requires a registered tool id.");
  }

  prune();

  const token = randomUUID();
  const request: AstraApprovalRequest = {
    token,
    level: 3,
    planId: plan.id,
    stepId: step.id,
    title: step.title,
    toolId: step.toolId,
    projectId: plan.projectId,
    scope: safeScope(step),
    expiresAt: new Date(Date.now() + APPROVAL_TTL_MS).toISOString(),
  };

  pending.set(token, {
    inputHash: hashInput(input),
    plan: clonePlan(plan),
    request,
  });

  return request;
}

export function consumeLevel3Approval({
  token,
  input,
}: {
  token: string;
  input: string;
}): {
  plan: AstraPlan;
  request: AstraApprovalRequest;
  level: 3;
} | null {
  prune();

  const cleanToken = token.trim();
  if (!cleanToken) return null;

  const stored = pending.get(cleanToken);
  if (!stored) return null;

  // Single-use even when validation fails.
  pending.delete(cleanToken);

  if (stored.inputHash !== hashInput(input)) return null;
  if (Date.parse(stored.request.expiresAt) <= Date.now()) return null;

  return {
    plan: clonePlan(stored.plan),
    request: stored.request,
    level: 3,
  };
}
