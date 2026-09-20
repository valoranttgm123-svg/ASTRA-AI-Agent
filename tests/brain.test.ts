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
      { id: "one", text: "ASTRA local provider decision", tags: ["astra"] },
      { id: "two", text: "Ollama remains private and bounded", tags: ["ollama"] },
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

test("memory retrieval is local and bounded", async () => {
  const context = await getMemoryContext("Ollama ASTRA");
  assert.equal(context.entries.length, 1);
  assert.ok(context.text.length <= 80);
  assert.match(context.text, /ASTRA|Ollama/);
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
