import assert from "node:assert/strict";
import { test } from "node:test";

import {
  automationServiceReadiness,
  automationStoreReadiness,
  classifyWindowsStartupTasks,
  extractBrainReadiness,
  featureState,
} from "../lib/release/readiness";

test("Phase 19A readiness extractor reports running Brain and capability states without response detail", () => {
  const result = extractBrainReadiness({
    ready: true,
    provider: "ollama",
    mode: "local",
    endpoint: "http://127.0.0.1:11434",
    model: "qwen-fixture",
    fallback: "routing_only",
    permissions: {
      requireApproval: true,
      allowShell: false,
      allowFileWrite: false,
      allowExternalActions: false,
      allowPaidCloud: false,
    },
    capabilities: {
      strategist: {
        state: "READY",
        detail: "private provider detail",
      },
      email: {
        state: "NOT_CONFIGURED",
        detail: "private integration detail",
      },
    },
    features: {
      codex: {
        enabled: true,
        available: false,
        detail: "private CLI detail",
      },
      cloud: {
        enabled: false,
        available: false,
        detail: "private cloud detail",
      },
    },
  });

  assert.equal(result.brain.state, "READY");
  assert.equal(result.ollama.state, "READY");
  assert.equal(result.capabilities.email, "NOT_CONFIGURED");
  assert.equal(result.features.codex, "OFFLINE");
  assert.equal(result.features.cloud, "NOT_CONFIGURED");
  assert.equal(result.permissions.data?.requireApproval, true);

  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("private provider detail"), false);
  assert.equal(serialized.includes("private integration detail"), false);
  assert.equal(serialized.includes("private CLI detail"), false);
});

test("Phase 19A feature readiness fails conservatively", () => {
  assert.equal(
    featureState({
      enabled: false,
      available: false,
    }),
    "NOT_CONFIGURED",
  );
  assert.equal(
    featureState({
      enabled: true,
      available: false,
    }),
    "OFFLINE",
  );
  assert.equal(
    featureState({
      state: "ERROR",
      enabled: true,
      available: true,
    }),
    "ERROR",
  );
  assert.equal(featureState("bad"), "UNKNOWN");
});

test("Phase 19A automation readiness distinguishes store and service opt-in", () => {
  const store = automationStoreReadiness({
    available: true,
    enabled: true,
    automations: [{ id: "a" }],
    queue: {
      ready: [{ id: "r" }],
      waitingApproval: [{ id: "w" }],
    },
  });
  assert.equal(store.state, "READY");
  assert.equal(store.data?.definitionCount, 1);
  assert.equal(store.data?.waitingApprovalCount, 1);

  const serviceOff = automationServiceReadiness({
    service: {
      enabled: false,
      running: false,
      tickActive: false,
    },
  });
  assert.equal(serviceOff.state, "NOT_CONFIGURED");

  const serviceRunning = automationServiceReadiness({
    service: {
      enabled: true,
      running: true,
      tickActive: false,
      pollIntervalMs: 60000,
    },
  });
  assert.equal(serviceRunning.state, "READY");
});

test("Phase 19A Windows startup task readiness distinguishes missing disabled and installed tasks", () => {
  assert.equal(
    classifyWindowsStartupTasks({
      "ASTRA-Agent": "Running",
      "ASTRA-Ollama": "Ready",
    }).state,
    "READY",
  );

  assert.equal(
    classifyWindowsStartupTasks({
      "ASTRA-Agent": "Running",
      "ASTRA-Ollama": "MISSING",
    }).state,
    "NOT_CONFIGURED",
  );

  assert.equal(
    classifyWindowsStartupTasks({
      "ASTRA-Agent": "Disabled",
      "ASTRA-Ollama": "Ready",
    }).state,
    "OFFLINE",
  );
});

