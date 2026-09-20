import { ASTRA_AGENT_MAP } from "@/lib/agent/roster";
import type { AstraAgentKey } from "@/lib/agent/types";
import { chatWithOllama } from "@/lib/brain/ollama";
import type { AstraPlan, AstraPlanStepDraft, AstraPlanStepKind } from "./contracts";
import { createBoundedPlan } from "./planner";

const PLAN_KINDS = new Set<AstraPlanStepKind>([
  "inspect",
  "memory",
  "research",
  "reason",
  "tool",
  "verify",
  "approval",
]);

const AGENT_KEYS = new Set<AstraAgentKey>([
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
]);

const ACTION_WORDS = [
  "cek",
  "periksa",
  "inspect",
  "review",
  "cari",
  "search",
  "research",
  "riset",
  "buat",
  "create",
  "build",
  "perbaiki",
  "fix",
  "debug",
  "test",
  "uji",
  "siapkan",
  "prepare",
  "update",
  "ubah",
  "edit",
  "kirim",
  "send",
  "push",
  "deploy",
  "analisis",
  "analyze",
  "bandingkan",
  "compare",
];

const EXPLICIT_PLAN_WORDS = [
  "rencana",
  "plan",
  "planning",
  "roadmap",
  "langkah",
  "steps",
  "strategi",
  "strategy",
  "workflow",
  "milestone",
  "kampanye",
  "campaign",
];

function hasWord(text: string, word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(text);
}

export function shouldGeneratePlan(input: string): boolean {
  const text = input.trim().toLowerCase();
  if (!text) return false;

  if (EXPLICIT_PLAN_WORDS.some((word) => hasWord(text, word))) return true;

  const actionCount = ACTION_WORDS.filter((word) => hasWord(text, word)).length;
  const connectorCount = [
    /\blalu\b/i,
    /\bkemudian\b/i,
    /\bsetelah itu\b/i,
    /\bthen\b/i,
    /\band then\b/i,
    /,/,
    /;/,
  ].filter((pattern) => pattern.test(text)).length;

  return actionCount >= 3 || (actionCount >= 2 && connectorCount >= 1);
}

function extractJsonObject(message: string): unknown {
  const trimmed = message.trim();
  const unfenced = trimmed
    .replace(/^~~~(?:json)?\s*/i, "")
    .replace(/\s*~~~$/i, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced) as unknown;
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start < 0 || end <= start) {
      throw new Error("Planner provider did not return a JSON object.");
    }
    try {
      return JSON.parse(unfenced.slice(start, end + 1)) as unknown;
    } catch {
      throw new Error("Planner provider returned invalid JSON.");
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function defaultPermissionForStep(
  kind: AstraPlanStepKind,
  agent: AstraAgentKey | undefined,
  title: string,
) {
  const highImpact =
    /(?:delete|hapus|admin|administrator|credential|password|secret|live trade|place trade|close trade|withdraw)/i.test(
      title,
    );

  if (highImpact) return 4;

  switch (kind) {
    case "reason":
      return 0;
    case "inspect":
    case "memory":
    case "research":
    case "verify":
      return 1;
    case "tool":
      if (agent === "trading") return 4;
      if (
        agent === "github" ||
        agent === "communication" ||
        agent === "business"
      ) {
        return 3;
      }
      return 2;
    case "approval":
      return 3;
  }
}

function normalizedPermission(
  value: unknown,
  kind: AstraPlanStepKind,
  agent: AstraAgentKey | undefined,
  title: string,
) {
  const floor = defaultPermissionForStep(kind, agent, title);
  const parsed =
    typeof value === "number" && Number.isFinite(value)
      ? Math.floor(value)
      : floor;
  return Math.max(floor, Math.min(4, parsed)) as 0 | 1 | 2 | 3 | 4;
}

function normalizeAgent(value: unknown): AstraAgentKey | undefined {
  if (typeof value !== "string") return undefined;
  return AGENT_KEYS.has(value as AstraAgentKey)
    ? (value as AstraAgentKey)
    : undefined;
}

function normalizeDraft(value: unknown, index: number): AstraPlanStepDraft | null {
  if (!isObject(value)) return null;

  const title = typeof value.title === "string" ? value.title.trim() : "";
  const kind = typeof value.kind === "string" ? value.kind : "";

  if (!title || !PLAN_KINDS.has(kind as AstraPlanStepKind)) return null;

  const dependsOn = Array.isArray(value.dependsOn)
    ? value.dependsOn.filter((item): item is string => typeof item === "string")
    : undefined;

  const agent = normalizeAgent(value.agent);

  return {
    id:
      typeof value.id === "string" && value.id.trim()
        ? value.id.trim()
        : `step-${index + 1}`,
    title,
    kind: kind as AstraPlanStepKind,
    agent,
    permissionLevel: normalizedPermission(
      value.permissionLevel,
      kind as AstraPlanStepKind,
      agent,
      title,
    ),
    dependsOn,
    timeoutMs:
      typeof value.timeoutMs === "number" && Number.isFinite(value.timeoutMs)
        ? value.timeoutMs
        : undefined,
    maxRetries:
      typeof value.maxRetries === "number" && Number.isFinite(value.maxRetries)
        ? value.maxRetries
        : undefined,
  };
}

export function parsePlannerDraft(message: string): AstraPlanStepDraft[] {
  const payload = extractJsonObject(message);
  if (!isObject(payload) || !Array.isArray(payload.steps)) {
    throw new Error("Planner response must contain a steps array.");
  }

  const steps = payload.steps
    .slice(0, 20)
    .map(normalizeDraft)
    .filter((step): step is AstraPlanStepDraft => Boolean(step));

  if (steps.length === 0) {
    throw new Error("Planner response contained no valid steps.");
  }

  return steps;
}

export type AstraGeneratedPlan = {
  plan: AstraPlan;
  provider: "ollama";
  model: string;
};

export async function generateStrategistPlan({
  goal,
  projectId,
  context,
  signal,
}: {
  goal: string;
  projectId?: string;
  context?: string;
  signal?: AbortSignal;
}): Promise<AstraGeneratedPlan> {
  const cleanGoal = goal.trim();
  if (!cleanGoal) throw new Error("Planner goal is required.");

  const plannerInstructions = [
    "ASTRA STRATEGIST PLANNER MODE.",
    "Return JSON only. No markdown and no prose outside JSON.",
    "Schema:",
    '{"steps":[{"id":"step-1","title":"...","kind":"inspect|memory|research|reason|tool|verify|approval","agent":"chief_of_staff|memory|researcher|developer|computer|files|github|communication|business|trading","permissionLevel":0,"dependsOn":[],"timeoutMs":30000,"maxRetries":0}]}',
    "Create the smallest useful plan, normally 2-8 steps.",
    "Do not claim any step has executed.",
    "Use inspect/memory/research/reason before side-effecting tool steps when appropriate.",
    "Include a verify step after meaningful modifications or external actions.",
    "Permission guidance: 0 reasoning only, 1 read, 2 safe local action, 3 external write/action, 4 high-impact.",
    "Never lower a risky action's permission to make it easier to run.",
    "Dependencies may reference only earlier step ids.",
    context ? `Bounded ASTRA context:\\n${context}` : "",
  ]
    .filter(Boolean)
    .join("\\n");

  const result = await chatWithOllama({
    input: `ASTRA_PLAN_REQUEST\\nGoal: ${cleanGoal}`,
    agent: ASTRA_AGENT_MAP.chief_of_staff,
    context: plannerInstructions,
    policyText:
      "Planning is read-only. Do not execute tools or claim side effects. Output a proposed plan only.",
    signal,
  });

  const drafts = parsePlannerDraft(result.message);
  const plan = createBoundedPlan(cleanGoal, drafts, { projectId });

  return {
    plan,
    provider: "ollama",
    model: result.model,
  };
}
