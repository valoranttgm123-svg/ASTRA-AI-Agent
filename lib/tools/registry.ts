import type {
  AstraToolDefinition,
  AstraToolRegistry,
  AstraToolSideEffect,
} from "./contracts";

const MAX_TOOL_TIMEOUT_MS = 120_000;

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

function normalizeToolId(id: string) {
  const normalized = id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  if (!normalized) throw new Error("Tool id is required.");
  return normalized;
}

export function normalizeToolDefinition(
  definition: AstraToolDefinition,
): AstraToolDefinition {
  const id = normalizeToolId(definition.id);
  const name = definition.name.trim().replace(/\s+/g, " ").slice(0, 160);
  const description = definition.description
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 1000);

  if (!name) throw new Error("Tool name is required for " + id + ".");
  if (!description) throw new Error("Tool description is required for " + id + ".");

  const minPermission = minimumPermission(definition.sideEffect);
  if (definition.permissionLevel < minPermission) {
    throw new Error(
      "Tool " +
        id +
        " requires permission level " +
        minPermission +
        " or higher for " +
        definition.sideEffect +
        ".",
    );
  }

  const timeoutMs = Number.isFinite(definition.timeoutMs)
    ? Math.max(1_000, Math.min(MAX_TOOL_TIMEOUT_MS, Math.floor(definition.timeoutMs)))
    : 30_000;

  const provider = definition.provider?.trim().slice(0, 160) || undefined;
  if (definition.availability === "READY" && !provider) {
    throw new Error("READY tool " + id + " must declare its provider.");
  }

  return {
    ...definition,
    id,
    name,
    description,
    timeoutMs,
    provider,
  };
}

export function createToolRegistry(
  definitions: readonly AstraToolDefinition[],
): AstraToolRegistry {
  const map = new Map<string, AstraToolDefinition>();

  for (const definition of definitions) {
    const normalized = normalizeToolDefinition(definition);
    if (map.has(normalized.id)) {
      throw new Error("Duplicate tool id: " + normalized.id);
    }
    map.set(normalized.id, Object.freeze(normalized));
  }

  const list = Object.freeze([...map.values()]);

  return {
    list() {
      return list;
    },
    get(id: string) {
      return map.get(normalizeToolId(id));
    },
    has(id: string) {
      return map.has(normalizeToolId(id));
    },
  };
}
