import type {
  AstraToolDefinition,
  AstraToolHandler,
} from "./contracts";

export type AstraCreativeCapability =
  | "design.image.generate"
  | "design.image.edit"
  | "social.publish"
  | "social.schedule";

export type AstraCreativeStatus = {
  configured: boolean;
  available: boolean;
  provider: string;
  detail: string;
  capabilities: AstraCreativeCapability[];
};

export interface AstraCreativeTransport {
  readonly provider: string;
  status(signal?: AbortSignal): Promise<AstraCreativeStatus>;
  call(
    capability: AstraCreativeCapability,
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
    id: "design.image.generate",
    name: "Generate Design Image",
    category: "design",
    description:
      "Generate one visual asset through a configured provider. Provider invocation is an external action and requires scoped approval.",
    permissionLevel: 3,
    sideEffect: "external_write",
    timeoutMs: 120_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "design.image.edit",
    name: "Edit Design Image",
    category: "design",
    description:
      "Edit one supplied visual asset through a configured provider after scoped external-action approval.",
    permissionLevel: 3,
    sideEffect: "external_write",
    timeoutMs: 120_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "social.publish",
    name: "Publish Social Post",
    category: "design",
    description:
      "Publish one prepared social post through an authenticated provider after explicit scoped approval.",
    permissionLevel: 3,
    sideEffect: "external_write",
    timeoutMs: 60_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "social.schedule",
    name: "Schedule Social Post",
    category: "design",
    description:
      "Schedule one prepared social post through an authenticated provider after explicit scoped approval.",
    permissionLevel: 3,
    sideEffect: "external_write",
    timeoutMs: 60_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
];

export const CREATIVE_TOOL_DEFINITIONS: readonly AstraToolDefinition[] =
  CATALOG.map((item) => ({ ...item }));

export async function createCreativeToolRegistrations(
  transport: AstraCreativeTransport,
  signal?: AbortSignal,
): Promise<{
  definitions: AstraToolDefinition[];
  handlers: Record<string, AstraToolHandler>;
  status: AstraCreativeStatus;
}> {
  const status = await transport.status(signal);
  const supported = new Set(
    (status.capabilities ?? []).filter((capability) =>
      CATALOG.some((item) => item.id === capability),
    ),
  );

  const definitions = CATALOG.map((definition) =>
    status.available &&
    supported.has(definition.id as AstraCreativeCapability)
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

    const capability = definition.id as AstraCreativeCapability;
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
            "Creative provider did not verify completion.",
          verified: false,
          output: result.output,
          provider: transport.provider,
        };
      }

      return {
        status: "completed",
        detail:
          result.detail ||
          "Creative provider verified completion.",
        verified: true,
        output: result.output,
        provider: transport.provider,
      };
    };
  }

  return { definitions, handlers, status };
}
