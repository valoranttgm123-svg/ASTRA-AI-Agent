import assert from "node:assert/strict";
import { test } from "node:test";

import {
  NVIDIA_INTEGRATION_MAP,
  NVIDIA_INTEGRATION_REGISTRY,
  nvidiaIntegrationsForPhase,
  nvidiaRepositoryReadyIntegrations,
} from "../lib/nvidia/catalog";
import {
  NVIDIA_CORE_SKILLS,
  NVIDIA_SKILL_HUB_POLICY,
  recommendNvidiaSkills,
} from "../lib/nvidia/skill-hub";

test("NVIDIA MAX registry has one unique definition per subsystem", () => {
  const keys = NVIDIA_INTEGRATION_REGISTRY.map((entry) => entry.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(NVIDIA_INTEGRATION_MAP.jarvis_model_mesh.stage, "implemented");
  assert.equal(NVIDIA_INTEGRATION_MAP.skill_hub.stage, "foundation");
});

test("NVIDIA integrations never claim direct execution authority", () => {
  for (const integration of NVIDIA_INTEGRATION_REGISTRY) {
    assert.notEqual(integration.authority, "execute");
  }
  assert.equal(
    NVIDIA_INTEGRATION_MAP.hermes_nemoclaw.authority,
    "tool_runtime_only",
  );
  assert.equal(
    NVIDIA_INTEGRATION_MAP.nemo_guardrails.authority,
    "advisory_only",
  );
});

test("Phase 30 includes the complete NVIDIA integration registry", () => {
  const phase30 = nvidiaIntegrationsForPhase(30);
  assert.equal(phase30.length, NVIDIA_INTEGRATION_REGISTRY.length);
});

test("repository-ready NVIDIA set is conservative", () => {
  const ready = nvidiaRepositoryReadyIntegrations().map((entry) => entry.key);
  assert.deepEqual(ready.sort(), ["jarvis_model_mesh", "skill_hub"].sort());
});

test("NVIDIA Skill Hub is discoverable/on-demand and never execution authority", () => {
  assert.equal(NVIDIA_SKILL_HUB_POLICY.installMode, "on_demand");
  assert.equal(
    NVIDIA_SKILL_HUB_POLICY.catalogMode,
    "discoverable_not_eagerly_loaded",
  );
  assert.equal(NVIDIA_SKILL_HUB_POLICY.executionAuthority, false);
  assert.ok(NVIDIA_CORE_SKILLS.length >= 10);
});

test("research routes to AI-Q research skill", () => {
  const selected = recommendNvidiaSkills({
    input: "Lakukan deep research dengan sumber tentang agentic AI",
    agent: "researcher",
  });
  assert.ok(selected.some((skill) => skill.id === "aiq-research"));
  assert.ok(selected.length <= 3);
});

test("document retrieval routes to NeMo Retriever/RAG skills", () => {
  const selected = recommendNvidiaSkills({
    input: "Cari informasi dari PDF dan document knowledge base dengan retriever",
    agent: "memory",
  });
  assert.ok(selected.some((skill) => skill.id === "nemo-retriever"));
  assert.ok(selected.some((skill) => skill.category === "rag"));
});

test("vision and voice skills remain specialist selections", () => {
  const vision = recommendNvidiaSkills({
    input: "Bangun DeepStream camera object detection dan tracking",
    agent: "developer",
  });
  assert.ok(vision.some((skill) => skill.id === "deepstream-dev"));

  const voice = recommendNvidiaSkills({
    input: "Tambahkan voice ASR dan TTS untuk ASTRA",
    agent: "chief_of_staff",
  });
  assert.ok(voice.some((skill) => skill.id === "nemotron-speech"));
});

test("blank input activates no NVIDIA skill", () => {
  assert.deepEqual(
    recommendNvidiaSkills({ input: "  ", agent: "chief_of_staff" }),
    [],
  );
});
