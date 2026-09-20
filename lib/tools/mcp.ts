import type {
  AstraToolDefinition,
  AstraToolHandler,
  AstraToolSideEffect,
} from "./contracts";

export type AstraMcpToolDescriptor = {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  permissionLevel?: 0 | 1 | 2 | 3 | 4;
  sideEffect?: AstraToolSideEffect;
};

export type AstraMcpCallResult = {
  ok: boolean;
  detail: string;
  content?: unknown;
};

export interface AstraMcpTransport {
  readonly serverId: string;
  listTools(signal?: AbortSignal): Promise<AstraMcpToolDescriptor[]>;
  callTool(
    name: string,
    input: unknown,
    signal?: AbortSignal,
  ): Promise<AstraMcpCallResult>;
}

const MAX_MCP_TOOLS = 100;
const MAX_MCP_TOOL_NAME_CHARS = 120;
const MAX_MCP_DESCRIPTION_CHARS = 1000;
const MAX_MCP_SCHEMA_CHARS = 16_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeJsonLength(value: unknown) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function minimumPermission(sideEffect: AstraToolSideEffect) {
  switch (sideEffect) {
    case "read":
      return 1;
    case "local_write":
      return 2;
    case "external_write":
      return 3;
    case "high_impact":
      return 4;
  }
}

function normalizeServerId(value: string) {
  const clean = typeof value === "string" ? value.trim() : "";
  if (!clean || clean.length > 80) {
    throw new Error("MCP server id must be 1-80 characters.");
  }

  const id = clean
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!id) throw new Error("MCP server id is required.");
  return id;
}

function normalizeToolName(value: string) {
  const name = value.trim();
  if (!name || name.length > MAX_MCP_TOOL_NAME_CHARS) {
    throw new Error("MCP tool name must be 1-120 characters.");
  }
  return name;
}

function normalizeToolIdSegment(value: string) {
  const id = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!id) throw new Error("MCP tool name has no usable id characters.");
  return id;
}

function parsePermissionLevel(value: unknown) {
  if (value === undefined) return 1 as const;
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 4
    ? (Number(value) as 0 | 1 | 2 | 3 | 4)
    : null;
}

function parseSideEffect(value: unknown): AstraToolSideEffect | null {
  if (value === undefined) return "read";
  return value === "read" ||
    value === "local_write" ||
    value === "external_write" ||
    value === "high_impact"
    ? value
    : null;
}

function parseDescriptor(value: unknown): AstraMcpToolDescriptor | null {
  if (!isObject(value)) return null;

  const name =
    typeof value.name === "string" ? value.name.trim() : "";
  const description =
    typeof value.description === "string"
      ? value.description.trim()
      : "";
  if (
    !name ||
    name.length > MAX_MCP_TOOL_NAME_CHARS ||
    !description ||
    description.length > MAX_MCP_DESCRIPTION_CHARS
  ) {
    return null;
  }

  const sideEffect = parseSideEffect(value.sideEffect);
  const permissionLevel = parsePermissionLevel(value.permissionLevel);
  if (!sideEffect || permissionLevel === null) return null;

  let inputSchema: Record<string, unknown> | undefined;
  if (value.inputSchema !== undefined) {
    if (
      !isObject(value.inputSchema) ||
      safeJsonLength(value.inputSchema) > MAX_MCP_SCHEMA_CHARS
    ) {
      return null;
    }
    inputSchema = value.inputSchema;
  }

  const floor = minimumPermission(sideEffect);
  const safePermission = Math.max(permissionLevel, floor) as
    | 0
    | 1
    | 2
    | 3
    | 4;

  return {
    name,
    description,
    inputSchema,
    permissionLevel: safePermission,
    sideEffect,
  };
}

function parseCallResult(value: unknown): AstraMcpCallResult | null {
  if (!isObject(value) || typeof value.ok !== "boolean") return null;
  if (typeof value.detail !== "string") return null;

  return {
    ok: value.ok,
    detail: value.detail.trim().slice(0, 2000),
    content: value.content,
  };
}

export function createMcpToolRegistration(
  transport: AstraMcpTransport,
  descriptor: AstraMcpToolDescriptor,
): {
  definition: AstraToolDefinition;
  handler: AstraToolHandler;
} {
  const serverId = normalizeServerId(transport.serverId);
  const toolName = normalizeToolName(descriptor.name);
  const toolIdName = normalizeToolIdSegment(toolName);
  const sideEffect = descriptor.sideEffect ?? "read";
  const declaredPermission = descriptor.permissionLevel ?? 1;
  const permissionLevel = Math.max(
    declaredPermission,
    minimumPermission(sideEffect),
  ) as 0 | 1 | 2 | 3 | 4;

  const definition: AstraToolDefinition = {
    id: "mcp." + serverId + "." + toolIdName,
    name: "MCP " + toolName,
    category: "mcp",
    description: descriptor.description.trim().slice(0, 1000) || "MCP tool",
    permissionLevel,
    sideEffect,
    timeoutMs: 30_000,
    supportsCancellation: true,
    provider: "mcp:" + serverId,
    availability: "READY",
    inputSchema: descriptor.inputSchema,
  };

  const handler: AstraToolHandler = async (input, context) => {
    const rawResult = (await transport.callTool(
      toolName,
      input,
      context.signal,
    )) as unknown;
    const result = parseCallResult(rawResult);

    if (!result) {
      return {
        status: "failed",
        detail: "MCP tool returned a malformed result.",
        verified: false,
        provider: context.definition.provider,
      };
    }

    if (!result.ok) {
      return {
        status: "failed",
        detail: result.detail || "MCP tool call failed.",
        verified: false,
        provider: context.definition.provider,
      };
    }

    return {
      status: "completed",
      detail: result.detail || "MCP tool call completed.",
      verified: true,
      output: result.content,
      provider: context.definition.provider,
    };
  };

  return { definition, handler };
}

export async function discoverMcpToolRegistrations(
  transport: AstraMcpTransport,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  normalizeServerId(transport.serverId);

  const rawDescriptors = (await transport.listTools(signal)) as unknown;
  signal?.throwIfAborted();

  if (!Array.isArray(rawDescriptors)) {
    throw new Error("MCP server returned a malformed tool list.");
  }

  const registrations: Array<ReturnType<typeof createMcpToolRegistration>> = [];
  const seenIds = new Set<string>();

  for (const rawDescriptor of rawDescriptors.slice(0, MAX_MCP_TOOLS)) {
    const descriptor = parseDescriptor(rawDescriptor);
    if (!descriptor) continue;

    const registration = createMcpToolRegistration(
      transport,
      descriptor,
    );
    if (seenIds.has(registration.definition.id)) continue;
    seenIds.add(registration.definition.id);
    registrations.push(registration);
  }

  return registrations;
}
