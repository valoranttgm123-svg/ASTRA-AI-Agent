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
import type { AstraGitHubTransport } from "./github";
import { createGitHubToolRegistrations, GhCliGitHubTransport } from "./github";

export function createNativeToolRuntime(): AstraExecutableToolRegistry {
  return createExecutableToolRegistry(
    NATIVE_TOOL_DEFINITIONS,
    NATIVE_TOOL_HANDLERS,
  );
}

export async function createToolRuntime(options?: {
  mcpTransports?: readonly AstraMcpTransport[];
  githubTransport?: AstraGitHubTransport;
  signal?: AbortSignal;
}): Promise<AstraExecutableToolRegistry> {
  let definitions: AstraToolDefinition[] = [
    ...NATIVE_TOOL_DEFINITIONS,
  ];
  const handlers: Record<string, AstraToolHandler> = {
    ...NATIVE_TOOL_HANDLERS,
  };

  if (options?.githubTransport) {
    const github = await createGitHubToolRegistrations(
      options.githubTransport,
      options.signal,
    );
    const githubIds = new Set(
      github.definitions.map((definition) => definition.id),
    );
    definitions = definitions.filter(
      (definition) => !githubIds.has(definition.id),
    );
    definitions.push(...github.definitions);

    for (const [id, handler] of Object.entries(github.handlers)) {
      handlers[id] = handler;
    }
  }

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

export async function createDefaultToolRuntime(
  signal?: AbortSignal,
): Promise<AstraExecutableToolRegistry> {
  return createToolRuntime({
    githubTransport: new GhCliGitHubTransport(),
    signal,
  });
}

export const astraNativeToolRuntime = createNativeToolRuntime();
