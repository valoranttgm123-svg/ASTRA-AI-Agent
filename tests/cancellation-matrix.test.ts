import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { after, before, beforeEach, test } from "node:test";

import { ASTRA_AGENT_MAP } from "../lib/agent/roster";
import { chatWithCloud } from "../lib/brain/cloud";
import { chatWithHermes } from "../lib/brain/hermes";
import { chatWithOllama } from "../lib/brain/ollama";
import type { AstraBrainPermissionSnapshot } from "../lib/brain/types";
import { searchMemorySources } from "../lib/memory/manager";
import type { AstraMemorySource } from "../lib/memory/contracts";
import { generateStrategistPlan } from "../lib/planner/generator";
import { fetchPublicWebPage } from "../lib/tools/browser";
import type { AstraToolLifecycleEvent } from "../lib/tools/contracts";
import { createExecutableToolRegistry } from "../lib/tools/executor";

let server: Server;
let base = "";
const closedPaths = new Set<string>();

const agent = ASTRA_AGENT_MAP.chief_of_staff;
const cloudPolicy: AstraBrainPermissionSnapshot = {
  requireApproval: true,
  allowShell: false,
  allowFileWrite: false,
  allowExternalActions: false,
  allowPaidCloud: true,
};

function slowJson(
  path: string,
  response: import("node:http").ServerResponse,
  payload: unknown,
) {
  const timer = setTimeout(() => {
    if (response.destroyed || response.writableEnded) return;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(payload));
  }, 1500);

  response.on("close", () => {
    clearTimeout(timer);
    closedPaths.add(path);
  });
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1000,
) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) return false;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return true;
}

before(async () => {
  server = createServer((request, response) => {
    const path = request.url ?? "";

    if (path === "/api/tags") {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          models: [{ name: "fixture-model" }],
        }),
      );
      return;
    }

    if (path === "/api/chat") {
      slowJson(path, response, {
        message: {
          role: "assistant",
          content: "late ollama",
        },
      });
      return;
    }

    if (path === "/v1/capabilities") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ tools: [] }));
      return;
    }

    if (path === "/v1/chat/completions") {
      slowJson(path, response, {
        choices: [
          {
            message: {
              content: "late hermes",
            },
          },
        ],
      });
      return;
    }

    if (path === "/models") {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          data: [{ id: "fixture-cloud-model" }],
        }),
      );
      return;
    }

    if (path === "/chat/completions") {
      slowJson(path, response, {
        choices: [
          {
            message: {
              content: "late cloud",
            },
          },
        ],
      });
      return;
    }

    response.statusCode = 404;
    response.end();
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  closedPaths.clear();

  process.env.ASTRA_OLLAMA_ENABLED = "true";
  process.env.ASTRA_OLLAMA_URL = base;
  process.env.ASTRA_OLLAMA_MODEL = "fixture-model";
  process.env.ASTRA_OLLAMA_TIMEOUT_MS = "3000";
  process.env.ASTRA_OLLAMA_STATUS_TIMEOUT_MS = "1000";
  process.env.ASTRA_OLLAMA_THINKING = "false";

  process.env.ASTRA_HERMES_ENABLED = "true";
  process.env.ASTRA_HERMES_URL = base;
  process.env.ASTRA_HERMES_MODEL = "fixture-hermes";
  process.env.ASTRA_HERMES_TIMEOUT_MS = "3000";
  process.env.ASTRA_HERMES_STATUS_TIMEOUT_MS = "1000";

  process.env.ASTRA_CLOUD_ENABLED = "true";
  process.env.ASTRA_CLOUD_URL = base;
  process.env.ASTRA_CLOUD_API_KEY = "fake-test-key";
  process.env.ASTRA_CLOUD_MODEL = "fixture-cloud-model";
  process.env.ASTRA_CLOUD_TIMEOUT_MS = "3000";
  process.env.ASTRA_CLOUD_STATUS_TIMEOUT_MS = "1000";
});

async function expectUserAbort(
  path: string,
  start: (signal: AbortSignal) => Promise<unknown>,
) {
  const controller = new AbortController();
  const pending = start(controller.signal);

  setTimeout(
    () =>
      controller.abort(
        new DOMException("global stop", "AbortError"),
      ),
    50,
  );

  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(
    await waitFor(() => closedPaths.has(path)),
    true,
    path + " connection did not close after abort",
  );
}

test("Phase 15D1 global STOP aborts Ollama Hermes and Cloud in-flight requests", async () => {
  await expectUserAbort("/api/chat", (signal) =>
    chatWithOllama({
      input: "slow",
      agent,
      signal,
    }),
  );

  closedPaths.clear();
  await expectUserAbort("/v1/chat/completions", (signal) =>
    chatWithHermes({
      input: "slow",
      agent,
      signal,
    }),
  );

  closedPaths.clear();
  await expectUserAbort("/chat/completions", (signal) =>
    chatWithCloud({
      input: "slow",
      agent,
      policy: cloudPolicy,
      signal,
    }),
  );
});

test("Phase 15D1 provider timeouts are distinct from user STOP", async () => {
  process.env.ASTRA_OLLAMA_TIMEOUT_MS = "250";
  process.env.ASTRA_HERMES_TIMEOUT_MS = "250";
  process.env.ASTRA_CLOUD_TIMEOUT_MS = "500";

  await assert.rejects(
    chatWithOllama({
      input: "slow",
      agent,
    }),
    { name: "TimeoutError" },
  );

  await assert.rejects(
    chatWithHermes({
      input: "slow",
      agent,
    }),
    { name: "TimeoutError" },
  );

  await assert.rejects(
    chatWithCloud({
      input: "slow",
      agent,
      policy: cloudPolicy,
    }),
    { name: "TimeoutError" },
  );
});

test("Phase 15D1 Strategist planning propagates global STOP through Ollama", async () => {
  const controller = new AbortController();
  const pending = generateStrategistPlan({
    goal: "buat rencana ASTRA yang membutuhkan beberapa langkah",
    signal: controller.signal,
  });

  setTimeout(
    () =>
      controller.abort(
        new DOMException("planner stop", "AbortError"),
      ),
    50,
  );

  await assert.rejects(pending, { name: "AbortError" });
});

test("Phase 15D1 in-flight Memory source cancellation propagates and does not become source degradation", async () => {
  let sourceAborted = false;

  const source: AstraMemorySource = {
    id: "slow-memory",
    type: "obsidian",
    async search(query) {
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () =>
            resolve({
              source: "slow-memory",
              sourceType: "obsidian",
              available: true,
              detail: "late",
              records: [],
            }),
          1500,
        );

        const onAbort = () => {
          sourceAborted = true;
          clearTimeout(timer);
          reject(
            query.signal?.reason instanceof Error
              ? query.signal.reason
              : new DOMException(
                  "memory stop",
                  "AbortError",
                ),
          );
        };

        if (query.signal?.aborted) onAbort();
        else
          query.signal?.addEventListener(
            "abort",
            onAbort,
            { once: true },
          );
      });
    },
  };

  const controller = new AbortController();
  const pending = searchMemorySources(
    {
      input: "ASTRA",
      limit: 3,
      maxChars: 1000,
      signal: controller.signal,
    },
    [source],
  );

  setTimeout(
    () =>
      controller.abort(
        new DOMException("memory stop", "AbortError"),
      ),
    50,
  );

  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(sourceAborted, true);
});

test("Phase 15D1 browser fetch respects an already-aborted global STOP before network work", async () => {
  const controller = new AbortController();
  controller.abort(
    new DOMException("browser stop", "AbortError"),
  );

  await assert.rejects(
    fetchPublicWebPage({
      url: "https://example.com/",
      maxChars: 1000,
      signal: controller.signal,
    }),
    { name: "AbortError" },
  );
});

test("Phase 15D1 Tool Runtime timeout is authoritative even when a buggy handler ignores its signal", async () => {
  let handlerReturned = false;
  const events: AstraToolLifecycleEvent[] = [];

  const runtime = createExecutableToolRegistry(
    [
      {
        id: "fixture.slow",
        name: "Slow Fixture",
        category: "analytics",
        description: "Buggy fixture that ignores cancellation",
        permissionLevel: 1,
        sideEffect: "read",
        timeoutMs: 1000,
        supportsCancellation: true,
        provider: "fixture",
        availability: "READY",
      },
    ],
    {
      "fixture.slow": async () => {
        await new Promise((resolve) =>
          setTimeout(resolve, 1600),
        );
        handlerReturned = true;
        return {
          status: "completed",
          detail: "late success must not win",
          verified: true,
        };
      },
    },
  );

  const started = Date.now();
  const result = await runtime.execute(
    "fixture.slow",
    {},
    {
      approvedPermissionLevel: 1,
      policy: {
        allowShell: false,
        allowFileWrite: false,
        allowExternalActions: false,
      },
      onEvent: (event) => events.push(event),
    },
  );
  const elapsed = Date.now() - started;

  assert.equal(result.status, "failed");
  assert.equal(result.verified, false);
  assert.match(result.detail, /timed out/i);
  assert.ok(elapsed < 1450, `timeout returned too late: ${elapsed}ms`);
  assert.equal(handlerReturned, false);
  assert.equal(
    events.some((event) => event.type === "tool.completed"),
    false,
  );
  assert.equal(
    events.some((event) => event.type === "tool.failed"),
    true,
  );
});

test("Phase 15D1 Tool Runtime global STOP returns promptly even if a buggy handler ignores its signal", async () => {
  const events: AstraToolLifecycleEvent[] = [];

  const runtime = createExecutableToolRegistry(
    [
      {
        id: "fixture.cancel",
        name: "Cancel Fixture",
        category: "analytics",
        description: "Buggy fixture that ignores cancellation",
        permissionLevel: 1,
        sideEffect: "read",
        timeoutMs: 5000,
        supportsCancellation: true,
        provider: "fixture",
        availability: "READY",
      },
    ],
    {
      "fixture.cancel": async () => {
        await new Promise((resolve) =>
          setTimeout(resolve, 1500),
        );
        return {
          status: "completed",
          detail: "late success must not escape",
          verified: true,
        };
      },
    },
  );

  const controller = new AbortController();
  const started = Date.now();
  const pending = runtime.execute(
    "fixture.cancel",
    {},
    {
      approvedPermissionLevel: 1,
      policy: {
        allowShell: false,
        allowFileWrite: false,
        allowExternalActions: false,
      },
      signal: controller.signal,
      onEvent: (event) => events.push(event),
    },
  );

  setTimeout(
    () =>
      controller.abort(
        new DOMException("global stop", "AbortError"),
      ),
    50,
  );

  await assert.rejects(pending, { name: "AbortError" });
  assert.ok(Date.now() - started < 1000);
  assert.equal(
    events.some((event) => event.type === "tool.completed"),
    false,
  );
});
