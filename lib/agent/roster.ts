import type { AstraAgent } from "./types";

export const ASTRA_AGENTS: AstraAgent[] = [
  { key: "chief_of_staff", name: "Chief", role: "Routes work and coordinates specialists", capabilities: ["task routing", "planning", "approval gates"] },
  { key: "memory", name: "Memory", role: "Stores durable project context", capabilities: ["project context", "decisions", "preferences"] },
  { key: "researcher", name: "Research", role: "Researches public information and sources", capabilities: ["web research", "comparison", "source summaries"] },
  { key: "developer", name: "Developer", role: "Builds, reviews, and debugs software", capabilities: ["coding", "debugging", "architecture"] },
  { key: "computer", name: "Computer", role: "Controls approved desktop actions", capabilities: ["desktop automation", "app control", "terminal tasks"] },
  { key: "files", name: "Files", role: "Reads and organizes project files", capabilities: ["file search", "document reading", "organization"] },
  { key: "github", name: "GitHub", role: "Works with repositories and code review", capabilities: ["repositories", "branches", "pull requests"] },
  { key: "communication", name: "Communication", role: "Handles approved email and calendar workflows", capabilities: ["email", "calendar", "contacts"] },
  { key: "business", name: "Business", role: "Supports business operations and POS workflows", capabilities: ["operations", "pricing", "sales support"] },
  { key: "trading", name: "Trading", role: "Supports market analysis and trading tooling", capabilities: ["market analysis", "risk tooling", "trade journaling"] },
];

export const ASTRA_AGENT_MAP = Object.fromEntries(
  ASTRA_AGENTS.map((agent) => [agent.key, agent]),
) as Record<AstraAgent["key"], AstraAgent>;
