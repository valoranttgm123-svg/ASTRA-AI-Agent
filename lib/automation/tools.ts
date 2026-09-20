import type {
  AstraToolDefinition,
  AstraToolHandler,
} from "@/lib/tools/contracts";
import {
  automationEnabled,
  createAutomation,
  listAutomations,
  setAutomationEnabled,
} from "./store";

const PROVIDER = "astra-local-automation";

export const AUTOMATION_TOOL_DEFINITIONS: readonly AstraToolDefinition[] = [
  {
    id: "automation.list",
    name: "Automation List",
    category: "automation",
    description:
      "List bounded local ASTRA automation definitions and last-run status.",
    permissionLevel: 1,
    sideEffect: "read",
    timeoutMs: 10_000,
    supportsCancellation: true,
    provider: PROVIDER,
    availability: "READY",
  },
  {
    id: "automation.create",
    name: "Automation Create",
    category: "automation",
    description:
      "Create one bounded local one-time or interval ASTRA automation. Scheduling does not grant execution approval.",
    permissionLevel: 2,
    sideEffect: "local_write",
    timeoutMs: 10_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "automation.enable",
    name: "Automation Enable",
    category: "automation",
    description:
      "Enable one existing local ASTRA automation definition.",
    permissionLevel: 2,
    sideEffect: "local_write",
    timeoutMs: 10_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "automation.disable",
    name: "Automation Disable",
    category: "automation",
    description:
      "Disable one existing local ASTRA automation definition without deleting it.",
    permissionLevel: 2,
    sideEffect: "local_write",
    timeoutMs: 10_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
];

function objectInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Automation tool input must be an object.");
  }
  return value as Record<string, unknown>;
}

function automationId(value: unknown) {
  const record = objectInput(value);
  if (typeof record.id !== "string" || !record.id.trim()) {
    throw new Error("Automation id is required.");
  }
  return record.id.trim().slice(0, 120);
}

function publicRecord(record: Awaited<ReturnType<typeof listAutomations>>[number]) {
  return {
    id: record.id,
    title: record.title,
    promptPreview: record.prompt.slice(0, 240),
    enabled: record.enabled,
    mode: record.mode,
    provider: record.provider,
    schedule: record.schedule,
    nextRunAt: record.nextRunAt,
    lastRun: record.lastRun,
  };
}

export async function createAutomationToolRegistrations(): Promise<{
  definitions: AstraToolDefinition[];
  handlers: Record<string, AstraToolHandler>;
}> {
  const enabled = automationEnabled();
  const definitions = AUTOMATION_TOOL_DEFINITIONS.map((definition) =>
    definition.id === "automation.list"
      ? { ...definition }
      : enabled
        ? {
            ...definition,
            provider: PROVIDER,
            availability: "READY" as const,
          }
        : { ...definition },
  );

  const handlers: Record<string, AstraToolHandler> = {
    "automation.list": async (_input, context) => {
      context.signal.throwIfAborted();
      const records = await listAutomations();
      return {
        status: "completed",
        detail:
          "Read " +
          records.length +
          " local automation definition" +
          (records.length === 1 ? "." : "s."),
        verified: true,
        output: records.map(publicRecord),
        provider: PROVIDER,
      };
    },
  };

  if (!enabled) return { definitions, handlers };

  handlers["automation.create"] = async (input, context) => {
    context.signal.throwIfAborted();
    const record = objectInput(input);
    const draft =
      record.automation &&
      typeof record.automation === "object" &&
      !Array.isArray(record.automation)
        ? record.automation
        : record;
    const created = await createAutomation(draft);
    context.signal.throwIfAborted();
    const verified = (await listAutomations()).find(
      (item) => item.id === created.id,
    );
    if (!verified) {
      return {
        status: "failed",
        detail: "Automation write could not be verified by read-back.",
        verified: false,
        provider: PROVIDER,
      };
    }
    return {
      status: "completed",
      detail:
        "Created local automation " +
        verified.id +
        ". Scheduling does not grant execution approval.",
      verified: true,
      output: publicRecord(verified),
      provider: PROVIDER,
    };
  };

  for (const [id, value] of [
    ["automation.enable", true],
    ["automation.disable", false],
  ] as const) {
    handlers[id] = async (input, context) => {
      context.signal.throwIfAborted();
      const target = automationId(input);
      await setAutomationEnabled(target, value);
      context.signal.throwIfAborted();
      const verified = (await listAutomations()).find(
        (item) => item.id === target,
      );
      if (!verified || verified.enabled !== value) {
        return {
          status: "failed",
          detail: "Automation state change could not be verified.",
          verified: false,
          provider: PROVIDER,
        };
      }
      return {
        status: "completed",
        detail:
          (value ? "Enabled " : "Disabled ") +
          "local automation " +
          target +
          ".",
        verified: true,
        output: publicRecord(verified),
        provider: PROVIDER,
      };
    };
  }

  return { definitions, handlers };
}
