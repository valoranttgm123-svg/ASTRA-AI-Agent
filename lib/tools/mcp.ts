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

function normalizeServerId(value: string) {
  const id = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!id) throw new Error("MCP server id is required.");
  return id;
}

function normalizeToolName(value: string) {
  const name = value.trim().slice(0, 120);
  if (!name) throw new Error("MCP tool name is required.");
  return name;
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
  const sideEffect = descriptor.sideEffect ?? "read";
  const permissionLevel = descriptor.permissionLevel ?? 1;

  const definition: AstraToolDefinition = {
    id: "mcp." + serverId + "." + toolName,
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
    const result = await transport.callTool(
      toolName,
      input,
      context.signal,
    );

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
  const descriptors = await transport.listTools(signal);
  return descriptors.slice(0, 100).map((descriptor) =>
    createMcpToolRegistration(transport, descriptor),
  );
}
