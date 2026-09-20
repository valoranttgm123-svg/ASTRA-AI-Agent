import type { AstraPermissionLevel } from "@/lib/agent/capabilities";
import type {
  AstraAutomationSchedule,
  AstraAutomationStatus,
} from "./contracts";
import type { AstraAutomationUpsertInput } from "./management";

export type AstraAutomationMutation =
  | {
      action: "upsert";
      definition: AstraAutomationUpsertInput;
    }
  | {
      action: "status";
      id: string;
      status: AstraAutomationStatus;
    }
  | {
      action: "delete";
      id: string;
    };

function object(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(field + " must be an object.");
  }
  return value as Record<string, unknown>;
}

function string(
  value: unknown,
  field: string,
  max: number,
): string {
  if (typeof value !== "string") {
    throw new Error(field + " must be a string.");
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) {
    throw new Error(field + " must contain 1-" + max + " characters.");
  }
  return cleaned;
}

function optionalString(
  value: unknown,
  field: string,
  max: number,
): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return string(value, field, max);
}

function status(value: unknown): AstraAutomationStatus {
  if (value === "enabled" || value === "paused" || value === "disabled") {
    return value;
  }
  throw new Error("status is invalid.");
}

function permission(value: unknown): AstraPermissionLevel {
  if (value === 0 || value === 1 || value === 2 || value === 3) {
    return value;
  }
  throw new Error(
    "requiredPermissionLevel must be 0, 1, 2, or 3. Level 4 cannot be scheduled.",
  );
}

function positiveInteger(value: unknown, field: string) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(field + " must be a positive integer.");
  }
  return value;
}

function schedule(value: unknown): AstraAutomationSchedule {
  const source = object(value, "schedule");
  if (source.kind === "once") {
    return {
      kind: "once",
      runAt: string(source.runAt, "schedule.runAt", 80),
    };
  }
  if (source.kind === "interval") {
    return {
      kind: "interval",
      anchorAt: string(source.anchorAt, "schedule.anchorAt", 80),
      everyMinutes: positiveInteger(
        source.everyMinutes,
        "schedule.everyMinutes",
      ),
    };
  }
  throw new Error("schedule.kind is invalid.");
}

export function parseAutomationMutation(
  body: Record<string, unknown>,
): AstraAutomationMutation {
  if (body.action === "upsert") {
    const source = object(body.definition, "definition");
    return {
      action: "upsert",
      definition: {
        id: string(source.id, "definition.id", 120),
        title: string(source.title, "definition.title", 160),
        goal: string(source.goal, "definition.goal", 4000),
        projectId: optionalString(
          source.projectId,
          "definition.projectId",
          120,
        ),
        status:
          source.status === undefined
            ? undefined
            : status(source.status),
        schedule: schedule(source.schedule),
        requiredPermissionLevel: permission(
          source.requiredPermissionLevel,
        ),
        maxRuntimeMs: positiveInteger(
          source.maxRuntimeMs,
          "definition.maxRuntimeMs",
        ),
      },
    };
  }

  if (body.action === "status") {
    return {
      action: "status",
      id: string(body.id, "id", 120),
      status: status(body.status),
    };
  }

  if (body.action === "delete") {
    return {
      action: "delete",
      id: string(body.id, "id", 120),
    };
  }

  throw new Error("Automation action is invalid.");
}
const AUTOMATION_PROVIDERS = new Set(["auto", "ollama", "codex"]);

export function parseAutomationRunRequest(
  body: Record<string, unknown>,
): import("./approval").AstraAutomationOccurrenceRequest {
  const automationId = string(body.automationId, "automationId", 120);
  const scheduledFor = string(body.scheduledFor, "scheduledFor", 80);

  if (body.approved !== undefined && typeof body.approved !== "boolean") {
    throw new Error("approved must be boolean.");
  }

  let approvalToken: string | undefined;
  if (body.approvalToken !== undefined) {
    approvalToken = string(body.approvalToken, "approvalToken", 160);
    if (approvalToken.length < 8) {
      throw new Error("approvalToken is invalid.");
    }
  }

  const provider =
    body.provider === undefined ? "auto" : String(body.provider);
  if (!AUTOMATION_PROVIDERS.has(provider)) {
    throw new Error("provider is invalid.");
  }

  return {
    automationId,
    scheduledFor,
    approved: body.approved === true,
    ...(approvalToken ? { approvalToken } : {}),
    provider: provider as "auto" | "ollama" | "codex",
  };
}
