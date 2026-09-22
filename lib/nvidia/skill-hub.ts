import type { AstraAgentKey } from "@/lib/agent/types";

export type NvidiaSkillCategory =
  | "research"
  | "rag"
  | "vision"
  | "speech"
  | "safety"
  | "governance"
  | "data"
  | "model_customization";

export type NvidiaSkillManifest = {
  id: string;
  category: NvidiaSkillCategory;
  agents: AstraAgentKey[];
  triggers: string[];
  purpose: string;
  core: boolean;
};

export const NVIDIA_SKILL_HUB_POLICY = {
  source: "https://build.nvidia.com/skills",
  executionAuthority: false,
  maxRecommendedPerRequest: 3,
  installMode: "on_demand" as const,
  catalogMode: "discoverable_not_eagerly_loaded" as const,
};

export const NVIDIA_CORE_SKILLS: NvidiaSkillManifest[] = [
  {
    id: "aiq-research",
    category: "research",
    agents: ["researcher", "chief_of_staff"],
    triggers: ["research", "riset", "deep research", "investigate", "sources"],
    purpose: "Run deep research through a reachable NVIDIA AI-Q backend.",
    core: true,
  },
  {
    id: "aiq-deploy",
    category: "research",
    agents: ["developer", "github"],
    triggers: ["ai-q", "aiq", "deploy research", "research backend"],
    purpose: "Install, deploy, validate, troubleshoot, or stop AI-Q infrastructure.",
    core: true,
  },
  {
    id: "rag-blueprint",
    category: "rag",
    agents: ["memory", "developer", "researcher"],
    triggers: ["rag", "retrieval", "knowledge base", "semantic search"],
    purpose: "Deploy, configure, troubleshoot, and manage NVIDIA RAG Blueprint services.",
    core: true,
  },
  {
    id: "nemo-retriever",
    category: "rag",
    agents: ["memory", "researcher", "files"],
    triggers: ["pdf", "document", "dokumen", "retriever", "search memory", "ingest"],
    purpose: "Search, extract, ingest, or query document collections through NeMo Retriever.",
    core: true,
  },
  {
    id: "rag-eval",
    category: "rag",
    agents: ["developer", "researcher", "memory"],
    triggers: ["rag quality", "rag eval", "ragas", "retrieval accuracy"],
    purpose: "Evaluate filesystem RAG quality with a repeatable benchmark.",
    core: true,
  },
  {
    id: "rag-perf",
    category: "rag",
    agents: ["developer", "memory"],
    triggers: ["rag performance", "rag perf", "latency", "throughput", "benchmark rag"],
    purpose: "Benchmark deployed NVIDIA RAG Blueprint performance.",
    core: true,
  },
  {
    id: "nemotron-retrieval-recipes",
    category: "rag",
    agents: ["developer", "memory"],
    triggers: ["embedding", "rerank", "retrieval recipe", "tune retrieval"],
    purpose: "Plan, tune, evaluate, export, and deploy Nemotron retrieval recipes.",
    core: true,
  },
  {
    id: "deepstream-dev",
    category: "vision",
    agents: ["developer", "computer"],
    triggers: ["deepstream", "camera", "video analytics", "tracking", "object detection"],
    purpose: "Build DeepStream video analytics and inference pipelines.",
    core: true,
  },
  {
    id: "deepstream-import-vision-model",
    category: "vision",
    agents: ["developer", "computer"],
    triggers: ["import vision model", "onnx vision", "tensorrt vision", "deepstream model"],
    purpose: "Bring supported object-detection models into DeepStream pipelines.",
    core: true,
  },
  {
    id: "nemotron-speech",
    category: "speech",
    agents: ["developer", "communication", "chief_of_staff"],
    triggers: ["speech", "voice", "asr", "tts", "transcribe", "speak"],
    purpose: "Deploy, run, and test Nemotron Speech ASR/TTS/NMT workflows.",
    core: true,
  },
  {
    id: "nemotron-policy-generator",
    category: "safety",
    agents: ["developer", "chief_of_staff"],
    triggers: ["safety policy", "content safety", "guardrail policy", "moderation policy"],
    purpose: "Generate custom policies for Nemotron content-safety guardrails.",
    core: true,
  },
  {
    id: "skill-card-generator",
    category: "governance",
    agents: ["developer", "github", "chief_of_staff"],
    triggers: ["skill card", "skill governance", "document skill"],
    purpose: "Generate or update governance cards for existing agent skills.",
    core: true,
  },
  {
    id: "data-designer",
    category: "data",
    agents: ["developer", "researcher"],
    triggers: ["synthetic data", "dataset", "generate dataset", "test dataset"],
    purpose: "Create datasets and synthetic-data pipelines for evaluation.",
    core: true,
  },
  {
    id: "nemotron-customize",
    category: "model_customization",
    agents: ["developer", "researcher"],
    triggers: ["fine tune", "finetune", "peft", "sft", "model customization", "train model"],
    purpose: "Plan and chain Nemotron model customization workflows.",
    core: false,
  },
];

function normalizedText(value: string) {
  return value.trim().toLowerCase();
}

function triggerScore(input: string, trigger: string) {
  const text = normalizedText(input);
  const term = normalizedText(trigger);
  if (!text || !term) return 0;
  if (text === term) return 5;
  if (text.includes(term)) return term.includes(" ") ? 4 : 2;
  return 0;
}

export function recommendNvidiaSkills({
  input,
  agent,
  limit = NVIDIA_SKILL_HUB_POLICY.maxRecommendedPerRequest,
}: {
  input: string;
  agent: AstraAgentKey;
  limit?: number;
}) {
  const boundedLimit = Math.max(0, Math.min(5, Math.floor(limit)));
  if (!input.trim() || boundedLimit === 0) return [];

  return NVIDIA_CORE_SKILLS.map((skill) => {
    const agentScore = skill.agents.includes(agent) ? 3 : 0;
    const trigger = skill.triggers.reduce(
      (score, candidate) => Math.max(score, triggerScore(input, candidate)),
      0,
    );
    return {
      skill,
      score: agentScore + trigger,
    };
  })
    .filter((candidate) => candidate.score >= 5)
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(right.skill.core) - Number(left.skill.core) ||
        left.skill.id.localeCompare(right.skill.id),
    )
    .slice(0, boundedLimit)
    .map((candidate) => candidate.skill);
}

export function nvidiaSkillById(id: string) {
  return NVIDIA_CORE_SKILLS.find((skill) => skill.id === id);
}
