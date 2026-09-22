import type { AstraAgentKey } from "@/lib/agent/types";

export type NvidiaIntegrationKey =
  | "jarvis_model_mesh"
  | "skill_hub"
  | "aiq_research"
  | "nemo_retriever_rag"
  | "document_intelligence"
  | "voice_agent"
  | "vision_stack"
  | "hermes_nemoclaw"
  | "nemo_guardrails"
  | "nemo_evaluation";

export type NvidiaIntegrationStage =
  | "implemented"
  | "foundation"
  | "planned"
  | "target_pc_required";

export type NvidiaAuthority =
  | "reasoning_only"
  | "advisory_only"
  | "read_only"
  | "tool_runtime_only";

export type NvidiaIntegrationDefinition = {
  key: NvidiaIntegrationKey;
  label: string;
  role: string;
  stage: NvidiaIntegrationStage;
  authority: NvidiaAuthority;
  agents: AstraAgentKey[];
  roadmapPhases: number[];
  dependencies: string[];
  exitGate: string;
};

export const NVIDIA_INTEGRATION_REGISTRY: NvidiaIntegrationDefinition[] = [
  {
    key: "jarvis_model_mesh",
    label: "NVIDIA JARVIS Model Mesh",
    role: "Adaptive Chief / Deep / Fast / Vision reasoning profiles.",
    stage: "implemented",
    authority: "reasoning_only",
    agents: [
      "chief_of_staff",
      "researcher",
      "developer",
      "github",
      "memory",
      "business",
      "trading",
    ],
    roadmapPhases: [20, 30],
    dependencies: ["NVIDIA NIM provider", "private target-PC credential"],
    exitGate:
      "Repository tests stay green and the configured hosted mesh passes live target-PC status checks.",
  },
  {
    key: "skill_hub",
    label: "NVIDIA Skill Hub",
    role: "Discover, rank, and activate only relevant NVIDIA agent skills on demand.",
    stage: "foundation",
    authority: "advisory_only",
    agents: ["chief_of_staff", "developer", "github", "researcher"],
    roadmapPhases: [29, 30],
    dependencies: ["official NVIDIA skill catalog", "ASTRA skill router"],
    exitGate:
      "Catalog discovery is bounded, skill selection is deterministic, installed skills are provenance-tracked, and no skill bypasses ASTRA permissions.",
  },
  {
    key: "aiq_research",
    label: "AI-Q Research Engine",
    role: "Parallel planner/researcher/writer backend for deep, source-backed research.",
    stage: "planned",
    authority: "read_only",
    agents: ["researcher", "chief_of_staff"],
    roadmapPhases: [24, 25, 30],
    dependencies: ["reachable AI-Q backend", "research provenance contract"],
    exitGate:
      "AI-Q health, cancellation, bounded worker count, citations/provenance, and fallback behavior are verified end to end.",
  },
  {
    key: "nemo_retriever_rag",
    label: "NeMo Retriever + RAG",
    role: "Retrieval/reranking layer under Sonor for project and document knowledge.",
    stage: "planned",
    authority: "read_only",
    agents: ["memory", "researcher", "files"],
    roadmapPhases: [26, 30],
    dependencies: ["real Sonor bridge", "NeMo Retriever or RAG endpoint"],
    exitGate:
      "Sonor remains canonical memory, retrieval provenance is preserved, project isolation holds, and unavailable NVIDIA retrieval degrades safely.",
  },
  {
    key: "document_intelligence",
    label: "NVIDIA Document Intelligence",
    role: "OCR, layout, table, and document extraction before retrieval/memory ingestion.",
    stage: "planned",
    authority: "read_only",
    agents: ["files", "memory", "researcher"],
    roadmapPhases: [23, 26, 30],
    dependencies: ["approved document source", "OCR/parser service"],
    exitGate:
      "Extraction is bounded, source-linked, tested on representative documents, and never overwrites originals.",
  },
  {
    key: "voice_agent",
    label: "Nemotron Voice Agent",
    role: "VAD/EOU + ASR + reasoning + TTS with interruption and truthful voice state.",
    stage: "planned",
    authority: "reasoning_only",
    agents: ["chief_of_staff", "communication"],
    roadmapPhases: [21, 30],
    dependencies: ["microphone consent", "ASR/TTS transport"],
    exitGate:
      "Real microphone/audio evidence proves listen/thinking/speaking transitions, interruption, STOP, latency, and graceful fallback.",
  },
  {
    key: "vision_stack",
    label: "DeepStream + VSS Vision Stack",
    role: "Approved camera/screen/video perception, tracking, search, summarization, and visual Q&A.",
    stage: "planned",
    authority: "read_only",
    agents: ["computer", "researcher", "chief_of_staff"],
    roadmapPhases: [23, 30],
    dependencies: ["camera/screen consent", "real visual payload transport"],
    exitGate:
      "Real pixels—not metadata—reach the vision path; consent, cancellation, provenance, latency, and no-fake-perception tests pass.",
  },
  {
    key: "hermes_nemoclaw",
    label: "NemoClaw for Hermes",
    role: "Convert repeated approved workflows into governed reusable Hermes skills.",
    stage: "planned",
    authority: "tool_runtime_only",
    agents: ["chief_of_staff", "developer", "computer"],
    roadmapPhases: [25, 29, 30],
    dependencies: ["working Hermes runtime", "skill governance", "ASTRA approval model"],
    exitGate:
      "Learned workflows remain scoped, reviewable, revocable, provenance-tracked, and cannot raise their own permission level.",
  },
  {
    key: "nemo_guardrails",
    label: "NeMo Guardrails + Content Safety",
    role: "Defense-in-depth checks for input, retrieval, tool traffic, output, PII, jailbreak, and content safety.",
    stage: "planned",
    authority: "advisory_only",
    agents: ["chief_of_staff"],
    roadmapPhases: [22, 28, 30],
    dependencies: ["guardrail config", "ASTRA policy and Tool Runtime"],
    exitGate:
      "Guardrails are regression-tested without becoming the authorization authority; ASTRA Tool Runtime remains final execution control.",
  },
  {
    key: "nemo_evaluation",
    label: "NeMo Evaluation / Quality Lab",
    role: "Measure RAG quality, agent quality, safety, latency, and regression before promotion.",
    stage: "planned",
    authority: "advisory_only",
    agents: ["chief_of_staff", "researcher", "developer"],
    roadmapPhases: [28, 30],
    dependencies: ["repeatable evaluation datasets", "private evidence store"],
    exitGate:
      "Evaluation produces reproducible evidence tied to exact runtime/build identity and cannot self-promote a release.",
  },
];

export const NVIDIA_INTEGRATION_MAP = Object.fromEntries(
  NVIDIA_INTEGRATION_REGISTRY.map((integration) => [
    integration.key,
    integration,
  ]),
) as Record<NvidiaIntegrationKey, NvidiaIntegrationDefinition>;

export function nvidiaIntegrationsForPhase(phase: number) {
  return NVIDIA_INTEGRATION_REGISTRY.filter((integration) =>
    integration.roadmapPhases.includes(phase),
  );
}

export function nvidiaRepositoryReadyIntegrations() {
  return NVIDIA_INTEGRATION_REGISTRY.filter(
    (integration) =>
      integration.stage === "implemented" ||
      integration.stage === "foundation",
  );
}
