import type {
  AstraExecutableToolRegistry,
  AstraToolDefinition,
  AstraToolHandler,
} from "./contracts";
import { createExecutableToolRegistry } from "./executor";
import {
  NATIVE_TOOL_DEFINITIONS,
  NATIVE_TOOL_HANDLERS,
} from "./native";
import type { AstraMcpTransport } from "./mcp";
import { discoverMcpToolRegistrations } from "./mcp";

export function createNativeToolRuntime(): AstraExecutableToolRegistry {
  return createExecutableToolRegistry(
    NATIVE_TOOL_DEFINITIONS,
    NATIVE_TOOL_HANDLERS,
  );
}

export async function createToolRuntime(options?: {
  mcpTransports?: readonly AstraMcpTransport[];
  signal?: AbortSignal;
}): Promise<AstraExecutableToolRegistry> {
  const definitions: AstraToolDefinition[] = [
    ...NATIVE_TOOL_DEFINITIONS,
  ];
  const handlers: Record<string, AstraToolHandler> = {
    ...NATIVE_TOOL_HANDLERS,
  };

  for (const transport of options?.mcpTransports ?? []) {
    const registrations = await discoverMcpToolRegistrations(
      transport,
      options?.signal,
    );

    for (const registration of registrations) {
      definitions.push(registration.definition);
      handlers[registration.definition.id] = registration.handler;
    }
  }

  return createExecutableToolRegistry(definitions, handlers);
}

export const astraNativeToolRuntime = createNativeToolRuntime();
