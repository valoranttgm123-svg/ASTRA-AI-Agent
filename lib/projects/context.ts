import { realpath, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { AstraMemorySource } from "@/lib/memory/contracts";
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

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "off", "no"].includes(value);
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  maximum: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(maximum, Math.floor(parsed));
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\u1e00-\u1eff]+/gi, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function relevance(query: string, content: string, fileName: string) {
  const input = new Set(tokenize(query));
  if (input.size === 0) return 0.25;

  const haystack = new Set(tokenize(fileName + " " + content.slice(0, 12000)));
  let matches = 0;
  for (const token of input) {
    if (haystack.has(token)) matches += 1;
  }
  return Math.min(1, matches / input.size);
}

function normalizedRelative(root: string, target: string) {
  const relative = path.relative(root, target);
  if (
    relative === "" ||
    relative.startsWith(".." + path.sep) ||
    relative === ".." ||
    path.isAbsolute(relative)
  ) {
    return relative === "" ? "." : null;
  }
  return relative;
}

function isSensitive(relativePath: string) {
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

function allowedExtension(relativePath: string) {
  return ALLOWED_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

async function resolveRegisteredFile(
  workspaceReal: string,
  configuredPath: string,
): Promise<{ absolute: string; relative: string } | null> {
  const candidate = path.isAbsolute(configuredPath)
    ? path.resolve(configuredPath)
    : path.resolve(workspaceReal, configuredPath);

  const lexicalRelative = normalizedRelative(workspaceReal, candidate);
  if (!lexicalRelative || lexicalRelative === ".") return null;
  if (isSensitive(lexicalRelative) || !allowedExtension(lexicalRelative)) return null;

  let targetReal: string;
  try {
    targetReal = await realpath(candidate);
  } catch {
    return null;
  }

  const realRelative = normalizedRelative(workspaceReal, targetReal);
  if (!realRelative || realRelative === ".") return null;
  if (isSensitive(realRelative) || !allowedExtension(realRelative)) return null;

  return { absolute: targetReal, relative: realRelative.replace(/\\/g, "/") };
}

export function createProjectContextMemorySource(
  project: AstraProjectRecord,
): AstraMemorySource {
  return {
    id: "project-context:" + project.id,
    type: "project",

    async search(query) {
      const enabled = envFlag("ASTRA_PROJECT_CONTEXT_ENABLED", true);

      if (!enabled) {
        return {
          source: "project-context:" + project.id,
          sourceType: "project" as const,
          available: false,
          detail: "Project context loading is disabled by ASTRA_PROJECT_CONTEXT_ENABLED.",
          records: [],
        };
      }

      if (!project.workspace) {
        return {
          source: "project-context:" + project.id,
          sourceType: "project" as const,
          available: false,
          detail: "Registered project has no workspace path.",
          records: [],
        };
      }

      let workspaceReal: string;
      try {
        workspaceReal = await realpath(path.resolve(project.workspace));
        const workspaceStat = await stat(workspaceReal);
        if (!workspaceStat.isDirectory()) throw new Error("not a directory");
      } catch {
        return {
          source: "project-context:" + project.id,
          sourceType: "project" as const,
          available: false,
          detail: "Registered project workspace is unavailable.",
          records: [],
        };
      }

      query.signal?.throwIfAborted();

      const maxFiles = parsePositiveInt(
        process.env.ASTRA_PROJECT_CONTEXT_MAX_FILES,
        20,
        50,
      );
      const maxFileBytes = parsePositiveInt(
        process.env.ASTRA_PROJECT_CONTEXT_MAX_FILE_BYTES,
        262144,
        1048576,
      );

      const configured = [...new Set([...project.docs, ...project.importantFiles])]
        .slice(0, maxFiles);

      const records = [];

      for (const configuredPath of configured) {
        query.signal?.throwIfAborted();
        const resolved = await resolveRegisteredFile(workspaceReal, configuredPath);
        if (!resolved) continue;

        let fileStat;
        try {
          fileStat = await stat(resolved.absolute);
        } catch {
          continue;
        }
        if (!fileStat.isFile() || fileStat.size > maxFileBytes) continue;

        let content: string;
        try {
          content = await readFile(resolved.absolute, "utf8");
        } catch {
          continue;
        }

        const trimmed = content.trim().slice(0, 4000);
        if (!trimmed) continue;

        records.push({
          id: project.id + ":" + resolved.relative,
          content: trimmed,
          tags: ["project", project.id, "registered-file"],
          relevance: relevance(query.input, trimmed, resolved.relative),
          confidence: 1,
          provenance: {
            source: "project-context:" + project.id,
            sourceType: "project" as const,
            project: project.name,
            timestamp: fileStat.mtime.toISOString(),
            privacy: "project_local" as const,
            reference:
              "project:" +
              project.id +
              ":" +
              resolved.relative.replace(/\\/g, "/"),
          },
        });
      }

      records.sort(
        (a, b) =>
          b.relevance - a.relevance ||
          b.provenance.timestamp.localeCompare(a.provenance.timestamp),
      );

      const bounded = records.slice(
        0,
        Math.max(1, Math.min(query.limit, maxFiles)),
      );

      return {
        source: "project-context:" + project.id,
        sourceType: "project" as const,
        available: true,
        detail:
          "Read " +
          bounded.length +
          " explicitly registered project file" +
          (bounded.length === 1 ? "." : "s.") +
          " No directory scan was performed.",
        records: bounded,
      };
    },
  };
}
