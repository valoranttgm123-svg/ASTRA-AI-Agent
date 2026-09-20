import { lstat, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { AstraProjectRecord } from "./contracts";

const ALLOWED_EXTENSIONS = new Set([
  ".md",
  ".mdx",
  ".txt",
  ".json",
  ".jsonc",
  ".yaml",
  ".yml",
  ".toml",
  ".csv",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".html",
  ".css",
  ".scss",
  ".sql",
  ".ps1",
  ".sh",
]);

const SENSITIVE_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  "id_rsa",
  "id_ed25519",
  "credentials",
  "credentials.json",
  "secrets",
  "secrets.json",
  "auth.json",
]);

const SENSITIVE_SEGMENTS = new Set([
  ".ssh",
  ".gnupg",
  "credentials",
  "secrets",
  "token",
  "tokens",
]);

export type AstraResolvedProjectPath = {
  workspace: string;
  absolute: string;
  relative: string;
};

function relativeInside(root: string, target: string) {
  const relative = path.relative(root, target);
  if (relative === "") return ".";
  if (
    relative.startsWith(".." + path.sep) ||
    relative === ".." ||
    path.isAbsolute(relative)
  ) {
    return null;
  }
  return relative;
}

export function isSensitiveProjectPath(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  const segments = normalized
    .split("/")
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);
  const base = segments.at(-1) ?? "";

  if (SENSITIVE_NAMES.has(base)) return true;
  if (/^\.env(?:\.|$)/i.test(base)) return true;
  if (/\.(pem|key|p12|pfx|crt)$/i.test(base)) return true;
  return segments.some((segment) => SENSITIVE_SEGMENTS.has(segment));
}

export function isAllowedProjectTextPath(relativePath: string) {
  return ALLOWED_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

export async function resolveProjectWorkspace(
  project: AstraProjectRecord,
): Promise<string | null> {
  if (!project.workspace) return null;

  try {
    const workspace = await realpath(path.resolve(project.workspace));
    const info = await stat(workspace);
    return info.isDirectory() ? workspace : null;
  } catch {
    return null;
  }
}

function lexicalCandidate(workspace: string, requestedPath: string) {
  const clean = requestedPath.trim();
  if (!clean) return null;

  const candidate = path.isAbsolute(clean)
    ? path.resolve(clean)
    : path.resolve(workspace, clean);
  const relative = relativeInside(workspace, candidate);

  if (!relative || relative === ".") return null;
  if (isSensitiveProjectPath(relative)) return null;
  if (!isAllowedProjectTextPath(relative)) return null;

  return {
    candidate,
    relative,
  };
}

export async function resolveExistingProjectFile(
  project: AstraProjectRecord,
  requestedPath: string,
): Promise<AstraResolvedProjectPath | null> {
  const workspace = await resolveProjectWorkspace(project);
  if (!workspace) return null;

  const lexical = lexicalCandidate(workspace, requestedPath);
  if (!lexical) return null;

  try {
    const absolute = await realpath(lexical.candidate);
    const relative = relativeInside(workspace, absolute);
    if (!relative || relative === ".") return null;
    if (isSensitiveProjectPath(relative)) return null;
    if (!isAllowedProjectTextPath(relative)) return null;

    const info = await stat(absolute);
    if (!info.isFile()) return null;

    return {
      workspace,
      absolute,
      relative: relative.replace(/\\/g, "/"),
    };
  } catch {
    return null;
  }
}

export async function resolveWritableProjectFile(
  project: AstraProjectRecord,
  requestedPath: string,
): Promise<AstraResolvedProjectPath | null> {
  const workspace = await resolveProjectWorkspace(project);
  if (!workspace) return null;

  const lexical = lexicalCandidate(workspace, requestedPath);
  if (!lexical) return null;

  const parentCandidate = path.dirname(lexical.candidate);

  let parentReal: string;
  try {
    parentReal = await realpath(parentCandidate);
  } catch {
    return null;
  }

  const parentRelative = relativeInside(workspace, parentReal);
  if (parentRelative === null) return null;

  let lexicalInfo;
  try {
    lexicalInfo = await lstat(lexical.candidate);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";

    if (code !== "ENOENT") return null;

    return {
      workspace,
      absolute: lexical.candidate,
      relative: lexical.relative.replace(/\\/g, "/"),
    };
  }

  // Writes fail closed for any existing symlink. In particular, a dangling
  // symlink must never be mistaken for a safe "new file" target.
  if (lexicalInfo.isSymbolicLink()) return null;

  try {
    const existing = await realpath(lexical.candidate);
    const existingRelative = relativeInside(workspace, existing);
    if (!existingRelative || existingRelative === ".") return null;
    if (isSensitiveProjectPath(existingRelative)) return null;
    if (!isAllowedProjectTextPath(existingRelative)) return null;

    const info = await stat(existing);
    if (!info.isFile()) return null;

    return {
      workspace,
      absolute: existing,
      relative: existingRelative.replace(/\\/g, "/"),
    };
  } catch {
    return null;
  }
}
