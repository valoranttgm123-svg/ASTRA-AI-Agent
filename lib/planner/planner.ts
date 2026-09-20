import type {
  AstraPlan,
  AstraPlanStep,
  AstraPlanStepDraft,
  AstraPlanStepStatus,
  AstraPlannerLimits,
} from "./contracts";

export const DEFAULT_PLANNER_LIMITS: AstraPlannerLimits = {
  maxSteps: 12,
  maxRetriesPerStep: 2,
  maxStepTimeoutMs: 120_000,
};

function clampInt(value: number | undefined, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value as number)));
}

function safeId(value: string | undefined, index: number) {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || "step-" + (index + 1);
}

function uniqueStepId(candidate: string, used: Set<string>) {
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  let suffix = 2;
  while (used.has(candidate + "-" + suffix)) suffix += 1;
  const id = candidate + "-" + suffix;
  used.add(id);
  return id;
}

function normalizeStep(
  draft: AstraPlanStepDraft,
  index: number,
  used: Set<string>,
  previousIds: Set<string>,
  limits: AstraPlannerLimits,
): AstraPlanStep | null {
  const title = draft.title.trim().replace(/\s+/g, " ").slice(0, 300);
  if (!title) return null;

  const id = uniqueStepId(safeId(draft.id, index), used);
  const permissionLevel = clampInt(draft.permissionLevel, 1, 0, 4) as 0 | 1 | 2 | 3 | 4;
  const dependsOn = (draft.dependsOn ?? [])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => previousIds.has(value))
    .slice(0, 12);

  return {
    id,
    title,
    kind: draft.kind,
    agent: draft.agent,
    permissionLevel,
    dependsOn: [...new Set(dependsOn)],
    timeoutMs: clampInt(
      draft.timeoutMs,
      Math.min(30_000, limits.maxStepTimeoutMs),
      1_000,
      limits.maxStepTimeoutMs,
    ),
    maxRetries: clampInt(
      draft.maxRetries,
      0,
      0,
      limits.maxRetriesPerStep,
    ),
    status: "pending",
  };
}

export function createBoundedPlan(
  goal: string,
  drafts: readonly AstraPlanStepDraft[],
  options?: {
    id?: string;
    projectId?: string;
    createdAt?: string;
    limits?: Partial<AstraPlannerLimits>;
  },
): AstraPlan {
  const limits: AstraPlannerLimits = {
    maxSteps: clampInt(
      options?.limits?.maxSteps,
      DEFAULT_PLANNER_LIMITS.maxSteps,
      1,
      DEFAULT_PLANNER_LIMITS.maxSteps,
    ),
    maxRetriesPerStep: clampInt(
      options?.limits?.maxRetriesPerStep,
      DEFAULT_PLANNER_LIMITS.maxRetriesPerStep,
      0,
      DEFAULT_PLANNER_LIMITS.maxRetriesPerStep,
    ),
    maxStepTimeoutMs: clampInt(
      options?.limits?.maxStepTimeoutMs,
      DEFAULT_PLANNER_LIMITS.maxStepTimeoutMs,
      1_000,
      DEFAULT_PLANNER_LIMITS.maxStepTimeoutMs,
    ),
  };

  const cleanGoal = goal.trim().replace(/\s+/g, " ").slice(0, 1000);
  if (!cleanGoal) throw new Error("Plan goal is required.");

  const used = new Set<string>();
  const previousIds = new Set<string>();
  const steps: AstraPlanStep[] = [];

  for (const draft of drafts.slice(0, limits.maxSteps)) {
    const step = normalizeStep(draft, steps.length, used, previousIds, limits);
    if (!step) continue;
    steps.push(step);
    previousIds.add(step.id);
  }

  if (steps.length === 0) throw new Error("Plan requires at least one valid step.");

  const createdAt = options?.createdAt ?? new Date().toISOString();
  const id =
    options?.id?.trim().slice(0, 120) ||
    "plan-" + createdAt.replace(/[^0-9]/g, "").slice(0, 14);

  return {
    id,
    goal: cleanGoal,
    projectId: options?.projectId?.trim().slice(0, 120) || undefined,
    createdAt,
    status: "planned",
    steps,
  };
}

export function runnablePlanSteps(plan: AstraPlan): AstraPlanStep[] {
  const completed = new Set(
    plan.steps.filter((step) => step.status === "completed").map((step) => step.id),
  );
  return plan.steps.filter(
    (step) =>
      step.status === "pending" &&
      step.dependsOn.every((dependency) => completed.has(dependency)),
  );
}

export function updatePlanStepStatus(
  plan: AstraPlan,
  stepId: string,
  status: AstraPlanStepStatus,
): AstraPlan {
  if (!plan.steps.some((step) => step.id === stepId)) {
    throw new Error("Unknown plan step: " + stepId);
  }
  return {
    ...plan,
    steps: plan.steps.map((step) =>
      step.id === stepId ? { ...step, status } : step,
    ),
  };
}
