import type {
  AstraToolDefinition,
  AstraToolHandler,
} from "./contracts";

export type AstraIntegrationCapability =
  | "crm.search"
  | "crm.note.add"
  | "calendar.list"
  | "calendar.event.create"
  | "calendar.event.update"
  | "email.search"
  | "email.read"
  | "email.draft.create"
  | "email.send"
  | "drive.search"
  | "drive.read"
  | "drive.upload";

export type AstraIntegrationStatus = {
  configured: boolean;
  available: boolean;
  provider: string;
  detail: string;
  capabilities: AstraIntegrationCapability[];
};

export interface AstraIntegrationTransport {
  readonly provider: string;
  status(signal?: AbortSignal): Promise<AstraIntegrationStatus>;
  call(
    capability: AstraIntegrationCapability,
    input: unknown,
    signal: AbortSignal,
  ): Promise<{
    ok: boolean;
    verified: boolean;
    detail: string;
    output?: unknown;
  }>;
}

const CATALOG: readonly AstraToolDefinition[] = [
  {
    id: "crm.search",
    name: "CRM Search",
    category: "crm",
    description: "Read bounded customer/lead/pipeline context from a configured CRM provider.",
    permissionLevel: 1,
    sideEffect: "read",
    timeoutMs: 30_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "crm.note.add",
    name: "CRM Add Note",
    category: "crm",
    description: "Add one bounded note to a CRM record through an authenticated provider.",
    permissionLevel: 3,
    sideEffect: "external_write",
    timeoutMs: 30_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "calendar.list",
    name: "Calendar List",
    category: "calendar",
    description: "Read bounded calendar events or availability from a configured provider.",
    permissionLevel: 1,
    sideEffect: "read",
    timeoutMs: 30_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "calendar.event.create",
    name: "Calendar Create Event",
    category: "calendar",
    description: "Create one calendar event after scoped external-action approval.",
    permissionLevel: 3,
    sideEffect: "external_write",
    timeoutMs: 30_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "calendar.event.update",
    name: "Calendar Update Event",
    category: "calendar",
    description: "Update one identified calendar event after scoped external-action approval.",
    permissionLevel: 3,
    sideEffect: "external_write",
    timeoutMs: 30_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "email.search",
    name: "Email Search",
    category: "email",
    description: "Search bounded email metadata/content through a configured provider.",
    permissionLevel: 1,
    sideEffect: "read",
    timeoutMs: 30_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "email.read",
    name: "Email Read",
    category: "email",
    description: "Read one identified message/thread through a configured provider.",
    permissionLevel: 1,
    sideEffect: "read",
    timeoutMs: 30_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "email.draft.create",
    name: "Email Create Draft",
    category: "email",
    description: "Create one external-account email draft after scoped approval.",
    permissionLevel: 3,
    sideEffect: "external_write",
    timeoutMs: 30_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "email.send",
    name: "Email Send",
    category: "email",
    description: "Send one email through an authenticated provider after scoped external-action approval.",
    permissionLevel: 3,
    sideEffect: "external_write",
    timeoutMs: 30_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "drive.search",
    name: "Drive Search",
    category: "drive",
    description: "Search bounded cloud-drive metadata through a configured provider.",
    permissionLevel: 1,
    sideEffect: "read",
    timeoutMs: 30_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "drive.read",
    name: "Drive Read",
    category: "drive",
    description: "Read one identified cloud-drive file/document through a configured provider.",
    permissionLevel: 1,
    sideEffect: "read",
    timeoutMs: 45_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "drive.upload",
    name: "Drive Upload",
    category: "drive",
    description: "Upload one bounded artifact through an authenticated provider after scoped external-action approval.",
    permissionLevel: 3,
    sideEffect: "external_write",
    timeoutMs: 60_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
];

export const INTEGRATION_TOOL_DEFINITIONS: readonly AstraToolDefinition[] =
  CATALOG.map((definition) => ({ ...definition }));

function normalizeCapabilities(
  capabilities: readonly AstraIntegrationCapability[],
) {
  return new Set(capabilities.filter((capability) =>
    CATALOG.some((definition) => definition.id === capability),
  ));
}

export async function createIntegrationToolRegistrations(
  transport: AstraIntegrationTransport,
  signal?: AbortSignal,
): Promise<{
  definitions: AstraToolDefinition[];
  handlers: Record<string, AstraToolHandler>;
  status: AstraIntegrationStatus;
}> {
  const status = await transport.status(signal);
  const supported = normalizeCapabilities(status.capabilities ?? []);

  const definitions = CATALOG.map((definition) =>
    status.available && supported.has(definition.id as AstraIntegrationCapability)
      ? {
          ...definition,
          provider: transport.provider,
          availability: "READY" as const,
        }
      : {
          ...definition,
          provider: undefined,
          availability: "NOT_CONFIGURED" as const,
        },
  );

  const handlers: Record<string, AstraToolHandler> = {};
  if (!status.available) {
    return { definitions, handlers, status };
  }

  for (const definition of definitions) {
    if (definition.availability !== "READY") continue;
    const capability = definition.id as AstraIntegrationCapability;

    handlers[definition.id] = async (input, context) => {
      const result = await transport.call(
        capability,
        input,
        context.signal,
      );

      if (!result.ok || !result.verified) {
        return {
          status: "failed",
          detail:
            result.detail ||
            "Integration provider did not verify completion.",
          verified: false,
          output: result.output,
          provider: transport.provider,
        };
      }

      return {
        status: "completed",
        detail: result.detail || "Integration action verified.",
        verified: true,
        output: result.output,
        provider: transport.provider,
      };
    };
  }

  return { definitions, handlers, status };
}
