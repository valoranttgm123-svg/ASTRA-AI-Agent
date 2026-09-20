export type AstraValidationPlanEvidence = {
  id: string | null;
  status: string | null;
  projectId: string | null;
  stepCount: number;
  maxPermissionLevel: number | null;
  stepKinds: string[];
  toolIds: string[];
  waitingApprovalSteps: number;
};

export type AstraValidationEvidence = {
  ok: boolean | null;
  state: string | null;
  agent: string | null;
  requiresApproval: boolean;
  provider: string | null;
  execution: string | null;
  requestedMode: string | null;
  route: string[];
  visualNodes: string[];
  eventTypes: string[];
  eventCount: number;
  liveEventTypes: string[];
  project: {
    id: string;
    name: string;
    reason: string;
  } | null;
  memoryEntries: number | null;
  memorySources: string[];
  skills: string[];
  permissions: {
    requireApproval: boolean | null;
    allowShell: boolean | null;
    allowFileWrite: boolean | null;
    allowExternalActions: boolean | null;
    allowPaidCloud: boolean | null;
  } | null;
  approval: {
    level: number | null;
    planId: string | null;
    stepId: string | null;
    toolId: string | null;
    projectId: string | null;
    expiresAt: string | null;
  } | null;
  plan: AstraValidationPlanEvidence | null;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function booleanOrNull(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function extractPlan(
  value: unknown,
): AstraValidationPlanEvidence | null {
  if (!isRecord(value)) return null;

  const steps = Array.isArray(value.steps)
    ? value.steps.filter(isRecord)
    : [];

  const permissions = steps
    .map((step) =>
      typeof step.permissionLevel === "number" &&
      Number.isFinite(step.permissionLevel)
        ? step.permissionLevel
        : null,
    )
    .filter((item): item is number => item !== null);

  const kinds = steps
    .map((step) => stringOrNull(step.kind))
    .filter((item): item is string => Boolean(item));

  const tools = steps
    .map((step) => stringOrNull(step.toolId))
    .filter((item): item is string => Boolean(item));

  return {
    id: stringOrNull(value.id),
    status: stringOrNull(value.status),
    projectId: stringOrNull(value.projectId),
    stepCount: steps.length,
    maxPermissionLevel:
      permissions.length > 0
        ? Math.max(...permissions)
        : null,
    stepKinds: [...new Set(kinds)],
    toolIds: [...new Set(tools)],
    waitingApprovalSteps: steps.filter(
      (step) => step.status === "waiting_approval",
    ).length,
  };
}

export function extractValidationEvidence(
  value: unknown,
  liveEventTypes: readonly string[] = [],
): AstraValidationEvidence {
  const root = isRecord(value) ? value : {};
  const brain = isRecord(root.brain) ? root.brain : {};
  const context = isRecord(brain.context) ? brain.context : {};
  const project = isRecord(context.project) ? context.project : null;
  const permissions = isRecord(brain.permissions)
    ? brain.permissions
    : null;
  const approval = isRecord(root.approvalRequest)
    ? root.approvalRequest
    : null;

  const events = Array.isArray(brain.events)
    ? brain.events.filter(isRecord)
    : [];
  const eventTypes = events
    .map((event) => stringOrNull(event.type))
    .filter((item): item is string => Boolean(item));

  return {
    ok: booleanOrNull(root.ok),
    state: stringOrNull(root.state),
    agent: stringOrNull(root.agent),
    requiresApproval: root.requiresApproval === true,
    provider: stringOrNull(brain.provider),
    execution: stringOrNull(brain.execution),
    requestedMode: stringOrNull(brain.requestedMode),
    route: stringArray(brain.route),
    visualNodes: stringArray(brain.visualNodes),
    eventTypes,
    eventCount: events.length,
    liveEventTypes: [...liveEventTypes],
    project:
      project &&
      typeof project.id === "string" &&
      typeof project.name === "string" &&
      typeof project.reason === "string"
        ? {
            id: project.id,
            name: project.name,
            reason: project.reason,
          }
        : null,
    memoryEntries:
      typeof context.memoryEntries === "number" &&
      Number.isFinite(context.memoryEntries)
        ? context.memoryEntries
        : null,
    memorySources: stringArray(context.memorySources),
    skills: stringArray(context.skills),
    permissions: permissions
      ? {
          requireApproval: booleanOrNull(permissions.requireApproval),
          allowShell: booleanOrNull(permissions.allowShell),
          allowFileWrite: booleanOrNull(permissions.allowFileWrite),
          allowExternalActions: booleanOrNull(
            permissions.allowExternalActions,
          ),
          allowPaidCloud: booleanOrNull(permissions.allowPaidCloud),
        }
      : null,
    approval: approval
      ? {
          level:
            typeof approval.level === "number" &&
            Number.isFinite(approval.level)
              ? approval.level
              : null,
          planId: stringOrNull(approval.planId),
          stepId: stringOrNull(approval.stepId),
          toolId: stringOrNull(approval.toolId),
          projectId: stringOrNull(approval.projectId),
          expiresAt: stringOrNull(approval.expiresAt),
        }
      : null,
    plan: extractPlan(brain.plan),
  };
}
