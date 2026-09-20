import type {
  AstraToolDefinition,
  AstraToolHandler,
} from "./contracts";
import { getProjectRegistry } from "@/lib/projects/registry";
import { createProjectContextMemorySource } from "@/lib/projects/context";
import { FILE_TOOL_DEFINITIONS, FILE_TOOL_HANDLERS } from "./files";
import { LOCAL_GIT_TOOL_DEFINITIONS, LOCAL_GIT_TOOL_HANDLERS } from "./local-git";
import { BUSINESS_TOOL_DEFINITIONS, BUSINESS_TOOL_HANDLERS } from "./business";

const PROJECT_CONTEXT_TOOL_DEFINITION: AstraToolDefinition = {
    id: "project.context.search",
    name: "Project Context Search",
    category: "filesystem",
    description:
      "Read only explicitly registered project docs and important files through the existing scoped project-context loader.",
    permissionLevel: 1,
    sideEffect: "read",
    timeoutMs: 8_000,
    supportsCancellation: true,
    provider: "native-project-context",
    availability: "READY",
    inputSchema: {
      type: "object",
      required: ["projectId", "query"],
      properties: {
        projectId: { type: "string" },
        query: { type: "string" },
        limit: { type: "number" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        project: { type: "object" },
        records: { type: "array" },
        detail: { type: "string" },
      },
    },
  };

export const NATIVE_TOOL_DEFINITIONS: readonly AstraToolDefinition[] = [
  PROJECT_CONTEXT_TOOL_DEFINITION,
  ...FILE_TOOL_DEFINITIONS,
  ...LOCAL_GIT_TOOL_DEFINITIONS,
  ...BUSINESS_TOOL_DEFINITIONS,
];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedLimit(value: unknown) {
  const parsed =
    typeof value === "number" && Number.isFinite(value)
      ? Math.floor(value)
      : 6;
  return Math.max(1, Math.min(20, parsed));
}

const projectContextSearch: AstraToolHandler = async (input, context) => {
  if (!isObject(input)) {
    return {
      status: "failed",
      detail: "Project context input must be an object.",
      verified: false,
    };
  }

  const projectId =
    typeof input.projectId === "string" ? input.projectId.trim() : "";
  const query = typeof input.query === "string" ? input.query.trim() : "";

  if (!projectId || !query) {
    return {
      status: "failed",
      detail: "projectId and query are required.",
      verified: false,
    };
  }

  const registry = await getProjectRegistry();
  if (!registry.available) {
    return {
      status: "failed",
      detail: registry.detail,
      verified: false,
    };
  }

  const project = registry.projects.find(
    (item) => item.id.toLowerCase() === projectId.toLowerCase(),
  );

  if (!project) {
    return {
      status: "failed",
      detail: "Registered project not found: " + projectId,
      verified: false,
    };
  }

  const source = createProjectContextMemorySource(project);
  const result = await source.search({
    input: query,
    project: project.name,
    limit: boundedLimit(input.limit),
    maxChars: 8_000,
    signal: context.signal,
  });

  if (!result.available) {
    return {
      status: "failed",
      detail: result.detail,
      verified: false,
      provider: context.definition.provider,
    };
  }

  return {
    status: "completed",
    detail: result.detail,
    verified: true,
    provider: context.definition.provider,
    output: {
      project: {
        id: project.id,
        name: project.name,
      },
      records: result.records.map((record) => ({
        id: record.id,
        content: record.content,
        tags: record.tags,
        relevance: record.relevance,
        confidence: record.confidence,
        provenance: record.provenance,
      })),
      detail: result.detail,
    },
  };
};

export const NATIVE_TOOL_HANDLERS: Readonly<Record<string, AstraToolHandler>> = {
  "project.context.search": projectContextSearch,
  ...FILE_TOOL_HANDLERS,
  ...LOCAL_GIT_TOOL_HANDLERS,
  ...BUSINESS_TOOL_HANDLERS,
};
