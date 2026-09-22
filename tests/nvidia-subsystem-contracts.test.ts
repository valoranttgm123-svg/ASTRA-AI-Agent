import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizeNvidiaAiqRequest,
  normalizeNvidiaAiqResult,
  runNvidiaAiqResearch,
} from "../lib/nvidia/aiq";
import {
  normalizeNvidiaRetrieverRequest,
  normalizeNvidiaRetrieverResult,
} from "../lib/nvidia/retriever";
import {
  normalizeNvidiaDocumentRequest,
  normalizeNvidiaDocumentResult,
} from "../lib/nvidia/document-intelligence";
import {
  nextNvidiaVoiceState,
} from "../lib/nvidia/voice";
import {
  validateNvidiaVisualPayload,
} from "../lib/nvidia/vision";
import {
  createNvidiaGuardrailDecision,
  createNvidiaLearnedSkillCandidate,
  normalizeNvidiaEvaluationManifest,
} from "../lib/nvidia/governance";

test("AI-Q request bounds workers/sources and result keeps public provenance", () => {
  const request = normalizeNvidiaAiqRequest({
    query: "deep research ASTRA",
    depth: "deep",
    maxWorkers: 99,
    maxSources: 99,
  });
  assert.equal(request.maxWorkers, 6);
  assert.equal(request.maxSources, 20);

  const result = normalizeNvidiaAiqResult({
    ok: true,
    provider: "fixture-aiq",
    detail: "ok",
    summary: "summary",
    sources: [
      {
        sourceId: "S1",
        title: "Public",
        url: "https://example.com/a",
        untrusted: true,
        provenance: {
          provider: "fixture-aiq",
          reference: "https://example.com/a",
        },
      },
      {
        sourceId: "S2",
        title: "Blocked credential URL",
        url: "https://user:pass@example.com/",
        untrusted: true,
        provenance: {
          provider: "fixture-aiq",
          reference: "https://example.com/",
        },
      },
    ],
  });
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].untrusted, true);
});

test("AI-Q falls back safely when provider is unavailable", async () => {
  const request = normalizeNvidiaAiqRequest({
    query: "research",
  });
  const result = await runNvidiaAiqResearch({
    request,
    provider: {
      provider: "fixture-aiq",
      status: async () => ({
        configured: true,
        available: false,
        provider: "fixture-aiq",
        detail: "offline",
      }),
      research: async () => {
        throw new Error("should not run");
      },
    },
    fallback: async () => ({
      ok: true,
      provider: "astra-research",
      detail: "fallback",
      summary: "fallback summary",
      sources: [],
    }),
  });
  assert.equal(result.usedFallback, true);
  assert.equal(result.result.provider, "astra-research");
});

test("Retriever preserves project/namespace isolation", () => {
  const request = normalizeNvidiaRetrieverRequest({
    query: "ALURKA",
    projectId: "alurka",
    namespace: "alurka",
    limit: 10,
  });
  const result = normalizeNvidiaRetrieverResult(
    {
      ok: true,
      provider: "fixture",
      detail: "ok",
      records: [
        {
          id: "good",
          text: "good",
          sourceType: "sonor",
          reference: "sonor:1",
          projectId: "alurka",
          namespace: "alurka",
          untrusted: true,
        },
        {
          id: "cross-project",
          text: "should drop",
          sourceType: "sonor",
          reference: "sonor:2",
          projectId: "other",
          namespace: "other",
          untrusted: true,
        },
      ],
    },
    request,
  );
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].projectId, "alurka");
});

test("Document Intelligence keeps original immutable and page bounded", () => {
  const request = normalizeNvidiaDocumentRequest({
    sourceId: "invoice.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1000,
    pageLimit: 2,
  });
  assert.equal(request.immutableOriginal, true);

  const result = normalizeNvidiaDocumentResult(
    {
      ok: true,
      provider: "fixture",
      detail: "ok",
      sourceId: "invoice.pdf",
      blocks: [
        {
          id: "p1",
          page: 1,
          kind: "table",
          text: "table",
          reference: "invoice.pdf#page=1",
        },
        {
          id: "p3",
          page: 3,
          kind: "text",
          text: "drop",
          reference: "invoice.pdf#page=3",
        },
      ],
    },
    request,
  );
  assert.equal(result.blocks.length, 1);
});

test("Voice STOP/interruption returns to idle and invalid transitions fail", () => {
  assert.equal(
    nextNvidiaVoiceState("speaking", {
      type: "voice.interrupted",
      at: Date.now(),
    }),
    "idle",
  );
  assert.throws(
    () =>
      nextNvidiaVoiceState("idle", {
        type: "voice.speaking",
        at: Date.now(),
      }),
    /Invalid NVIDIA voice transition/i,
  );
});

test("Vision refuses metadata-only/no-consent payloads", () => {
  assert.throws(
    () =>
      validateNvidiaVisualPayload({
        source: "camera",
        consent: false,
        frameCount: 1,
        payloadBytes: 1024,
        capturedAt: "2026-09-22T00:00:00Z",
        reference: "camera:0",
      }),
    /consent/i,
  );
  assert.throws(
    () =>
      validateNvidiaVisualPayload({
        source: "camera",
        consent: true,
        frameCount: 1,
        payloadBytes: 0,
        capturedAt: "2026-09-22T00:00:00Z",
        reference: "camera:0",
      }),
    /payload bytes/i,
  );
  const valid = validateNvidiaVisualPayload({
    source: "image",
    consent: true,
    frameCount: 1,
    payloadBytes: 2048,
    capturedAt: "2026-09-22T00:00:00Z",
    reference: "image:fixture",
  });
  assert.equal(valid.visualContentProvided, true);
});

test("NemoClaw learned skill begins disabled and cannot elevate permission", () => {
  const candidate = createNvidiaLearnedSkillCandidate({
    id: "release-flow",
    title: "Release Flow",
    sourceWorkflowIds: ["workflow-1"],
    sourceMaxPermissionLevel: 1,
    requestedMaxPermissionLevel: 3,
    createdAt: "2026-09-22T00:00:00Z",
  });
  assert.equal(candidate.state, "disabled");
  assert.equal(candidate.maxPermissionLevel, 1);
});

test("Guardrails never become execution authorization", () => {
  const decision = createNvidiaGuardrailDecision({
    stage: "tool_input",
    decision: "allow",
    detail: "safe",
  });
  assert.equal(decision.authorizationEffect, "none");
});

test("Evaluation is evidence-only and locked to exact build identity", () => {
  const manifest = normalizeNvidiaEvaluationManifest({
    commit: "a".repeat(40),
    runtimeBuild: "astra-build-fixture",
    capturedAt: "2026-09-22T00:00:00Z",
    suites: ["rag_quality", "safety", "safety"],
    releaseVerdict: "NOT_EVALUATED",
  });
  assert.deepEqual(manifest.suites, ["rag_quality", "safety"]);
  assert.equal(manifest.releaseVerdict, "NOT_EVALUATED");
});
