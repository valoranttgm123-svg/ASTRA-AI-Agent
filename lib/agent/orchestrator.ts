import { ASTRA_AGENT_MAP } from "./roster";
import type { AgentResponse, AstraAgentKey } from "./types";

const RULES: Array<{ agent: AstraAgentKey; words: string[] }> = [
  {
    agent: "business",
    words: [
      "finance", "financial", "keuangan", "margin", "markup", "laba", "profit",
      "biaya", "budget", "anggaran", "harga jual", "break even", "bep",
      "sales", "penjualan", "lead", "prospek", "quotation", "penawaran",
      "follow up", "follow-up", "pipeline", "closing",
      "marketing", "kampanye", "campaign", "promosi", "positioning", "branding", "iklan",
      "ops", "operasional", "operations", "workflow", "checklist", "supplier", "inventory",
      "editor", "proofread", "proofreading", "rewrite", "tulis ulang", "revisi", "copywriting",
      "analytics", "analitik", "kpi", "metric", "metrics", "metrik", "trend", "tren", "anomali",
      "social", "sosial", "caption", "instagram", "tiktok", "facebook", "reel", "reels", "konten",
      "design", "desain", "visual", "poster", "banner", "thumbnail",
    ],
  },
  { agent: "github", words: ["github", "repo", "repository", "branch", "commit", "pull request", "pr"] },
  { agent: "developer", words: ["code", "coding", "bug", "error", "debug", "build", "typescript", "javascript", "python"] },
  { agent: "researcher", words: ["research", "riset", "cari", "search", "compare", "bandingkan", "internet"] },
  { agent: "files", words: ["file", "folder", "dokumen", "document", "pdf", "word"] },
  { agent: "communication", words: ["email", "gmail", "calendar", "kalender", "meeting", "jadwal"] },
  { agent: "business", words: ["bisnis", "business", "pos", "kasir", "alurka", "hasbi", "harga", "sales"] },
  { agent: "trading", words: ["trading", "xau", "gold", "btc", "market", "mt5", "smc"] },
  { agent: "computer", words: ["komputer", "computer", "pc", "powershell", "terminal", "windows", "buka aplikasi"] },
  { agent: "memory", words: ["ingat", "remember", "memory", "sebelumnya", "kemarin"] },
];

export function selectAgent(message: string): AstraAgentKey {
  const text = message.toLowerCase();
  for (const rule of RULES) {
    if (rule.words.some((word) => new RegExp(`(?:^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`, "i").test(text))) return rule.agent;
  }
  return "chief_of_staff";
}

export async function runAgent(message: string): Promise<AgentResponse> {
  const agentKey = selectAgent(message);
  const agent = ASTRA_AGENT_MAP[agentKey];

  // V1 deliberately has no embedded secrets or vendor-specific API calls.
  // Providers/tools are connected behind this orchestrator in later phases.
  return {
    ok: true,
    agent: agentKey,
    agentName: agent.name,
    state: "needs_provider",
    message: `${agent.name} menerima tugas: “${message}”. ASTRA Core sudah aktif, tetapi model/tool provider belum dikonfigurasi untuk mengeksekusi tugas ini.`,
    requiresApproval: false,
  };
}
