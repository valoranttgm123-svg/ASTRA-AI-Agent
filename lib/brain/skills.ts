import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AstraAgentKey } from "@/lib/agent/types";

export type AstraSkill = {
  id: string;
  agents: AstraAgentKey[];
  instructions: string;
  source: "builtin" | "local";
};

export type AstraSkillContext = {
  enabled: boolean;
  available: boolean;
  skills: AstraSkill[];
  text: string;
  detail: string;
};

const BUILTIN_SKILLS: AstraSkill[] = [
  {
    id: "chief-orchestration",
    agents: ["chief_of_staff"],
    instructions:
      "Clarify the goal internally, route to the smallest capable specialist, and report execution truthfully.",
    source: "builtin",
  },
  {
    id: "engineering-repo",
    agents: ["developer", "github"],
    instructions:
      "Inspect before editing, prefer minimal changes, run available verification, and report exact files/tests changed.",
    source: "builtin",
  },
  {
    id: "research-evidence",
    agents: ["researcher"],
    instructions:
      "Separate verified facts from assumptions, prefer primary sources, and state uncertainty.",
    source: "builtin",
  },
  {
    id: "memory-retrieval",
    agents: ["memory"],
    instructions:
      "Use only retrieved context that is relevant to the current request; do not invent missing memories.",
    source: "builtin",
  },
  {
    id: "files-safe",
    agents: ["files"],
    instructions:
      "Default to read-only inspection. Writes, overwrites, moves, and deletes require the configured permission policy.",
    source: "builtin",
  },
  {
    id: "computer-safe",
    agents: ["computer"],
    instructions:
      "Prefer diagnostic/read-only commands first and avoid destructive or remote-control actions unless explicitly permitted.",
    source: "builtin",
  },
  {
    id: "communication-safe",
    agents: ["communication"],
    instructions:
      "Draft/read operations are safer defaults. Sending messages or changing calendars is an external side effect.",
    source: "builtin",
  },
  {
    id: "business-analysis",
    agents: ["business"],
    instructions:
      "Distinguish analysis/recommendation from actions that mutate business systems or customer data.",
    source: "builtin",
  },
  {
    id: "trading-readonly",
    agents: ["trading"],
    instructions:
      "Analysis is allowed, but never place, modify, or close trades unless an explicit execution permission path exists.",
    source: "builtin",
  },
];

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "off", "no"].includes(value);
}

function skillsPath() {
  const configured = process.env.ASTRA_SKILLS_FILE?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), ".astra", "skills.json");
}

function isAgentKey(value: string): value is AstraAgentKey {
  return [
    "chief_of_staff",
    "memory",
    "researcher",
    "developer",
    "computer",
    "files",
    "github",
    "communication",
    "business",
    "trading",
  ].includes(value);
}

function normalizeLocalSkills(value: unknown): AstraSkill[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const instructions =
        typeof record.instructions === "string" ? record.instructions.trim() : "";
      if (!instructions) return null;

      const rawAgents = Array.isArray(record.agents)
        ? record.agents.filter((agent): agent is string => typeof agent === "string")
        : [];
      const agents = rawAgents.filter(isAgentKey);
      if (agents.length === 0) return null;

      const id =
        typeof record.id === "string" && record.id.trim()
          ? record.id.trim()
          : `local-skill-${index + 1}`;

      return {
        id,
        agents,
        instructions: instructions.slice(0, 3000),
        source: "local" as const,
      };
    })
    .filter((skill): skill is AstraSkill => Boolean(skill));
}

export async function getSkillContext(agent: AstraAgentKey): Promise<AstraSkillContext> {
  const enabled = envFlag("ASTRA_SKILLS_ENABLED", true);

  if (!enabled) {
    return {
      enabled: false,
      available: false,
      skills: [],
      text: "",
      detail: "ASTRA skills are disabled by ASTRA_SKILLS_ENABLED.",
    };
  }

  const skills = BUILTIN_SKILLS.filter((skill) => skill.agents.includes(agent));
  const source = skillsPath();

  try {
    const raw = await readFile(source, "utf8");
    const local = normalizeLocalSkills(JSON.parse(raw) as unknown).filter((skill) =>
      skill.agents.includes(agent),
    );
    skills.push(...local);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code !== "ENOENT") {
      return {
        enabled: true,
        available: false,
        skills,
        text: skills.map((skill) => `- ${skill.id}: ${skill.instructions}`).join("\n"),
        detail:
          error instanceof Error
            ? `Built-in skills loaded; local skills file failed: ${error.message}`
            : "Built-in skills loaded; local skills file failed.",
      };
    }
  }

  return {
    enabled: true,
    available: true,
    skills,
    text:
      skills.length > 0
        ? `ASTRA skills for this route:\n${skills
            .map((skill) => `- ${skill.id}: ${skill.instructions}`)
            .join("\n")}`
        : "",
    detail:
      skills.length > 0
        ? `Loaded ${skills.length} skill${skills.length === 1 ? "" : "s"} for ${agent}.`
        : `No specialized skill is registered for ${agent}.`,
  };
}
