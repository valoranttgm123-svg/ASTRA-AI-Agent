import type { AstraAgentKey } from "./types";

export type AstraCapabilityNodeKey =
  | "chief_of_staff"
  | "memory"
  | "strategist"
  | "researcher"
  | "finance"
  | "editor"
  | "sales"
  | "marketing"
  | "ops"
  | "social_media"
  | "engineering"
  | "design"
  | "developer"
  | "analytics"
  | "crm"
  | "calendar"
  | "email"
  | "drive";

export type AstraCapabilityState =
  | "READY"
  | "ACTIVE"
  | "WAITING_APPROVAL"
  | "BLOCKED"
  | "OFFLINE"
  | "NOT_CONFIGURED"
  | "ERROR";

export type AstraCapabilityKind = "agent" | "skill" | "tool" | "integration";
export type AstraCapabilityImplementation = "implemented" | "partial" | "planned";
export type AstraCapabilityLayer = "consultant" | "doer" | "tool";
export type AstraPermissionLevel = 0 | 1 | 2 | 3 | 4;

export type AstraCapabilityNode = {
  key: AstraCapabilityNodeKey;
  label: string;
  layer: AstraCapabilityLayer;
  kind: AstraCapabilityKind;
  role: string;
  capabilities: string[];
  examples?: string[];
  executionAgent?: AstraAgentKey;
  permissionLevel: AstraPermissionLevel;
  implementation: AstraCapabilityImplementation;
  defaultState: AstraCapabilityState;
  requiresConfiguration: boolean;
  color: string;
  visual: {
    x: number;
    y: number;
    live: boolean;
    bend: number;
    radius: number;
  };
};

const CYAN = "#00e5ff";
const ORANGE = "#f5a623";
const SLATE = "#7f9bb3";

export const ASTRA_CAPABILITY_NODES: readonly AstraCapabilityNode[] = [
  {
    key: "chief_of_staff",
    label: "Chief of staff",
    layer: "consultant",
    kind: "agent",
    role: "Coordinates goals, routing, permissions, and final results",
    capabilities: ["task routing", "provider coordination", "approval gates"],
    examples: ["What needs attention today?", "Continue the current project"],
    executionAgent: "chief_of_staff",
    permissionLevel: 1,
    implementation: "implemented",
    defaultState: "READY",
    requiresConfiguration: false,
    color: CYAN,
    visual: { x: 250, y: 212, live: true, bend: 18, radius: 9 },
  },
  {
    key: "memory",
    label: "Memory",
    layer: "consultant",
    kind: "agent",
    role: "Retrieves bounded durable local context with provenance",
    capabilities: ["local memory retrieval", "project context", "decision context"],
    examples: ["What did we decide?", "Recall the last ASTRA work"],
    executionAgent: "memory",
    permissionLevel: 1,
    implementation: "implemented",
    defaultState: "READY",
    requiresConfiguration: false,
    color: CYAN,
    visual: { x: 452, y: 250, live: true, bend: -18, radius: 8 },
  },
  {
    key: "strategist",
    label: "Strategist",
    layer: "consultant",
    kind: "agent",
    role: "Plans milestones, priorities, dependencies, and risk",
    capabilities: ["roadmaps", "prioritization", "dependency planning"],
    examples: ["Build a roadmap", "What should we do next?"],
    permissionLevel: 1,
    implementation: "partial",
    defaultState: "NOT_CONFIGURED",
    requiresConfiguration: true,
    color: CYAN,
    visual: { x: 296, y: 118, live: true, bend: -22, radius: 6.5 },
  },
  {
    key: "researcher",
    label: "Researcher",
    layer: "consultant",
    kind: "agent",
    role: "Researches public information with source provenance",
    capabilities: ["web research", "comparison", "source summaries"],
    examples: ["Research this market", "Compare these options"],
    executionAgent: "researcher",
    permissionLevel: 1,
    implementation: "implemented",
    defaultState: "NOT_CONFIGURED",
    requiresConfiguration: true,
    color: CYAN,
    visual: { x: 182, y: 150, live: true, bend: 24, radius: 6.5 },
  },
  {
    key: "finance",
    label: "Finance",
    layer: "consultant",
    kind: "skill",
    role: "Business finance, pricing, margin, budget, and POS analysis",
    capabilities: ["pricing", "margin analysis", "business finance"],
    examples: ["Check this margin", "Summarize this month's performance"],
    executionAgent: "business",
    permissionLevel: 1,
    implementation: "implemented",
    defaultState: "READY",
    requiresConfiguration: false,
    color: CYAN,
    visual: { x: 436, y: 148, live: true, bend: -20, radius: 6.5 },
  },
  {
    key: "editor",
    label: "Editor",
    layer: "consultant",
    kind: "skill",
    role: "Reviews and improves writing before it is used externally",
    capabilities: ["proofreading", "rewriting", "quality gate"],
    examples: ["Polish this draft", "Review this email"],
    executionAgent: "business",
    permissionLevel: 0,
    implementation: "implemented",
    defaultState: "READY",
    requiresConfiguration: false,
    color: CYAN,
    visual: { x: 584, y: 208, live: true, bend: -26, radius: 6.5 },
  },
  {
    key: "sales",
    label: "Sales",
    layer: "doer",
    kind: "skill",
    role: "Sales follow-up, quotation, and pipeline support",
    capabilities: ["sales messaging", "quotation support", "pipeline analysis"],
    examples: ["Draft a follow-up", "Prepare a quotation"],
    executionAgent: "business",
    permissionLevel: 1,
    implementation: "implemented",
    defaultState: "READY",
    requiresConfiguration: false,
    color: ORANGE,
    visual: { x: 158, y: 266, live: true, bend: 22, radius: 6.5 },
  },
  {
    key: "marketing",
    label: "Marketing",
    layer: "doer",
    kind: "skill",
    role: "Campaign planning, positioning, promotions, and content strategy",
    capabilities: ["campaign planning", "positioning", "marketing calendar"],
    examples: ["Build an ALURKA campaign", "Plan this week's promotion"],
    executionAgent: "business",
    permissionLevel: 1,
    implementation: "implemented",
    defaultState: "READY",
    requiresConfiguration: false,
    color: ORANGE,
    visual: { x: 195, y: 298, live: true, bend: 22, radius: 6.5 },
  },
  {
    key: "ops",
    label: "Ops",
    layer: "doer",
    kind: "agent",
    role: "Business operations planning, workflows, checklists, and coordination",
    capabilities: ["operations support", "workflow coordination", "checklists and process design"],
    examples: ["Build an operations checklist", "Improve this workflow"],
    executionAgent: "business",
    permissionLevel: 1,
    implementation: "implemented",
    defaultState: "READY",
    requiresConfiguration: false,
    color: ORANGE,
    visual: { x: 232, y: 330, live: true, bend: 20, radius: 6.5 },
  },
  {
    key: "social_media",
    label: "Social",
    layer: "doer",
    kind: "skill",
    role: "Social content planning and publishing preparation",
    capabilities: ["captions", "content calendar", "video/reel scripts"],
    examples: ["Write a caption", "Plan a content week"],
    executionAgent: "business",
    permissionLevel: 1,
    implementation: "implemented",
    defaultState: "READY",
    requiresConfiguration: false,
    color: ORANGE,
    visual: { x: 330, y: 374, live: true, bend: -16, radius: 6.5 },
  },
  {
    key: "engineering",
    label: "Engineering",
    layer: "doer",
    kind: "skill",
    role: "Technical engineering calculations, diagnostics, and architecture",
    capabilities: ["technical diagnostics", "calculations", "system architecture"],
    examples: ["Review this technical issue", "Calculate tolerances"],
    executionAgent: "developer",
    permissionLevel: 1,
    implementation: "planned",
    defaultState: "NOT_CONFIGURED",
    requiresConfiguration: true,
    color: ORANGE,
    visual: { x: 426, y: 350, live: true, bend: -18, radius: 6.5 },
  },
  {
    key: "design",
    label: "Design",
    layer: "doer",
    kind: "tool",
    role: "Provider-neutral visual brief and asset-generation capability",
    capabilities: ["visual brief", "image generation", "image editing", "UI/visual preparation"],
    examples: ["Create a visual brief", "Generate a visual asset", "Edit this image"],
    executionAgent: "business",
    permissionLevel: 3,
    implementation: "partial",
    defaultState: "NOT_CONFIGURED",
    requiresConfiguration: true,
    color: ORANGE,
    visual: { x: 502, y: 312, live: true, bend: -22, radius: 6.5 },
  },
  {
    key: "developer",
    label: "Developer",
    layer: "doer",
    kind: "agent",
    role: "Software engineering through the ASTRA engineering route",
    capabilities: ["coding", "debugging", "tests and builds", "repository review"],
    examples: ["Fix this bug", "Test and prepare a PR"],
    executionAgent: "developer",
    permissionLevel: 2,
    implementation: "partial",
    defaultState: "NOT_CONFIGURED",
    requiresConfiguration: true,
    color: ORANGE,
    visual: { x: 118, y: 356, live: false, bend: 26, radius: 6 },
  },
  {
    key: "analytics",
    label: "Analytics",
    layer: "tool",
    kind: "tool",
    role: "Structured data analysis and metrics",
    capabilities: ["bounded structured-data analysis", "metrics", "trends and anomalies"],
    executionAgent: "business",
    permissionLevel: 1,
    implementation: "implemented",
    defaultState: "READY",
    requiresConfiguration: false,
    color: SLATE,
    visual: { x: 256, y: 388, live: true, bend: 20, radius: 5.5 },
  },
  {
    key: "crm",
    label: "CRM",
    layer: "tool",
    kind: "integration",
    role: "Customer and lead context through a configured CRM adapter",
    capabilities: ["customer lookup", "pipeline", "follow-up history"],
    permissionLevel: 3,
    implementation: "partial",
    defaultState: "NOT_CONFIGURED",
    requiresConfiguration: true,
    color: SLATE,
    visual: { x: 414, y: 392, live: true, bend: -18, radius: 5.5 },
  },
  {
    key: "calendar",
    label: "Calendar",
    layer: "tool",
    kind: "integration",
    role: "Calendar reading and approval-gated event actions",
    capabilities: ["schedule read", "availability", "event preparation"],
    executionAgent: "communication",
    permissionLevel: 3,
    implementation: "partial",
    defaultState: "NOT_CONFIGURED",
    requiresConfiguration: true,
    color: SLATE,
    visual: { x: 560, y: 356, live: true, bend: -24, radius: 5.5 },
  },
  {
    key: "email",
    label: "Email",
    layer: "tool",
    kind: "integration",
    role: "Email search, reading, drafts, and approval-gated actions",
    capabilities: ["email search", "summaries", "drafts"],
    executionAgent: "communication",
    permissionLevel: 3,
    implementation: "partial",
    defaultState: "NOT_CONFIGURED",
    requiresConfiguration: true,
    color: SLATE,
    visual: { x: 608, y: 286, live: false, bend: -26, radius: 5.5 },
  },
  {
    key: "drive",
    label: "Drive",
    layer: "tool",
    kind: "integration",
    role: "Registered file and cloud-drive access",
    capabilities: ["file search", "document retrieval", "controlled upload"],
    executionAgent: "files",
    permissionLevel: 3,
    implementation: "partial",
    defaultState: "NOT_CONFIGURED",
    requiresConfiguration: true,
    color: SLATE,
    visual: { x: 582, y: 132, live: false, bend: 24, radius: 5.5 },
  },
];

export const ASTRA_CAPABILITY_MAP = Object.fromEntries(
  ASTRA_CAPABILITY_NODES.map((node) => [node.key, node]),
) as Record<AstraCapabilityNodeKey, AstraCapabilityNode>;

export const ASTRA_REASONING_ROSTER = ASTRA_CAPABILITY_NODES.map((node) => [
  node.key,
  node.label,
  node.layer,
  node.visual.x,
  node.visual.y,
  node.visual.live,
  node.visual.bend,
  node.visual.radius,
] as const);

const VISUAL_NODE_BY_AGENT: Record<AstraAgentKey, AstraCapabilityNodeKey> = {
  chief_of_staff: "chief_of_staff",
  memory: "memory",
  researcher: "researcher",
  developer: "developer",
  computer: "ops",
  files: "drive",
  github: "developer",
  communication: "email",
  business: "ops",
  trading: "finance",
};

export function visualNodeForAgent(agent: AstraAgentKey): AstraCapabilityNodeKey {
  return VISUAL_NODE_BY_AGENT[agent];
}

const VISUAL_NODE_BY_SKILL: Record<string, AstraCapabilityNodeKey> = {
  "finance-analysis": "finance",
  "sales-support": "sales",
  "marketing-strategy": "marketing",
  "ops-workflow": "ops",
  "editor-quality": "editor",
  "analytics-interpretation": "analytics",
  "social-content": "social_media",
  "design-brief": "design",
};

export function visualNodeForSkill(
  skillId: string,
  fallbackAgent: AstraAgentKey,
): AstraCapabilityNodeKey {
  return VISUAL_NODE_BY_SKILL[skillId] ?? visualNodeForAgent(fallbackAgent);
}

export function capabilityStateLabel(state: AstraCapabilityState): string {
  switch (state) {
    case "READY":
      return "Ready";
    case "ACTIVE":
      return "Active";
    case "WAITING_APPROVAL":
      return "Waiting approval";
    case "BLOCKED":
      return "Blocked";
    case "OFFLINE":
      return "Offline";
    case "NOT_CONFIGURED":
      return "Not configured";
    case "ERROR":
      return "Error";
  }
}
