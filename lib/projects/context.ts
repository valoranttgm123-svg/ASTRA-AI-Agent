import { readFile, stat } from "node:fs/promises";
import type { AstraMemoryRecord, AstraMemorySource } from "@/lib/memory/contracts";
import type { AstraProjectRecord } from "./contracts";
import {
  resolveExistingProjectFile,
  resolveProjectWorkspace,
} from "./paths";

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

      const workspace = await resolveProjectWorkspace(project);
      if (!workspace) {
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

      const configured = [
        ...new Set([...project.docs, ...project.importantFiles]),
      ].slice(0, maxFiles);

      const records: AstraMemoryRecord[] = [];

      for (const configuredPath of configured) {
        query.signal?.throwIfAborted();
        const resolved = await resolveExistingProjectFile(
          project,
          configuredPath,
        );
        if (!resolved || resolved.workspace !== workspace) continue;

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

      records.sort((a, b) => {
        if (b.relevance !== a.relevance) return b.relevance - a.relevance;
        const aTime = Date.parse(a.provenance.timestamp ?? "") || 0;
        const bTime = Date.parse(b.provenance.timestamp ?? "") || 0;
        return bTime - aTime;
      });

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
