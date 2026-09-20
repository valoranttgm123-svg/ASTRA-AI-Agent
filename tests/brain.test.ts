import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
  getSonorBridgeConfig,
  parseSonorBridgeResponse,
  sonorMemorySource,
} from "../lib/memory/sonor";
import { createProjectContextMemorySource } from "../lib/projects/context";
import {
  getProjectRegistry,
  normalizeProjects,
  resolveProject,
} from "../lib/projects/registry";
import {
  createBoundedPlan,
  runnablePlanSteps,
  updatePlanStepStatus,
} from "../lib/planner/planner";
import { createToolRegistry } from "../lib/tools/registry";
import { createExecutableToolRegistry } from "../lib/tools/executor";
import { astraNativeToolRuntime, createToolRuntime } from "../lib/tools/runtime";
import type { AstraMcpTransport } from "../lib/tools/mcp";
import { parsePlannerDraft, shouldGeneratePlan } from "../lib/planner/generator";
import { executeBoundedPlan } from "../lib/planner/executor";

let root = "";
let alurkaWorkspace = "";
let fixture: Server;
let base = "";
let chatCalls = 0;
let chatBodies: Array<Record<string, unknown>> = [];

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "astra-v15-tests-"));
  alurkaWorkspace = path.join(root, "alurka-workspace");
  await mkdir(alurkaWorkspace, { recursive: true });
  await writeFile(
    path.join(alurkaWorkspace, "registered.md"),
    "ALURKA workflow registered context",
  );
  await writeFile(
    path.join(alurkaWorkspace, "unlisted.md"),
    "THIS UNLISTED FILE MUST NOT ENTER ASTRA CONTEXT",
  );
  await writeFile(
    path.join(alurkaWorkspace, ".env"),
    "SECRET_FIXTURE_VALUE=never-read",
  );
  await writeFile(
    path.join(root, "outside.md"),
    "OUTSIDE WORKSPACE MUST NOT ENTER ASTRA CONTEXT",
  );
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
        workspace: alurkaWorkspace,
        docs: ["registered.md", "../outside.md", ".env"],
        importantFiles: [],
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

    if (request.url === "/sonor/search") {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        query?: string;
        project?: string;
      };
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          records: [
            {
              id: "sonor-1",
              content: "ALURKA workflow graph context from Sonor",
              tags: ["alurka", "workflow"],
              relevance: body.query?.toLowerCase().includes("alurka") ? 0.95 : 0.5,
              confidence: 0.9,
              provenance: {
                source: "sonor-workflow-graph",
                sourceType: "graphify",
                project: body.project ?? "ALURKA",
                timestamp: "2026-09-20T08:45:00Z",
                privacy: "project_local",
                reference: "sonor:workflow:alurka",
              },
            },
          ],
        }),
      );
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

      if (input?.startsWith("ASTRA_PLAN_REQUEST")) {
        const reasonOnly = input.includes("reason-only-plan");
        const steps = reasonOnly
          ? [
              {
                id: "reason-1",
                title: "Analyze the goal and constraints",
                kind: "reason",
                agent: "business",
                permissionLevel: 0,
                dependsOn: [],
                timeoutMs: 5000,
                maxRetries: 0,
              },
              {
                id: "reason-2",
                title: "Produce a concise recommendation from the analysis",
                kind: "reason",
                agent: "chief_of_staff",
                permissionLevel: 0,
                dependsOn: ["reason-1"],
                timeoutMs: 5000,
                maxRetries: 0,
              },
            ]
          : [
              {
                id: "inspect",
                title: "Inspect the registered project state",
                kind: "inspect",
                agent: "files",
                permissionLevel: 0,
                dependsOn: [],
                timeoutMs: 5000,
                maxRetries: 0,
              },
              {
                id: "fix",
                title: "Apply the smallest safe code change",
                kind: "tool",
                agent: "developer",
                permissionLevel: 0,
                dependsOn: ["inspect"],
                timeoutMs: 45000,
                maxRetries: 1,
              },
              {
                id: "verify",
                title: "Run verification after the change",
                kind: "verify",
                agent: "developer",
                permissionLevel: 0,
                dependsOn: ["fix"],
                timeoutMs: 30000,
                maxRetries: 0,
              },
            ];

        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            message: {
              content: JSON.stringify({ steps }),
            },
          }),
        );
        return;
      }

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
  process.env.ASTRA_PROJECT_CONTEXT_ENABLED = "true";
  process.env.ASTRA_PROJECT_CONTEXT_MAX_FILES = "20";
  process.env.ASTRA_PROJECT_CONTEXT_MAX_FILE_BYTES = "262144";
  process.env.ASTRA_MEMORY_MAX_ENTRIES = "1";
  process.env.ASTRA_MEMORY_MAX_CHARS = "80";
  delete process.env.ASTRA_ALLOW_FILE_WRITE;
  delete process.env.ASTRA_ALLOW_SHELL;
  delete process.env.ASTRA_ALLOW_EXTERNAL_ACTIONS;
  process.env.ASTRA_SONOR_ENABLED = "false";
  delete process.env.ASTRA_SONOR_URL;
  delete process.env.ASTRA_SONOR_SEARCH_PATH;
  delete process.env.ASTRA_SONOR_TIMEOUT_MS;
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


test("planner bounds steps, retries, timeouts, permissions, and dependencies", () => {
  const drafts = Array.from({ length: 20 }, (_, index) => ({
    id: "step-" + (index + 1),
    title: "Step " + (index + 1),
    kind: "inspect" as const,
    permissionLevel: index === 0 ? (4 as const) : (1 as const),
    timeoutMs: 999999,
    maxRetries: 99,
    dependsOn: index === 0 ? ["future-step"] : ["step-" + index, "missing"],
  }));

  const plan = createBoundedPlan("Bounded task", drafts, {
    id: "fixture-plan",
    projectId: "astra",
    createdAt: "2026-09-20T10:00:00Z",
  });

  assert.equal(plan.steps.length, 12);
  assert.equal(plan.steps[0].permissionLevel, 4);
  assert.equal(plan.steps[0].timeoutMs, 120000);
  assert.equal(plan.steps[0].maxRetries, 2);
  assert.deepEqual(plan.steps[0].dependsOn, []);
  assert.deepEqual(plan.steps[1].dependsOn, ["step-1"]);
  assert.equal(plan.projectId, "astra");
});

test("planner exposes only dependency-satisfied pending steps", () => {
  const initial = createBoundedPlan("Dependency task", [
    { id: "inspect", title: "Inspect", kind: "inspect" },
    { id: "verify", title: "Verify", kind: "verify", dependsOn: ["inspect"] },
  ]);

  assert.deepEqual(runnablePlanSteps(initial).map((step) => step.id), ["inspect"]);
  const progressed = updatePlanStepStatus(initial, "inspect", "completed");
  assert.deepEqual(runnablePlanSteps(progressed).map((step) => step.id), ["verify"]);
  assert.throws(() => updatePlanStepStatus(initial, "missing", "completed"));
});

test("planner rejects empty goals and plans without valid steps", () => {
  assert.throws(() =>
    createBoundedPlan("", [{ title: "Inspect", kind: "inspect" }]),
  );
  assert.throws(() =>
    createBoundedPlan("Goal", [{ title: "   ", kind: "inspect" }]),
  );
});


test("Tool Registry enforces side-effect permission floors and READY provider truth", () => {
  const registry = createToolRegistry([
    {
      id: "files.read",
      name: "Read Files",
      category: "filesystem",
      description: "Read registered project files",
      permissionLevel: 1,
      sideEffect: "read",
      timeoutMs: 5000,
      supportsCancellation: true,
      provider: "native-files",
      availability: "READY",
    },
    {
      id: "github.push",
      name: "GitHub Push",
      category: "github",
      description: "Push an approved branch",
      permissionLevel: 3,
      sideEffect: "external_write",
      timeoutMs: 999999,
      supportsCancellation: true,
      provider: "github",
      availability: "NOT_CONFIGURED",
    },
  ]);

  assert.equal(registry.list().length, 2);
  assert.equal(registry.get("FILES.READ")?.id, "files.read");
  assert.equal(registry.get("github.push")?.timeoutMs, 120000);
  assert.throws(() =>
    createToolRegistry([
      {
        id: "email.send",
        name: "Send Email",
        category: "email",
        description: "Send an email",
        permissionLevel: 1,
        sideEffect: "external_write",
        timeoutMs: 5000,
        supportsCancellation: true,
        provider: "gmail",
        availability: "NOT_CONFIGURED",
      },
    ]),
  );
  assert.throws(() =>
    createToolRegistry([
      {
        id: "missing-provider",
        name: "Missing Provider",
        category: "mcp",
        description: "Invalid ready tool",
        permissionLevel: 1,
        sideEffect: "read",
        timeoutMs: 5000,
        supportsCancellation: true,
        availability: "READY",
      },
    ]),
  );
});

test("Tool Registry rejects duplicate normalized IDs", () => {
  assert.throws(() =>
    createToolRegistry([
      {
        id: "files.read",
        name: "One",
        category: "filesystem",
        description: "One",
        permissionLevel: 1,
        sideEffect: "read",
        timeoutMs: 5000,
        supportsCancellation: true,
        provider: "native",
        availability: "READY",
      },
      {
        id: "FILES.READ",
        name: "Two",
        category: "filesystem",
        description: "Two",
        permissionLevel: 1,
        sideEffect: "read",
        timeoutMs: 5000,
        supportsCancellation: true,
        provider: "native",
        availability: "READY",
      },
    ]),
  );
});


test("Sonor bridge defaults to the existing loopback service and refuses LAN URLs", () => {
  delete process.env.ASTRA_SONOR_URL;
  const config = getSonorBridgeConfig();
  assert.equal(config.baseUrl, "http://127.0.0.1:55127");
  assert.equal(config.enabled, false);

  process.env.ASTRA_SONOR_URL = "http://192.168.1.54:55127";
  assert.throws(() => getSonorBridgeConfig(), /loopback URL/);
});

test("Sonor bridge parser requires provenance-aware ASTRA memory records", () => {
  const records = parseSonorBridgeResponse({
    records: [
      {
        id: "one",
        content: "Graph context",
        relevance: 4,
        confidence: -1,
        provenance: {
          source: "sonor",
          sourceType: "graphify",
          project: "ASTRA",
          privacy: "project_local",
          reference: "sonor:one",
        },
      },
    ],
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].relevance, 1);
  assert.equal(records[0].confidence, 0);
  assert.equal(records[0].provenance.sourceType, "graphify");
  assert.throws(
    () =>
      parseSonorBridgeResponse({
        records: [{ id: "bad", content: "missing provenance" }],
      }),
    /Invalid Sonor bridge response/,
  );
});

test("Sonor memory source uses only an explicitly configured verified-compatible endpoint", async () => {
  process.env.ASTRA_SONOR_ENABLED = "true";
  process.env.ASTRA_SONOR_URL = base;
  delete process.env.ASTRA_SONOR_SEARCH_PATH;

  const unavailable = await sonorMemorySource.search({
    input: "ALURKA",
    project: "ALURKA",
    limit: 5,
    maxChars: 2000,
  });
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.records.length, 0);

  process.env.ASTRA_SONOR_SEARCH_PATH = "/sonor/search";
  const result = await sonorMemorySource.search({
    input: "ALURKA workflow",
    project: "ALURKA",
    limit: 5,
    maxChars: 2000,
  });

  assert.equal(result.available, true);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].provenance.reference, "sonor:workflow:alurka");
  assert.equal(result.records[0].provenance.sourceType, "graphify");
  assert.equal(result.records[0].provenance.project, "ALURKA");
});

test("Sonor source plugs into the existing multi-source memory manager without special casing", async () => {
  process.env.ASTRA_SONOR_ENABLED = "true";
  process.env.ASTRA_SONOR_URL = base;
  process.env.ASTRA_SONOR_SEARCH_PATH = "/sonor/search";

  const result = await searchMemorySources(
    {
      input: "ALURKA workflow",
      project: "ALURKA",
      limit: 3,
      maxChars: 2000,
    },
    [sonorMemorySource],
  );

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].provenance.sourceType, "graphify");
  assert.equal(result.sources[0].sourceType, "sonor");
  assert.equal(result.sources[0].available, true);
});


test("Brain context can consume Sonor/Graphify through the unified memory manager", async () => {
  process.env.ASTRA_MEMORY_MAX_ENTRIES = "3";
  process.env.ASTRA_SONOR_ENABLED = "true";
  process.env.ASTRA_SONOR_URL = base;
  process.env.ASTRA_SONOR_SEARCH_PATH = "/sonor/search";

  const result = await astraBrain.chat("lanjutkan ALURKA workflow", {
    provider: "ollama",
  });

  assert.equal(result.brain.context?.project?.id, "alurka");
  assert.ok(result.brain.context?.memorySources?.includes("graphify"));
  assert.equal(result.state, "completed");
});


test("memory manager emits lifecycle from actual source queries and selection", async () => {
  const lifecycle: string[] = [];
  const graphSource: AstraMemorySource = {
    id: "telemetry-graph",
    type: "graphify",
    async search() {
      return {
        source: "telemetry-graph",
        sourceType: "graphify",
        available: true,
        detail: "fixture graph ready",
        records: [
          {
            id: "telemetry-record",
            content: "ASTRA graph telemetry context",
            relevance: 0.9,
            confidence: 0.9,
            provenance: {
              source: "telemetry-graph",
              sourceType: "graphify",
              project: "ASTRA",
              privacy: "project_local",
              reference: "telemetry:graph:1",
            },
          },
        ],
      };
    },
  };

  const result = await searchMemorySources(
    {
      input: "ASTRA telemetry",
      project: "ASTRA",
      limit: 3,
      maxChars: 1000,
    },
    [graphSource],
    (event) => lifecycle.push(event.type),
  );

  assert.equal(result.records.length, 1);
  assert.deepEqual(lifecycle, [
    "search.started",
    "source.queried",
    "graph.matched",
    "context.selected",
    "search.completed",
  ]);
});

test("Brain streams and retains real memory lifecycle telemetry", async () => {
  const live: AstraBrainEvent[] = [];
  const result = await astraBrain.chat("ASTRA provider", {
    provider: "ollama",
    onEvent: (event) => live.push(event),
  });

  for (const type of [
    "memory.search.started",
    "memory.source.queried",
    "memory.context.selected",
    "memory.search.completed",
  ] as const) {
    assert.ok(live.some((event) => event.type === type), type);
    assert.ok(result.brain.events.some((event) => event.type === type), type);
  }

  const started = live.findIndex((event) => event.type === "memory.search.started");
  const completed = live.findIndex((event) => event.type === "memory.search.completed");
  assert.ok(started >= 0);
  assert.ok(completed > started);
});


test("project context source reads only explicitly registered safe files inside workspace", async () => {
  const registry = await getProjectRegistry();
  const project = registry.projects.find((item) => item.id === "alurka");
  assert.ok(project);

  const source = createProjectContextMemorySource(project);
  const result = await source.search({
    input: "ALURKA workflow",
    project: "ALURKA",
    limit: 10,
    maxChars: 4000,
  });

  assert.equal(result.available, true);
  assert.equal(result.records.length, 1);
  assert.match(result.records[0].content, /registered context/);
  assert.equal(result.records[0].provenance.sourceType, "project");
  assert.equal(result.records[0].provenance.project, "ALURKA");
  assert.equal(
    result.records[0].provenance.reference,
    "project:alurka:registered.md",
  );
  assert.doesNotMatch(result.records[0].content, /UNLISTED|SECRET|OUTSIDE/);
});

test("Brain loads scoped registered project context through unified memory", async () => {
  process.env.ASTRA_SONOR_ENABLED = "false";
  const result = await astraBrain.chat("lanjutkan ALURKA workflow", {
    provider: "ollama",
  });

  assert.equal(result.brain.context?.project?.id, "alurka");
  assert.ok(result.brain.context?.memorySources?.includes("project"));
  assert.equal(result.state, "completed");
});


test("Strategist detects explicit plans and multi-action goals without planning trivial chat", () => {
  assert.equal(shouldGeneratePlan("halo ASTRA"), false);
  assert.equal(shouldGeneratePlan("buat rencana project ALURKA"), true);
  assert.equal(
    shouldGeneratePlan("cek repo, perbaiki error lalu test hasilnya"),
    true,
  );
});

test("planner parser enforces conservative permission floors", () => {
  const steps = parsePlannerDraft(
    JSON.stringify({
      steps: [
        {
          id: "read",
          title: "Inspect project",
          kind: "inspect",
          permissionLevel: 0,
          agent: "files",
        },
        {
          id: "write",
          title: "Modify code",
          kind: "tool",
          permissionLevel: 0,
          agent: "developer",
          dependsOn: ["read"],
        },
        {
          id: "approve",
          title: "Request external approval",
          kind: "approval",
          permissionLevel: 1,
          agent: "chief_of_staff",
          dependsOn: ["write"],
        },
      ],
    }),
  );

  assert.equal(steps[0].permissionLevel, 1);
  assert.equal(steps[1].permissionLevel, 2);
  assert.equal(steps[2].permissionLevel, 3);
});

test("Brain creates a bounded Strategist plan from the real local planner call", async () => {
  const events: AstraBrainEvent[] = [];
  const result = await astraBrain.chat(
    "cek project ALURKA, perbaiki error lalu test hasilnya",
    {
      provider: "ollama",
      onEvent: (event) => events.push(event),
    },
  );

  assert.equal(result.state, "completed");
  assert.equal(result.brain.plan?.status, "planned");
  assert.equal(result.brain.plan?.projectId, "alurka");
  assert.equal(result.brain.plan?.steps.length, 3);
  assert.equal(result.brain.plan?.steps[0].permissionLevel, 1);
  assert.equal(result.brain.plan?.steps[1].permissionLevel, 2);
  assert.equal(result.brain.plan?.steps[2].kind, "verify");
  assert.ok(events.some((event) => event.type === "plan.created"));
  assert.ok(
    result.brain.events.some((event) => event.type === "plan.created"),
  );
  assert.equal(
    events.some((event) => event.type === "plan.step.completed"),
    false,
  );
  assert.equal(chatCalls, 2);
});


test("bounded plan executor respects dependencies and emits only real completion events", async () => {
  const plan = createBoundedPlan("Execute bounded test", [
    {
      id: "first",
      title: "First",
      kind: "reason",
      permissionLevel: 0,
    },
    {
      id: "second",
      title: "Second",
      kind: "reason",
      permissionLevel: 0,
      dependsOn: ["first"],
    },
  ]);

  const order: string[] = [];
  const events: string[] = [];
  const result = await executeBoundedPlan(plan, {
    approvedPermissionLevel: 1,
    onEvent: (event) => events.push(event.type),
    executeStep: async (step) => {
      order.push(step.id);
      return {
        status: "completed",
        provider: "fixture",
        detail: "completed " + step.id,
        output: "output " + step.id,
      };
    },
  });

  assert.equal(result.outcome, "completed");
  assert.deepEqual(order, ["first", "second"]);
  assert.deepEqual(
    result.plan.steps.map((step) => step.status),
    ["completed", "completed"],
  );
  assert.equal(events.filter((type) => type === "plan.step.completed").length, 2);
  assert.equal(events.at(-1), "plan.completed");
});

test("bounded plan executor stops before a step above the approved permission level", async () => {
  const plan = createBoundedPlan("Permission test", [
    {
      id: "external",
      title: "External action",
      kind: "tool",
      agent: "communication",
      permissionLevel: 3,
    },
  ]);

  let calls = 0;
  const result = await executeBoundedPlan(plan, {
    approvedPermissionLevel: 2,
    executeStep: async () => {
      calls += 1;
      return {
        status: "completed",
        detail: "should not run",
      };
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.outcome, "waiting_approval");
  assert.equal(result.blockedStepId, "external");
  assert.equal(result.plan.steps[0].status, "waiting_approval");
});

test("bounded plan executor retries only within the step retry limit", async () => {
  const plan = createBoundedPlan("Retry test", [
    {
      id: "retry",
      title: "Retry once",
      kind: "reason",
      permissionLevel: 0,
      maxRetries: 1,
    },
  ]);

  let calls = 0;
  const result = await executeBoundedPlan(plan, {
    approvedPermissionLevel: 1,
    executeStep: async () => {
      calls += 1;
      if (calls === 1) {
        return {
          status: "failed",
          detail: "transient fixture failure",
        };
      }
      return {
        status: "completed",
        detail: "second attempt succeeded",
      };
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.outcome, "completed");
  assert.equal(result.plan.steps[0].status, "completed");
});

test("planner permission floors protect GitHub, communication, business, and trading tool steps", () => {
  const steps = parsePlannerDraft(
    JSON.stringify({
      steps: [
        {
          id: "github",
          title: "Push branch",
          kind: "tool",
          agent: "github",
          permissionLevel: 0,
        },
        {
          id: "mail",
          title: "Send email",
          kind: "tool",
          agent: "communication",
          permissionLevel: 0,
        },
        {
          id: "business",
          title: "Update customer system",
          kind: "tool",
          agent: "business",
          permissionLevel: 0,
        },
        {
          id: "trade",
          title: "Place trade",
          kind: "tool",
          agent: "trading",
          permissionLevel: 0,
        },
      ],
    }),
  );

  assert.equal(steps[0].permissionLevel, 3);
  assert.equal(steps[1].permissionLevel, 3);
  assert.equal(steps[2].permissionLevel, 3);
  assert.equal(steps[3].permissionLevel, 4);
});

test("Brain bounded orchestrator executes a real reasoning-only plan step by step", async () => {
  const events: AstraBrainEvent[] = [];
  const result = await astraBrain.execute(
    {
      input: "buat rencana reason-only-plan untuk analisis sederhana",
      approved: true,
    },
    {
      provider: "ollama",
      onEvent: (event) => events.push(event),
    },
  );

  assert.equal(result.state, "completed");
  assert.equal(result.brain.execution, "executed");
  assert.equal(result.brain.plan?.status, "completed");
  assert.equal(
    result.brain.plan?.steps.every((step) => step.status === "completed"),
    true,
  );
  assert.ok(events.some((event) => event.type === "plan.step.started"));
  assert.equal(
    events.filter((event) => event.type === "plan.step.completed").length,
    2,
  );
  assert.ok(events.some((event) => event.type === "plan.completed"));
  assert.ok(result.brain.route.includes("business"));
  assert.equal(chatCalls, 3);
});

test("Brain bounded orchestrator fails truthfully when a real tool executor is unavailable", async () => {
  process.env.ASTRA_ALLOW_FILE_WRITE = "true";
  const events: AstraBrainEvent[] = [];
  const result = await astraBrain.execute(
    {
      input: "cek project ALURKA, perbaiki error lalu test hasilnya",
      approved: true,
    },
    {
      provider: "auto",
      onEvent: (event) => events.push(event),
    },
  );

  assert.equal(result.state, "error");
  assert.equal(result.brain.execution, "blocked");
  assert.equal(result.brain.plan?.steps[0].status, "completed");
  assert.equal(result.brain.plan?.steps[1].status, "failed");
  assert.equal(result.brain.plan?.steps[2].status, "pending");
  assert.ok(events.some((event) => event.type === "plan.step.failed"));
  assert.equal(
    events.some(
      (event) =>
        event.type === "plan.step.completed" &&
        event.detail?.includes("Run verification"),
    ),
    false,
  );
});


test("native Tool Runtime reads only explicitly registered project context and verifies output", async () => {
  const lifecycle: string[] = [];
  const result = await astraNativeToolRuntime.execute(
    "project.context.search",
    {
      projectId: "alurka",
      query: "workflow",
      limit: 10,
    },
    {
      approvedPermissionLevel: 1,
      policy: {
        allowShell: false,
        allowFileWrite: false,
        allowExternalActions: false,
      },
      onEvent: (event) => lifecycle.push(event.type),
    },
  );

  assert.equal(result.status, "completed");
  assert.equal(result.verified, true);
  assert.deepEqual(lifecycle, ["tool.started", "tool.completed"]);

  const payload = result.output as {
    records: Array<{ content: string; provenance: { reference: string } }>;
  };
  assert.equal(payload.records.length, 1);
  assert.match(payload.records[0].content, /registered context/);
  assert.equal(
    payload.records[0].provenance.reference,
    "project:alurka:registered.md",
  );
  assert.doesNotMatch(
    JSON.stringify(payload),
    /UNLISTED|SECRET|OUTSIDE/,
  );
});

test("executable Tool Runtime blocks before handler when permission or policy is insufficient", async () => {
  let calls = 0;
  const runtime = createExecutableToolRegistry(
    [
      {
        id: "fixture.write",
        name: "Fixture Write",
        category: "filesystem",
        description: "Fixture local write",
        permissionLevel: 2,
        sideEffect: "local_write",
        timeoutMs: 5000,
        supportsCancellation: true,
        provider: "fixture",
        availability: "READY",
      },
    ],
    {
      "fixture.write": async () => {
        calls += 1;
        return {
          status: "completed",
          detail: "fixture wrote",
          verified: true,
        };
      },
    },
  );

  const noApproval = await runtime.execute(
    "fixture.write",
    {},
    {
      approvedPermissionLevel: 1,
      policy: {
        allowShell: false,
        allowFileWrite: true,
        allowExternalActions: false,
      },
    },
  );
  assert.equal(noApproval.status, "blocked");
  assert.equal(calls, 0);

  const noPolicy = await runtime.execute(
    "fixture.write",
    {},
    {
      approvedPermissionLevel: 2,
      policy: {
        allowShell: false,
        allowFileWrite: false,
        allowExternalActions: false,
      },
    },
  );
  assert.equal(noPolicy.status, "blocked");
  assert.equal(calls, 0);
});

test("executable Tool Runtime rejects unverified completion claims", async () => {
  const runtime = createExecutableToolRegistry(
    [
      {
        id: "fixture.unverified",
        name: "Fixture Unverified",
        category: "analytics",
        description: "Fixture read that lies about verification",
        permissionLevel: 1,
        sideEffect: "read",
        timeoutMs: 5000,
        supportsCancellation: true,
        provider: "fixture",
        availability: "READY",
      },
    ],
    {
      "fixture.unverified": async () => ({
        status: "completed",
        detail: "claimed completion",
        verified: false,
        output: { claimed: true },
      }),
    },
  );

  const result = await runtime.execute(
    "fixture.unverified",
    {},
    {
      approvedPermissionLevel: 1,
      policy: {
        allowShell: false,
        allowFileWrite: false,
        allowExternalActions: false,
      },
    },
  );

  assert.equal(result.status, "failed");
  assert.equal(result.verified, false);
  assert.match(result.detail, /without verified evidence/i);
});

test("MCP transport uses the same executable Tool Runtime permission and verification boundary", async () => {
  let calls = 0;
  const transport: AstraMcpTransport = {
    serverId: "fixture-server",
    async listTools() {
      return [
        {
          name: "lookup",
          description: "Read fixture knowledge",
          permissionLevel: 1,
          sideEffect: "read",
        },
      ];
    },
    async callTool(name, input) {
      calls += 1;
      assert.equal(name, "lookup");
      assert.deepEqual(input, { query: "ASTRA" });
      return {
        ok: true,
        detail: "fixture MCP lookup completed",
        content: { answer: "ASTRA fixture" },
      };
    },
  };

  const runtime = await createToolRuntime({
    mcpTransports: [transport],
  });
  assert.equal(runtime.has("mcp.fixture-server.lookup"), true);

  const result = await runtime.execute(
    "mcp.fixture-server.lookup",
    { query: "ASTRA" },
    {
      approvedPermissionLevel: 1,
      policy: {
        allowShell: false,
        allowFileWrite: false,
        allowExternalActions: false,
      },
    },
  );

  assert.equal(calls, 1);
  assert.equal(result.status, "completed");
  assert.equal(result.verified, true);
  assert.deepEqual(result.output, { answer: "ASTRA fixture" });
});

test("Brain streams real native tool lifecycle during bounded project inspection", async () => {
  process.env.ASTRA_ALLOW_FILE_WRITE = "true";
  const events: AstraBrainEvent[] = [];

  await astraBrain.execute(
    {
      input: "cek project ALURKA, perbaiki error lalu test hasilnya",
      approved: true,
    },
    {
      provider: "auto",
      onEvent: (event) => events.push(event),
    },
  );

  const started = events.find(
    (event) =>
      event.type === "tool.started" &&
      event.visualNode === "drive",
  );
  const completed = events.find(
    (event) =>
      event.type === "tool.completed" &&
      event.visualNode === "drive",
  );

  assert.ok(started);
  assert.ok(completed);
  assert.match(started.label, /Project Context Search/);
});
