import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  ASTRA_CAPABILITY_MAP,
  ASTRA_CAPABILITY_NODES,
  ASTRA_REASONING_ROSTER,
  visualNodeForAgent,
} from "../lib/agent/capabilities";
import type { AstraAgentKey } from "../lib/agent/types";
import { normalizeMemoryRecord } from "../lib/brain/memory-sources";
import { getSonorBridgeConfig, getSonorBridgeStatus } from "../lib/brain/sonor";

const originalSonorEnabled = process.env.ASTRA_SONOR_ENABLED;
const originalSonorUrl = process.env.ASTRA_SONOR_URL;
const originalSearchPath = process.env.ASTRA_SONOR_SEARCH_PATH;
const originalHealthPath = process.env.ASTRA_SONOR_HEALTH_PATH;

afterEach(() => {
  if (originalSonorEnabled === undefined) delete process.env.ASTRA_SONOR_ENABLED;
  else process.env.ASTRA_SONOR_ENABLED = originalSonorEnabled;

  if (originalSonorUrl === undefined) delete process.env.ASTRA_SONOR_URL;
  else process.env.ASTRA_SONOR_URL = originalSonorUrl;

  if (originalSearchPath === undefined) delete process.env.ASTRA_SONOR_SEARCH_PATH;
  else process.env.ASTRA_SONOR_SEARCH_PATH = originalSearchPath;

  if (originalHealthPath === undefined) delete process.env.ASTRA_SONOR_HEALTH_PATH;
  else process.env.ASTRA_SONOR_HEALTH_PATH = originalHealthPath;
});

test("ASTRA MAX capability registry has exactly 18 unique Command Center nodes", () => {
  assert.equal(ASTRA_CAPABILITY_NODES.length, 18);
  assert.equal(new Set(ASTRA_CAPABILITY_NODES.map((node) => node.key)).size, 18);
  assert.equal(ASTRA_REASONING_ROSTER.length, 18);
  assert.deepEqual(
    ASTRA_REASONING_ROSTER.map((row) => row[0]),
    ASTRA_CAPABILITY_NODES.map((node) => node.key),
  );
});

test("READY is reserved for implemented capabilities that do not need external configuration", () => {
  for (const node of ASTRA_CAPABILITY_NODES) {
    if (node.defaultState !== "READY") continue;
    assert.equal(node.implementation, "implemented", node.key);
    assert.equal(node.requiresConfiguration, false, node.key);
  }

  assert.equal(ASTRA_CAPABILITY_MAP.strategist.defaultState, "NOT_CONFIGURED");
  assert.equal(ASTRA_CAPABILITY_MAP.calendar.defaultState, "NOT_CONFIGURED");
  assert.equal(ASTRA_CAPABILITY_MAP.email.defaultState, "NOT_CONFIGURED");
  assert.equal(ASTRA_CAPABILITY_MAP.design.defaultState, "NOT_CONFIGURED");
});

test("all current Brain agents map to a registered visual capability", () => {
  const agents: AstraAgentKey[] = [
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
  ];

  for (const agent of agents) {
    const visualNode = visualNodeForAgent(agent);
    assert.ok(ASTRA_CAPABILITY_MAP[visualNode], agent);
  }

  assert.equal(visualNodeForAgent("github"), "developer");
  assert.equal(visualNodeForAgent("communication"), "email");
  assert.equal(visualNodeForAgent("files"), "drive");
  assert.equal(visualNodeForAgent("trading"), "finance");
});

test("memory source normalization clamps confidence and relevance and bounds content", () => {
  const record = normalizeMemoryRecord({
    id: "x",
    source: "fixture",
    sourceType: "project_docs",
    privacy: "project_local",
    relevance: 3,
    confidence: -1,
    content: `  ${"x".repeat(9000)}  `,
  });

  assert.equal(record.relevance, 1);
  assert.equal(record.confidence, 0);
  assert.equal(record.content.length, 8000);
});

test("Sonor bridge defaults to the existing local workflow graph but remains disabled", async () => {
  delete process.env.ASTRA_SONOR_ENABLED;
  delete process.env.ASTRA_SONOR_URL;
  delete process.env.ASTRA_SONOR_SEARCH_PATH;

  const config = getSonorBridgeConfig();
  assert.equal(config.enabled, false);
  assert.equal(config.baseUrl, "http://127.0.0.1:55127");

  const status = await getSonorBridgeStatus();
  assert.equal(status.enabled, false);
  assert.equal(status.available, false);
});

test("Sonor bridge refuses non-loopback URLs", () => {
  process.env.ASTRA_SONOR_URL = "http://192.168.1.54:55127";
  assert.throws(
    () => getSonorBridgeConfig(),
    /loopback URL/,
  );
});

test("Sonor bridge never invents a search endpoint", async () => {
  process.env.ASTRA_SONOR_ENABLED = "true";
  process.env.ASTRA_SONOR_URL = "http://127.0.0.1:55127";
  delete process.env.ASTRA_SONOR_SEARCH_PATH;

  const status = await getSonorBridgeStatus();
  assert.equal(status.enabled, true);
  assert.equal(status.available, false);
  assert.match(status.detail, /no verified search endpoint contract/i);
});
