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
import { BROWSER_TOOL_DEFINITIONS, BROWSER_TOOL_HANDLERS } from "./browser";
import type { AstraResearchTransport } from "./research";
import { createResearchToolRegistrations, SearXngResearchTransport } from "./research";
import type { AstraIntegrationTransport } from "./integrations";
import {
  createIntegrationToolRegistrations,
  INTEGRATION_TOOL_DEFINITIONS,
} from "./integrations";

export function createNativeToolRuntime(): AstraExecutableToolRegistry {
  return createExecutableToolRegistry(
    [
      ...NATIVE_TOOL_DEFINITIONS,
      ...BROWSER_TOOL_DEFINITIONS,
      ...INTEGRATION_TOOL_DEFINITIONS,
    ],
    {
      ...NATIVE_TOOL_HANDLERS,
      ...BROWSER_TOOL_HANDLERS,
    },
  );
}

export async function createToolRuntime(options?: {
  mcpTransports?: readonly AstraMcpTransport[];
  githubTransport?: AstraGitHubTransport;
  researchTransport?: AstraResearchTransport;
  integrationTransports?: readonly AstraIntegrationTransport[];
  signal?: AbortSignal;
}): Promise<AstraExecutableToolRegistry> {
  let definitions: AstraToolDefinition[] = [
    ...NATIVE_TOOL_DEFINITIONS,
    ...BROWSER_TOOL_DEFINITIONS,
    ...INTEGRATION_TOOL_DEFINITIONS,
  ];
  const handlers: Record<string, AstraToolHandler> = {
    ...NATIVE_TOOL_HANDLERS,
    ...BROWSER_TOOL_HANDLERS,
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

  if (options?.researchTransport) {
    const research = await createResearchToolRegistrations(
      options.researchTransport,
    );
    const researchIds = new Set(
      research.definitions.map((definition) => definition.id),
    );
    definitions = definitions.filter(
      (definition) => !researchIds.has(definition.id),
    );
    definitions.push(...research.definitions);

    for (const [id, handler] of Object.entries(research.handlers)) {
      handlers[id] = handler;
    }
  }

  for (const transport of options?.integrationTransports ?? []) {
    const integration = await createIntegrationToolRegistrations(
      transport,
      options.signal,
    );
    const integrationIds = new Set(
      integration.definitions.map((definition) => definition.id),
    );

    definitions = definitions.filter(
      (definition) => !integrationIds.has(definition.id),
    );
    definitions.push(...integration.definitions);

    for (const [id, handler] of Object.entries(integration.handlers)) {
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
    researchTransport: new SearXngResearchTransport(),
    signal,
  });
}

export const astraNativeToolRuntime = createNativeToolRuntime();
