import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";

import { selectAgent } from "../lib/agent/orchestrator";
import { astraBrain } from "../lib/brain/adapter";
import { guardRequest, parseAgentRequest, readJson } from "../lib/brain/http";
import { getMemoryContext } from "../lib/brain/memory";
import { chatWithOllama, getOllamaStatus } from "../lib/brain/ollama";
import { getPermissionPolicy } from "../lib/brain/policy";
import { ASTRA_AGENT_MAP } from "../lib/agent/roster";
import {
  ASTRA_CAPABILITY_MAP,
  ASTRA_CAPABILITY_NODES,
  ASTRA_REASONING_ROSTER,
  visualNodeForAgent,
} from "../lib/agent/capabilities";
import type { AstraBrainEvent } from "../lib/brain/types";
import { searchMemorySources } from "../lib/memory/manager";
import type { AstraMemorySource } from "../lib/memory/contracts";
import {
  getProjectRegistry,
  normalizeProjects,
  resolveProject,
} from "../lib/projects/registry";

let root = "";
let fixture: Server;
let base = "";
let chatCalls = 0;
let chatBodies: Array<Record<string, unknown>> = [];

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "astra-v15-tests-"));
  await writeFile(
    path.join(root, "memory.json"),
    JSON.stringify([
      { id: "one", text: "ASTRA local provider decision", tags: ["astra"], project: "ASTRA", updatedAt: "2026-09-20T00:00:00Z" },
      { id: "two", text: "Ollama remains private and bounded", tags: ["ollama"], project: "ASTRA", updatedAt: "2026-09-20T01:00:00Z" },
    ]),
  );
  await writeFile(
    path.join(root, "projects.json"),
    JSON.stringify([
      {
        id: "astra",
        name: "ASTRA",
        aliases: ["astra ai"],
        memoryNamespace: "astra",
        status: "active",
        currentMilestone: "ASTRA MAX",
        lastActivity: "2026-09-20T08:00:00Z",
        repositories: ["valoranttgm123-svg/ASTRA-AI-Agent"],
        openTasks: ["Continue ASTRA MAX"],
      },
      {
        id: "alurka",
        name: "ALURKA",
        aliases: ["aplikasi alurka", "pos alurka"],
        memoryNamespace: "alurka",
        status: "active",
        currentMilestone: "POS development",
        lastActivity: "2026-09-20T09:00:00Z",
        openTasks: ["Continue POS work"],
      },
    ]),
  );

  fixture = createServer(async (request, response) => {
    if (request.url === "/api/tags") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ models: [{ name: "fixture-model:local" }] }));
      return;
    }

    if (request.url === "/api/chat") {
      chatCalls += 1;
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
      chatBodies.push(body);
      const messages = body.messages as Array<{ role: string; content: string }>;
      const input = messages.find((message) => message.role === "user")?.content;

      if (input === "slow") {
        const timer = setTimeout(() => {
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify({ message: { content: "late" } }));
        }, 3000);
        response.on("close", () => clearTimeout(timer));
        return;
      }

      if (input === "failure") {
        response.statusCode = 503;
        response.end("private upstream diagnostic");
        return;
      }

      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ message: { content: "ASTRA OLLAMA SIAP" } }));
      return;
    }

    response.statusCode = 404;
    response.end();
  });

  fixture.listen(0, "127.0.0.1");
  await once(fixture, "listening");
  base = `http://127.0.0.1:${(fixture.address() as { port: number }).port}`;
});

beforeEach(() => {
  process.env.ASTRA_HERMES_ENABLED = "false";
  process.env.ASTRA_CODEX_ENABLED = "false";
  process.env.ASTRA_CLOUD_ENABLED = "false";
  process.env.ASTRA_ALLOW_PAID_CLOUD = "false";
  process.env.ASTRA_OLLAMA_ENABLED = "true";
  process.env.ASTRA_OLLAMA_URL = base;
  process.env.ASTRA_OLLAMA_MODEL = "fixture-model:local";
  process.env.ASTRA_OLLAMA_THINKING = "false";
  process.env.ASTRA_OLLAMA_MAX_TOKENS = "1024";
  process.env.ASTRA_MEMORY_FILE = path.join(root, "memory.json");
  process.env.ASTRA_PROJECTS_FILE = path.join(root, "projects.json");
  process.env.ASTRA_PROJECTS_ENABLED = "true";
  process.env.ASTRA_MEMORY_MAX_ENTRIES = "1";
  process.env.ASTRA_MEMORY_MAX_CHARS = "80";
  delete process.env.ASTRA_ALLOW_FILE_WRITE;
  delete process.env.ASTRA_ALLOW_SHELL;
  delete process.env.ASTRA_ALLOW_EXTERNAL_ACTIONS;
  chatCalls = 0;
  chatBodies = [];
});

after(async () => {
  fixture.closeAllConnections();
  fixture.close();
  assert.ok(root.startsWith(path.join(os.tmpdir(), "astra-v15-tests-")));
  await rm(root, { recursive: true, force: true });
});

test("router matches complete terms instead of arbitrary substrings", () => {
  assert.equal(selectAgent("saya perlu bantuan"), "chief_of_staff");
  assert.equal(selectAgent("review pull request"), "github");
  assert.equal(selectAgent("cari bug TypeScript"), "developer");
});

test("HTTP guard rejects remote and cross-site requests", () => {
  assert.throws(() => guardRequest(new Request("http://evil.example/api/agent")));
  assert.throws(() =>
    guardRequest(
      new Request("http://localhost:3000/api/agent", {
        headers: { origin: "https://evil.example" },
      }),
    ),
  );
  assert.throws(() =>
    guardRequest(new Request("http://localhost:3000/api/agent"), true),
  );
  guardRequest(
    new Request("http://localhost:3000/api/agent", {
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
        "x-astra-client": "1",
      },
    }),
    true,
  );
});

test("request parser validates size, shape, mode, and provider", async () => {
  assert.deepEqual(parseAgentRequest({ message: " halo ", provider: "ollama" }), {
    message: "halo",
    mode: "chat",
    approved: false,
    provider: "ollama",
  });
  for (const invalid of [
    { message: 42 },
    { message: "x", provider: "cloud" },
    { message: "x", mode: "unsafe" },
    { message: "x", approved: "yes" },
    { message: "x".repeat(4001) },
  ]) {
    assert.throws(() => parseAgentRequest(invalid));
  }
  await assert.rejects(
    readJson(new Request("http://localhost", { method: "POST", body: "{" })),
  );
  await assert.rejects(
    readJson(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ message: "x".repeat(17000) }),
      }),
    ),
  );
});

test("memory retrieval is local, bounded, and carries provenance", async () => {
  const context = await getMemoryContext("Ollama ASTRA");
  assert.equal(context.entries.length, 1);
  assert.equal(context.records.length, 1);
  assert.ok(context.text.length <= 80);
  assert.match(context.text, /ASTRA|Ollama/);
  assert.equal(context.records[0].provenance.sourceType, "local");
  assert.equal(context.records[0].provenance.source, "astra-local-memory");
  assert.equal(context.records[0].provenance.project, "ASTRA");
  assert.equal(context.records[0].provenance.privacy, "private_local");
  assert.match(context.records[0].provenance.reference, /^local:/);
  assert.ok(context.records[0].relevance >= 0 && context.records[0].relevance <= 1);
  assert.equal(context.records[0].confidence, 1);
});

test("permission policy defaults to approval and denies side effects", () => {
  const policy = getPermissionPolicy();
  assert.equal(policy.requireApproval, true);
  assert.equal(policy.allowFileWrite, false);
  assert.equal(policy.allowShell, false);
  assert.equal(policy.allowExternalActions, false);
  assert.equal(policy.allowPaidCloud, false);
});

test("Ollama uses the exact configured model and responsive payload", async () => {
  const result = await chatWithOllama({
    input: "tes",
    agent: ASTRA_AGENT_MAP.chief_of_staff,
  });
  assert.equal(result.message, "ASTRA OLLAMA SIAP");
  assert.equal(result.model, "fixture-model:local");
  assert.equal(chatCalls, 1);
  assert.equal(chatBodies[0].think, false);
  assert.deepEqual(chatBodies[0].options, { num_predict: 1024 });
});

test("missing preferred Ollama model never silently switches", async () => {
  process.env.ASTRA_OLLAMA_MODEL = "missing:latest";
  const status = await getOllamaStatus();
  assert.equal(status.available, false);
  await assert.rejects(
    chatWithOllama({ input: "tes", agent: ASTRA_AGENT_MAP.chief_of_staff }),
    /tidak terpasang/,
  );
  assert.equal(chatCalls, 0);
});

test("provider errors do not leak upstream diagnostics", async () => {
  await assert.rejects(
    chatWithOllama({ input: "failure", agent: ASTRA_AGENT_MAP.chief_of_staff }),
    (error: Error) => {
      assert.doesNotMatch(error.message, /private upstream/);
      return true;
    },
  );
});

test("AbortSignal cancels an in-flight Ollama request", async () => {
  const controller = new AbortController();
  const pending = chatWithOllama({
    input: "slow",
    agent: ASTRA_AGENT_MAP.chief_of_staff,
    signal: controller.signal,
  });
  setTimeout(() => controller.abort(), 50);
  await assert.rejects(pending, { name: "AbortError" });
});

test("explicit Ollama selection executes Ollama with live lifecycle events", async () => {
  const events: AstraBrainEvent[] = [];
  const result = await astraBrain.chat("halo", {
    provider: "ollama",
    onEvent: (event) => events.push(event),
  });
  assert.equal(result.state, "completed");
  assert.equal(result.brain.provider, "ollama");
  assert.equal(chatCalls, 1);
  assert.ok(events.some((event) => event.type === "agent.started"));
  assert.ok(events.some((event) => event.type === "agent.completed"));
});

test("explicit disabled Codex does not silently fall back to Ollama", async () => {
  const result = await astraBrain.chat("halo", { provider: "codex" });
  assert.equal(result.state, "needs_provider");
  assert.equal(result.brain.provider, "routing_only");
  assert.equal(chatCalls, 0);
});

test("explicit Ollama execution is honestly blocked", async () => {
  const result = await astraBrain.execute(
    { input: "ubah file", approved: true },
    { provider: "ollama" },
  );
  assert.equal(result.state, "blocked");
  assert.equal(result.brain.execution, "blocked");
  assert.equal(chatCalls, 0);
});


test("ASTRA MAX capability registry owns exactly 18 unique Command Center nodes", () => {
  assert.equal(ASTRA_CAPABILITY_NODES.length, 18);
  const keys = ASTRA_CAPABILITY_NODES.map((node) => node.key);
  assert.equal(new Set(keys).size, 18);
  assert.deepEqual(
    ASTRA_REASONING_ROSTER.map((entry) => entry[0]),
    keys,
  );
  for (const key of keys) {
    assert.equal(ASTRA_CAPABILITY_MAP[key].key, key);
  }
});

test("READY capability nodes are implemented locally and need no missing configuration", () => {
  const ready = ASTRA_CAPABILITY_NODES.filter((node) => node.defaultState === "READY");
  assert.ok(ready.length > 0);
  for (const node of ready) {
    assert.equal(node.implementation, "implemented");
    assert.equal(node.requiresConfiguration, false);
  }
  assert.equal(ASTRA_CAPABILITY_MAP.email.defaultState, "NOT_CONFIGURED");
  assert.equal(ASTRA_CAPABILITY_MAP.calendar.defaultState, "NOT_CONFIGURED");
  assert.equal(ASTRA_CAPABILITY_MAP.crm.defaultState, "NOT_CONFIGURED");
  assert.equal(ASTRA_CAPABILITY_MAP.design.defaultState, "NOT_CONFIGURED");
});

test("every execution agent maps to a registered visual capability node", () => {
  for (const key of Object.keys(ASTRA_AGENT_MAP) as Array<keyof typeof ASTRA_AGENT_MAP>) {
    const visual = visualNodeForAgent(key);
    assert.ok(ASTRA_CAPABILITY_MAP[visual], `missing capability for ${key}`);
  }
  assert.equal(visualNodeForAgent("computer"), "ops");
  assert.equal(visualNodeForAgent("communication"), "email");
  assert.equal(visualNodeForAgent("files"), "drive");
});


test("Brain envelope reports retrieved memory source types", async () => {
  const result = await astraBrain.chat("ASTRA provider", { provider: "ollama" });
  assert.deepEqual(result.brain.context?.memorySources, ["local"]);
});


test("multi-source memory manager enforces project isolation, dedupe, ranking, and bounds", async () => {
  const local: AstraMemorySource = {
    id: "local-fixture",
    type: "local",
    async search() {
      return {
        source: "local-fixture",
        sourceType: "local",
        available: true,
        detail: "ok",
        records: [
          {
            id: "shared",
            content: "ASTRA decision from local memory",
            relevance: 0.7,
            confidence: 1,
            provenance: {
              source: "local-fixture",
              sourceType: "local",
              project: "ASTRA",
              privacy: "private_local",
              reference: "decision:shared",
            },
          },
          {
            id: "other-project",
            content: "ALURKA only context",
            relevance: 0.99,
            confidence: 1,
            provenance: {
              source: "local-fixture",
              sourceType: "local",
              project: "ALURKA",
              privacy: "private_local",
              reference: "decision:alurka",
            },
          },
        ],
      };
    },
  };

  const graph: AstraMemorySource = {
    id: "graph-fixture",
    type: "graphify",
    async search() {
      return {
        source: "graph-fixture",
        sourceType: "graphify",
        available: true,
        detail: "ok",
        records: [
          {
            id: "shared-graph",
            content: "ASTRA decision from graph",
            relevance: 0.9,
            confidence: 0.8,
            provenance: {
              source: "graph-fixture",
              sourceType: "graphify",
              project: "ASTRA",
              privacy: "project_local",
              reference: "decision:shared",
            },
          },
          {
            id: "second",
            content: "ASTRA second graph context",
            relevance: 0.8,
            confidence: 0.8,
            provenance: {
              source: "graph-fixture",
              sourceType: "graphify",
              project: "ASTRA",
              privacy: "project_local",
              reference: "decision:second",
            },
          },
        ],
      };
    },
  };

  const result = await searchMemorySources(
    { input: "ASTRA", project: "ASTRA", limit: 2, maxChars: 200 },
    [local, graph],
  );

  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].provenance.reference, "decision:shared");
  assert.equal(result.records[0].provenance.sourceType, "graphify");
  assert.equal(result.records[1].provenance.reference, "decision:second");
  assert.ok(result.records.every((record) => record.provenance.project !== "ALURKA"));
});

test("multi-source memory manager degrades around failed sources and supports cancellation", async () => {
  const failing: AstraMemorySource = {
    id: "broken-source",
    type: "obsidian",
    async search() {
      throw new Error("fixture failure");
    },
  };
  const result = await searchMemorySources(
    { input: "ASTRA", limit: 3, maxChars: 200 },
    [failing],
  );
  assert.equal(result.records.length, 0);
  assert.equal(result.sources[0].available, false);
  assert.doesNotMatch(result.sources[0].detail, /password|token/i);

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    searchMemorySources(
      { input: "ASTRA", limit: 3, maxChars: 200, signal: controller.signal },
      [failing],
    ),
    { name: "AbortError" },
  );
});


test("Project Registry loads only explicitly registered local metadata", async () => {
  const registry = await getProjectRegistry();
  assert.equal(registry.available, true);
  assert.equal(registry.projects.length, 2);
  assert.deepEqual(registry.projects.map((project) => project.id), ["astra", "alurka"]);
  assert.match(registry.source, /projects\.json$/);
});

test("Project Registry resolves names, aliases, and the most recent active project", async () => {
  const registry = await getProjectRegistry();
  assert.equal(resolveProject("lanjutkan ALURKA", registry.projects)?.project.id, "alurka");
  assert.equal(resolveProject("cek aplikasi alurka terakhir", registry.projects)?.project.id, "alurka");
  const recent = resolveProject("lanjutkan project terakhir", registry.projects);
  assert.equal(recent?.project.id, "alurka");
  assert.equal(recent?.reason, "recent");
  assert.equal(resolveProject("pertanyaan umum tanpa project", registry.projects), null);
});

test("Project Registry normalization rejects duplicate IDs and bounds metadata", () => {
  const projects = normalizeProjects([
    { id: "one", name: "One", aliases: ["a"] },
    { id: "ONE", name: "Duplicate", aliases: ["b"] },
    { name: "" },
  ]);
  assert.equal(projects.length, 1);
  assert.equal(projects[0].id, "one");
});


test("Brain exposes truthful registered project selection and event", async () => {
  const events: AstraBrainEvent[] = [];
  const result = await astraBrain.chat("lanjutkan ALURKA", {
    provider: "ollama",
    onEvent: (event) => events.push(event),
  });
  assert.equal(result.brain.context?.project?.id, "alurka");
  assert.equal(result.brain.context?.project?.name, "ALURKA");
  assert.ok(events.some((event) => event.type === "project.selected"));
});
