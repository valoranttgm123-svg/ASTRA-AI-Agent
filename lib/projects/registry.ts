import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  AstraProjectIntegration,
  AstraProjectMatch,
  AstraProjectRecord,
  AstraProjectRegistryContext,
  AstraProjectStatus,
} from "./contracts";

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "off", "no"].includes(value);
}

function projectsPath() {
  const configured = process.env.ASTRA_PROJECTS_FILE?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".astra", "projects.json");
}

function strings(value: unknown, maxItems: number, maxLength = 300) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function status(value: unknown): AstraProjectStatus {
  return value === "paused" || value === "archived" ? value : "active";
}

function integrations(value: unknown): AstraProjectIntegration[] {
  if (!Array.isArray(value)) return [];
  const result: AstraProjectIntegration[] = [];
  for (const item of value.slice(0, 30)) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim().slice(0, 120) : "";
    const kind = typeof record.kind === "string" ? record.kind.trim().slice(0, 120) : "";
    if (!id || !kind) continue;
    result.push({
      id,
      kind,
      configured: record.configured === true,
    });
  }
  return result;
}

export function normalizeProjects(value: unknown): AstraProjectRecord[] {
  if (!Array.isArray(value)) return [];
  const result: AstraProjectRecord[] = [];
  const seen = new Set<string>();

  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const rawName = typeof record.name === "string" ? record.name.trim() : "";
    if (!rawName) return;

    const id =
      typeof record.id === "string" && record.id.trim()
        ? record.id.trim().slice(0, 120)
        : "project-" + (index + 1);
    const key = id.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const workspace =
      typeof record.workspace === "string" && record.workspace.trim()
        ? record.workspace.trim().slice(0, 500)
        : undefined;
    const currentMilestone =
      typeof record.currentMilestone === "string" && record.currentMilestone.trim()
        ? record.currentMilestone.trim().slice(0, 300)
        : undefined;
    const lastActivity =
      typeof record.lastActivity === "string" && record.lastActivity.trim()
        ? record.lastActivity.trim().slice(0, 80)
        : undefined;
    const memoryNamespace =
      typeof record.memoryNamespace === "string" && record.memoryNamespace.trim()
        ? record.memoryNamespace.trim().slice(0, 120)
        : id;

    result.push({
      id,
      name: rawName.slice(0, 160),
      aliases: strings(record.aliases, 20, 120),
      workspace,
      repositories: strings(record.repositories, 20, 500),
      docs: strings(record.docs, 50, 500),
      memoryNamespace,
      goals: strings(record.goals, 30, 500),
      status: status(record.status),
      currentMilestone,
      lastActivity,
      openTasks: strings(record.openTasks, 100, 500),
      importantFiles: strings(record.importantFiles, 100, 500),
      integrations: integrations(record.integrations),
    });
  });

  return result;
}

export async function getProjectRegistry(): Promise<AstraProjectRegistryContext> {
  const enabled = envFlag("ASTRA_PROJECTS_ENABLED", true);
  const source = projectsPath();

  if (!enabled) {
    return {
      enabled: false,
      available: false,
      source,
      projects: [],
      detail: "Project Registry is disabled by ASTRA_PROJECTS_ENABLED.",
    };
  }

  try {
    const raw = await readFile(source, "utf8");
    const projects = normalizeProjects(JSON.parse(raw) as unknown);
    return {
      enabled: true,
      available: true,
      source,
      projects,
      detail:
        projects.length === 0
          ? "Project Registry file is readable but contains no valid projects."
          : "Loaded " + projects.length + " registered project" + (projects.length === 1 ? "." : "s."),
    };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    if (code === "ENOENT") {
      return {
        enabled: true,
        available: true,
        source,
        projects: [],
        detail:
          "Project Registry is ready; no .astra/projects.json file exists yet. ASTRA will not scan arbitrary folders.",
      };
    }

    return {
      enabled: true,
      available: false,
      source,
      projects: [],
      detail:
        error instanceof Error
          ? "Project Registry could not be read: " + error.message
          : "Project Registry could not be read.",
    };
  }
}

function normalizeInput(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function containsPhrase(input: string, value: string) {
  const phrase = normalizeInput(value);
  return phrase.length > 0 && input.includes(phrase);
}

function recentTime(project: AstraProjectRecord) {
  const parsed = Date.parse(project.lastActivity ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveProject(
  input: string,
  projects: readonly AstraProjectRecord[],
): AstraProjectMatch | null {
  if (projects.length === 0) return null;
  const text = normalizeInput(input);
  const matches: AstraProjectMatch[] = [];

  for (const project of projects) {
    if (containsPhrase(text, project.id)) {
      matches.push({ project, score: 100, reason: "id" });
      continue;
    }
    if (containsPhrase(text, project.name)) {
      matches.push({ project, score: 90, reason: "name" });
      continue;
    }
    const alias = project.aliases.find((value) => containsPhrase(text, value));
    if (alias) {
      matches.push({ project, score: 80, reason: "alias" });
    }
  }

  if (matches.length > 0) {
    return matches.sort(
      (a, b) => b.score - a.score || recentTime(b.project) - recentTime(a.project),
    )[0];
  }

  const asksForRecent =
    /\b(last|latest|recent)\s+project\b/i.test(input) ||
    /\bproject\s+(terakhir|terbaru)\b/i.test(input) ||
    /\bproyek\s+(terakhir|terbaru)\b/i.test(input) ||
    /\blanjutkan\s+(project|proyek)\b/i.test(input);

  if (!asksForRecent) return null;

  const recent = [...projects]
    .filter((project) => project.status === "active")
    .sort((a, b) => recentTime(b) - recentTime(a))[0];

  return recent ? { project: recent, score: 10, reason: "recent" } : null;
}

export async function resolveProjectContext(
  input: string,
): Promise<{ registry: AstraProjectRegistryContext; match: AstraProjectMatch | null }> {
  const registry = await getProjectRegistry();
  return {
    registry,
    match: registry.available ? resolveProject(input, registry.projects) : null,
  };
}
