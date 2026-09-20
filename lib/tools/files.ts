import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import type { AstraProjectRecord } from "@/lib/projects/contracts";
import {
  resolveExistingProjectFile,
  resolveWritableProjectFile,
} from "@/lib/projects/paths";
import { getProjectRegistry } from "@/lib/projects/registry";
import type {
  AstraToolDefinition,
  AstraToolHandler,
} from "./contracts";

const MAX_READ_CHARS = 64_000;
const MAX_WRITE_CHARS = 262_144;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function registeredProject(
  projectId: string,
): Promise<AstraProjectRecord | null> {
  const registry = await getProjectRegistry();
  if (!registry.available) return null;
  return (
    registry.projects.find(
      (project) => project.id.toLowerCase() === projectId.toLowerCase(),
    ) ?? null
  );
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export const FILE_TOOL_DEFINITIONS: readonly AstraToolDefinition[] = [
  {
    id: "project.file.read",
    name: "Project File Read",
    category: "filesystem",
    description:
      "Read one explicit safe text file inside a registered project workspace.",
    permissionLevel: 1,
    sideEffect: "read",
    timeoutMs: 8_000,
    supportsCancellation: true,
    provider: "native-project-files",
    availability: "READY",
  },
  {
    id: "project.file.write",
    name: "Project File Write",
    category: "filesystem",
    description:
      "Create or replace one explicit safe text file inside a registered project workspace, with hash precondition for existing files and read-back verification.",
    permissionLevel: 2,
    sideEffect: "local_write",
    timeoutMs: 10_000,
    supportsCancellation: true,
    provider: "native-project-files",
    availability: "READY",
  },
];

const readProjectFile: AstraToolHandler = async (input, context) => {
  if (!isObject(input)) {
    return {
      status: "failed",
      detail: "Project file read input must be an object.",
      verified: false,
    };
  }

  const projectId =
    typeof input.projectId === "string" ? input.projectId.trim() : "";
  const requestedPath =
    typeof input.path === "string" ? input.path.trim() : "";

  if (!projectId || !requestedPath) {
    return {
      status: "failed",
      detail: "projectId and path are required.",
      verified: false,
    };
  }

  context.signal.throwIfAborted();
  const project = await registeredProject(projectId);
  if (!project) {
    return {
      status: "failed",
      detail: "Registered project not found: " + projectId,
      verified: false,
    };
  }

  const resolved = await resolveExistingProjectFile(project, requestedPath);
  if (!resolved) {
    return {
      status: "failed",
      detail:
        "Requested file is unavailable, outside the registered workspace, sensitive, or unsupported.",
      verified: false,
    };
  }

  const info = await stat(resolved.absolute);
  if (!info.isFile() || info.size > 1_048_576) {
    return {
      status: "failed",
      detail: "Requested file is not a supported bounded text file.",
      verified: false,
    };
  }

  context.signal.throwIfAborted();
  const content = await readFile(resolved.absolute, "utf8");
  const bounded = content.slice(0, MAX_READ_CHARS);

  return {
    status: "completed",
    detail:
      "Read project file " +
      resolved.relative +
      (content.length > bounded.length ? " with bounded truncation." : "."),
    verified: true,
    provider: context.definition.provider,
    output: {
      project: { id: project.id, name: project.name },
      path: resolved.relative,
      content: bounded,
      truncated: content.length > bounded.length,
      sizeBytes: info.size,
      modifiedAt: info.mtime.toISOString(),
      sha256: sha256(content),
    },
  };
};

const writeProjectFile: AstraToolHandler = async (input, context) => {
  if (!isObject(input)) {
    return {
      status: "failed",
      detail: "Project file write input must be an object.",
      verified: false,
    };
  }

  const projectId =
    typeof input.projectId === "string" ? input.projectId.trim() : "";
  const requestedPath =
    typeof input.path === "string" ? input.path.trim() : "";
  const content =
    typeof input.content === "string" ? input.content : null;
  const expectedSha256 =
    typeof input.expectedSha256 === "string"
      ? input.expectedSha256.trim().toLowerCase()
      : "";

  if (!projectId || !requestedPath || content === null) {
    return {
      status: "failed",
      detail: "projectId, path and content are required.",
      verified: false,
    };
  }

  if (content.length > MAX_WRITE_CHARS) {
    return {
      status: "failed",
      detail: "Write content exceeds the ASTRA bounded file limit.",
      verified: false,
    };
  }

  context.signal.throwIfAborted();
  const project = await registeredProject(projectId);
  if (!project) {
    return {
      status: "failed",
      detail: "Registered project not found: " + projectId,
      verified: false,
    };
  }

  const resolved = await resolveWritableProjectFile(project, requestedPath);
  if (!resolved) {
    return {
      status: "failed",
      detail:
        "Requested write target is outside the registered workspace, sensitive, unsupported, or has an unavailable parent directory.",
      verified: false,
    };
  }

  let previous: string | null = null;
  try {
    previous = await readFile(resolved.absolute, "utf8");
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code !== "ENOENT") {
      return {
        status: "failed",
        detail: "Existing target could not be inspected before write.",
        verified: false,
      };
    }
  }

  if (previous !== null) {
    const currentSha = sha256(previous);
    if (!expectedSha256) {
      return {
        status: "blocked",
        detail:
          "Existing files require expectedSha256 from a prior read before replacement.",
        verified: false,
        output: {
          path: resolved.relative,
          currentSha256: currentSha,
        },
      };
    }

    if (expectedSha256 !== currentSha) {
      return {
        status: "blocked",
        detail:
          "File changed since the caller inspected it; expectedSha256 does not match.",
        verified: false,
        output: {
          path: resolved.relative,
          currentSha256: currentSha,
        },
      };
    }
  }

  context.signal.throwIfAborted();
  await writeFile(resolved.absolute, content, "utf8");
  context.signal.throwIfAborted();

  const verified = await readFile(resolved.absolute, "utf8");
  if (verified !== content) {
    return {
      status: "failed",
      detail: "Write verification failed after re-reading the target file.",
      verified: false,
    };
  }

  return {
    status: "completed",
    detail:
      (previous === null ? "Created " : "Updated ") +
      resolved.relative +
      " and verified the exact written content.",
    verified: true,
    provider: context.definition.provider,
    output: {
      project: { id: project.id, name: project.name },
      path: resolved.relative,
      created: previous === null,
      previousSha256: previous === null ? null : sha256(previous),
      sha256: sha256(verified),
      sizeBytes: Buffer.byteLength(verified, "utf8"),
    },
  };
};

export const FILE_TOOL_HANDLERS: Readonly<Record<string, AstraToolHandler>> = {
  "project.file.read": readProjectFile,
  "project.file.write": writeProjectFile,
};
