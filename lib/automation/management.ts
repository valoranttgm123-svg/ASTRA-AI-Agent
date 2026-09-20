import type { AstraPermissionLevel } from "@/lib/agent/capabilities";
import type {
  AstraAutomationDefinition,
  AstraAutomationSchedule,
  AstraAutomationStatus,
} from "./contracts";
import { mutateAutomationStore } from "./store";
import { validateAutomationDefinition } from "./scheduler";

export type AstraAutomationUpsertInput = {
  id: string;
  title: string;
  goal: string;
  projectId?: string;
  status?: AstraAutomationStatus;
  schedule: AstraAutomationSchedule;
  requiredPermissionLevel: AstraPermissionLevel;
  maxRuntimeMs: number;
};

export type AstraAutomationMutationResult = {
  automation?: AstraAutomationDefinition;
  deleted?: boolean;
  count: number;
};

function normalizedId(value: string) {
  const id = value.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(id)) {
    throw new Error(
      "Automation id must use 1-120 letters, numbers, dot, underscore, or dash.",
    );
  }
  return id;
}

export async function upsertAutomationDefinition(
  input: AstraAutomationUpsertInput,
  now = new Date(),
): Promise<AstraAutomationMutationResult> {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid automation mutation time.");
  }

  return mutateAutomationStore((automations) => {
    const id = normalizedId(input.id);
    const index = automations.findIndex(
      (candidate) => candidate.id.toLowerCase() === id.toLowerCase(),
    );
    const existing = index >= 0 ? automations[index] : undefined;

    const automation: AstraAutomationDefinition = {
      id: existing?.id ?? id,
      title: input.title.trim(),
      goal: input.goal.trim(),
      projectId: input.projectId?.trim() || undefined,
      createdAt: existing?.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
      status: input.status ?? existing?.status ?? "paused",
      schedule: input.schedule,
      requiredPermissionLevel: input.requiredPermissionLevel,
      maxRuntimeMs: input.maxRuntimeMs,
      lastRunAt: existing?.lastRunAt,
    };

    validateAutomationDefinition(automation);

    const next = [...automations];
    if (index >= 0) next[index] = automation;
    else next.push(automation);

    return {
      automations: next,
      result: {
        automation,
        count: next.length,
      },
    };
  });
}

export async function setAutomationDefinitionStatus(
  idInput: string,
  status: AstraAutomationStatus,
  now = new Date(),
): Promise<AstraAutomationMutationResult> {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid automation mutation time.");
  }

  return mutateAutomationStore((automations) => {
    const id = normalizedId(idInput);
    const index = automations.findIndex(
      (candidate) => candidate.id.toLowerCase() === id.toLowerCase(),
    );
    if (index < 0) {
      throw new Error("Automation definition was not found.");
    }

    const automation: AstraAutomationDefinition = {
      ...automations[index],
      status,
      updatedAt: now.toISOString(),
    };
    validateAutomationDefinition(automation);

    const next = [...automations];
    next[index] = automation;

    return {
      automations: next,
      result: {
        automation,
        count: next.length,
      },
    };
  });
}

export async function deleteAutomationDefinition(
  idInput: string,
): Promise<AstraAutomationMutationResult> {
  return mutateAutomationStore((automations) => {
    const id = normalizedId(idInput);
    const next = automations.filter(
      (candidate) => candidate.id.toLowerCase() !== id.toLowerCase(),
    );

    if (next.length === automations.length) {
      throw new Error("Automation definition was not found.");
    }

    return {
      automations: next,
      result: {
        deleted: true,
        count: next.length,
      },
    };
  });
}
