export type NvidiaLearnedSkillCandidate = {
  id: string;
  title: string;
  sourceWorkflowIds: string[];
  maxPermissionLevel: 0 | 1 | 2 | 3;
  state: "disabled";
  createdAt: string;
};

export type NvidiaGuardrailStage =
  | "input"
  | "retrieval"
  | "tool_input"
  | "tool_output"
  | "output";

export type NvidiaGuardrailDecision = {
  stage: NvidiaGuardrailStage;
  decision: "allow" | "block" | "modify";
  detail: string;
  authorizationEffect: "none";
};

export type NvidiaEvaluationSuite =
  | "research"
  | "rag_quality"
  | "rag_performance"
  | "voice"
  | "vision"
  | "safety"
  | "tool_policy";

export type NvidiaEvaluationManifest = {
  commit: string;
  runtimeBuild: string;
  capturedAt: string;
  suites: NvidiaEvaluationSuite[];
  releaseVerdict: "NOT_EVALUATED";
};

function clean(value: string, max: number) {
  return value.replace(/\0/g, "").trim().slice(0, max);
}

export function createNvidiaLearnedSkillCandidate(input: {
  id: string;
  title: string;
  sourceWorkflowIds: string[];
  sourceMaxPermissionLevel: 0 | 1 | 2 | 3;
  requestedMaxPermissionLevel?: 0 | 1 | 2 | 3;
  createdAt?: string;
}): NvidiaLearnedSkillCandidate {
  const id = clean(input.id, 160);
  const title = clean(input.title, 240);
  if (!id || !title) {
    throw new Error("Learned skill id/title are required.");
  }

  const sourceWorkflowIds = [...new Set(
    input.sourceWorkflowIds
      .map((value) => clean(value, 160))
      .filter(Boolean),
  )].slice(0, 20);
  if (sourceWorkflowIds.length === 0) {
    throw new Error("Learned skill requires source workflow provenance.");
  }

  const requested =
    input.requestedMaxPermissionLevel ?? input.sourceMaxPermissionLevel;
  const maxPermissionLevel = Math.min(
    requested,
    input.sourceMaxPermissionLevel,
  ) as 0 | 1 | 2 | 3;

  const createdAt = input.createdAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(createdAt))) {
    throw new Error("Learned skill createdAt is invalid.");
  }

  return {
    id,
    title,
    sourceWorkflowIds,
    maxPermissionLevel,
    state: "disabled",
    createdAt: new Date(Date.parse(createdAt)).toISOString(),
  };
}

export function createNvidiaGuardrailDecision(input: {
  stage: NvidiaGuardrailStage;
  decision: "allow" | "block" | "modify";
  detail: string;
}): NvidiaGuardrailDecision {
  return {
    stage: input.stage,
    decision: input.decision,
    detail: clean(input.detail, 1000),
    authorizationEffect: "none",
  };
}

export function normalizeNvidiaEvaluationManifest(
  input: NvidiaEvaluationManifest,
): NvidiaEvaluationManifest {
  if (!/^[0-9a-f]{40}$/i.test(input.commit)) {
    throw new Error("Evaluation commit must be an exact Git SHA.");
  }
  if (!clean(input.runtimeBuild, 200)) {
    throw new Error("Evaluation runtimeBuild is required.");
  }
  if (!Number.isFinite(Date.parse(input.capturedAt))) {
    throw new Error("Evaluation capturedAt is invalid.");
  }
  const suites = [...new Set(input.suites)];
  if (suites.length === 0) {
    throw new Error("Evaluation requires at least one suite.");
  }
  if (input.releaseVerdict !== "NOT_EVALUATED") {
    throw new Error("NVIDIA evaluation cannot self-select release readiness.");
  }

  return {
    commit: input.commit.toLowerCase(),
    runtimeBuild: clean(input.runtimeBuild, 200),
    capturedAt: new Date(Date.parse(input.capturedAt)).toISOString(),
    suites,
    releaseVerdict: "NOT_EVALUATED",
  };
}
