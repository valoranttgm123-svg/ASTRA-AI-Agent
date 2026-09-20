import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AstraAgentKey } from "@/lib/agent/types";

export type AstraSkill = {
  id: string;
  agents: AstraAgentKey[];
  instructions: string;
  triggers?: string[];
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
      "Distinguish supplied facts from assumptions. Analysis, planning, drafting, and calculations do not imply any external system was changed. Never invent POS, customer, campaign, supplier, or financial data that was not supplied or retrieved.",
    source: "builtin",
  },
  {
    id: "finance-analysis",
    agents: ["business"],
    triggers: ["finance","financial","keuangan","margin","markup","laba","profit","biaya","cost","budget","anggaran","harga jual","break even","bep"],
    instructions:
      "Act as the Finance specialist. Prefer business.finance.metrics for arithmetic when structured values are available. State which values are supplied versus assumed. Separate gross profit, net profit, margin, markup, cash flow, and break-even concepts. Do not claim accounting records were verified unless a real data source supplied them.",
    source: "builtin",
  },
  {
    id: "sales-support",
    agents: ["business"],
    triggers: ["sales","penjualan","lead","prospek","quotation","quote","penawaran","follow up","follow-up","pipeline","closing"],
    instructions:
      "Act as the Sales specialist for analysis and drafting. Use only supplied/retrieved customer or pipeline context. Draft quotations and follow-ups clearly, but never claim a message was sent, a lead was updated, or a CRM stage changed unless a real approved integration reports success.",
    source: "builtin",
  },
  {
    id: "marketing-strategy",
    agents: ["business"],
    triggers: ["marketing","kampanye","campaign","promosi","promotion","positioning","branding","brand","iklan","advertising"],
    instructions:
      "Act as the Marketing specialist. Build positioning, offer, audience, channel, campaign, and measurement plans from known context. Distinguish ideas from researched facts. Do not claim ads, posts, campaigns, or budgets were published or changed without a real approved integration.",
    source: "builtin",
  },
  {
    id: "ops-workflow",
    agents: ["business"],
    triggers: ["ops","operasional","operations","workflow","checklist","supplier","vendor","stok","stock","inventory","proses","process"],
    instructions:
      "Act as the Ops specialist. Turn goals into clear operational workflows, owners, dependencies, checks, and failure handling. Reasoning/checklists are read-only. Delegate actual desktop, file, supplier, database, or external actions to registered tools and their permission gates.",
    source: "builtin",
  },
  {
    id: "editor-quality",
    agents: ["business"],
    triggers: ["editor","proofread","proofreading","rewrite","tulis ulang","revisi","revision","tone","copywriting","rapikan tulisan","perbaiki tulisan"],
    instructions:
      "Act as the Editor specialist. Improve clarity, grammar, structure, tone, consistency, and factual caution while preserving the intended meaning. Editing produces a draft only; never claim a document, email, or public post was published or sent.",
    source: "builtin",
  },
  {
    id: "analytics-interpretation",
    agents: ["business"],
    triggers: ["analytics","analitik","kpi","metric","metrics","metrik","trend","tren","anomali","anomaly","data penjualan","ringkasan data","dashboard"],
    instructions:
      "Act as the Analytics specialist. Prefer analytics.summary for bounded structured numeric records. Keep source/provenance labels, distinguish descriptive statistics from causal explanations, and state when a trend or anomaly is only an observation rather than a verified cause.",
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

  const skills: AstraSkill[] = [];

  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const instructions =
      typeof record.instructions === "string" ? record.instructions.trim() : "";
    if (!instructions) return;

    const rawAgents = Array.isArray(record.agents)
      ? record.agents.filter((agent): agent is string => typeof agent === "string")
      : [];
    const agents = rawAgents.filter(isAgentKey);
    if (agents.length === 0) return;

    const id =
      typeof record.id === "string" && record.id.trim()
        ? record.id.trim()
        : `local-skill-${index + 1}`;

    const triggers = Array.isArray(record.triggers)
      ? record.triggers
          .filter((trigger): trigger is string => typeof trigger === "string")
          .map((trigger) => trigger.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 40)
      : undefined;

    skills.push({
      id,
      agents,
      instructions: instructions.slice(0, 3000),
      triggers: triggers && triggers.length > 0 ? triggers : undefined,
      source: "local",
    });
  });

  return skills;
}

function hasTrigger(input: string, trigger: string) {
  const text = input.toLowerCase();
  const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\  const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\export async function getSkillContext(agent: AstraAgentKey): Promise<AstraSkillContext> {");");
  return new RegExp(
    "(?:^|[^a-z0-9])" + escaped + "(?:$|[^a-z0-9])",
    "i",
  ).test(text);
}

function skillMatchesInput(skill: AstraSkill, input: string) {
  if (!skill.triggers || skill.triggers.length === 0) return true;
  const clean = input.trim();
  if (!clean) return false;
  return skill.triggers.some((trigger) => hasTrigger(clean, trigger));
}

export async function getSkillContext(
  agent: AstraAgentKey,
  input = "",
): Promise<AstraSkillContext> {
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

  const skills = BUILTIN_SKILLS.filter(
    (skill) =>
      skill.agents.includes(agent) &&
      skillMatchesInput(skill, input),
  );
  const source = skillsPath();

  try {
    const raw = await readFile(source, "utf8");
    const local = normalizeLocalSkills(JSON.parse(raw) as unknown).filter(
      (skill) =>
        skill.agents.includes(agent) &&
        skillMatchesInput(skill, input),
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
