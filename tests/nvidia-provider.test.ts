import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, test } from "node:test";

import { ASTRA_AGENT_MAP } from "../lib/agent/roster";
import { astraBrain } from "../lib/brain/adapter";
import { parseAgentRequest } from "../lib/brain/http";
import {
  chatWithNvidia,
  getNvidiaStatus,
  nvidiaAutoFallbackEnabled,
  nvidiaMayReceiveMemory,
  NVIDIA_NIM_DEFAULT_MODEL,
} from "../lib/brain/nvidia";
import type { AstraBrainEvent } from "../lib/brain/types";

let server: http.Server;
let rootUrl = "";
let chatCalls = 0;
let lastAuthorization: string | undefined;

before(async () => {
  server = http.createServer(async (request, response) => {
    if (request.url === "/v1/models" && request.method === "GET") {
      lastAuthorization = request.headers.authorization;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          object: "list",
          data: [
            {
              id: NVIDIA_NIM_DEFAULT_MODEL,
              object: "model",
            },
          ],
        }),
      );
      return;
    }

    if (
      request.url === "/v1/chat/completions" &&
      request.method === "POST"
    ) {
      chatCalls += 1;
      lastAuthorization = request.headers.authorization;
      let raw = "";
      for await (const chunk of request) {
        raw += chunk.toString();
      }
      const body = JSON.parse(raw) as {
        model?: string;
        stream?: boolean;
      };
      assert.equal(body.model, NVIDIA_NIM_DEFAULT_MODEL);
      assert.equal(body.stream, false);

      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: "NVIDIA NEMOTRON SIAP",
              },
            },
          ],
        }),
      );
      return;
    }

    response.statusCode = 404;
    response.end("not found");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("NVIDIA fixture did not expose a TCP address.");
  }
  rootUrl = `http://127.0.0.1:${address.port}/v1`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

beforeEach(() => {
  process.env.ASTRA_NVIDIA_ENABLED = "true";
  process.env.ASTRA_NVIDIA_URL = rootUrl;
  process.env.ASTRA_NVIDIA_MODEL = NVIDIA_NIM_DEFAULT_MODEL;
  process.env.ASTRA_NVIDIA_AUTO_FALLBACK = "false";
  process.env.ASTRA_NVIDIA_INCLUDE_MEMORY = "false";
  process.env.ASTRA_NVIDIA_TIMEOUT_MS = "3000";
  process.env.ASTRA_NVIDIA_STATUS_TIMEOUT_MS = "1000";
  delete process.env.NVIDIA_API_KEY;

  process.env.ASTRA_MEMORY_ENABLED = "false";
  process.env.ASTRA_PROJECTS_ENABLED = "false";
  process.env.ASTRA_SKILLS_ENABLED = "false";
  process.env.ASTRA_SONOR_ENABLED = "false";

  chatCalls = 0;
  lastAuthorization = undefined;
});

test("NVIDIA provider is accepted by the public request parser", () => {
  const parsed = parseAgentRequest({
    message: "reason about this",
    provider: "nvidia",
  });
  assert.equal(parsed.provider, "nvidia");
});

test("NVIDIA NIM status verifies the exact configured model", async () => {
  const status = await getNvidiaStatus();
  assert.equal(status.enabled, true);
  assert.equal(status.available, true);
  assert.equal(status.model, NVIDIA_NIM_DEFAULT_MODEL);
  assert.equal(lastAuthorization, undefined);
});

test("NVIDIA NIM chat uses bounded OpenAI-compatible payloads", async () => {
  const result = await chatWithNvidia({
    input: "halo",
    agent: ASTRA_AGENT_MAP.chief_of_staff,
  });

  assert.equal(result.message, "NVIDIA NEMOTRON SIAP");
  assert.equal(result.model, NVIDIA_NIM_DEFAULT_MODEL);
  assert.equal(chatCalls, 1);
  assert.equal(lastAuthorization, undefined);
});

test("explicit NVIDIA mode does not silently route through local providers", async () => {
  const events: AstraBrainEvent[] = [];
  const result = await astraBrain.chat("halo", {
    provider: "nvidia",
    onEvent: (event) => events.push(event),
  });

  assert.equal(result.state, "completed");
  assert.equal(result.brain.provider, "nvidia");
  assert.equal(chatCalls, 1);
  assert.ok(
    events.some(
      (event) =>
        event.type === "provider.selected" &&
        event.provider === "nvidia",
    ),
  );
  assert.equal(
    events.some(
      (event) =>
        event.type === "provider.selected" &&
        (event.provider === "ollama" ||
          event.provider === "hermes" ||
          event.provider === "codex"),
    ),
    false,
  );
});

test("NVIDIA memory and AUTO fallback remain explicit opt-ins", () => {
  assert.equal(nvidiaMayReceiveMemory(), false);
  assert.equal(nvidiaAutoFallbackEnabled(), false);

  process.env.ASTRA_NVIDIA_INCLUDE_MEMORY = "true";
  process.env.ASTRA_NVIDIA_AUTO_FALLBACK = "true";
  assert.equal(nvidiaMayReceiveMemory(), true);
  assert.equal(nvidiaAutoFallbackEnabled(), true);
});

test("hosted NVIDIA endpoint requires a private API key", async () => {
  process.env.ASTRA_NVIDIA_URL =
    "https://integrate.api.nvidia.com/v1";
  delete process.env.NVIDIA_API_KEY;

  const status = await getNvidiaStatus();
  assert.equal(status.available, false);
  assert.match(status.detail, /NVIDIA_API_KEY.*missing/i);

  await assert.rejects(
    chatWithNvidia({
      input: "halo",
      agent: ASTRA_AGENT_MAP.chief_of_staff,
    }),
    /NVIDIA_API_KEY is required/i,
  );
});

test("NVIDIA provider rejects lookalike remote hosts and embedded credentials", async () => {
  process.env.NVIDIA_API_KEY = "fixture-secret";

  process.env.ASTRA_NVIDIA_URL =
    "https://integrate.api.nvidia.com.evil.example/v1";
  let status = await getNvidiaStatus();
  assert.equal(status.available, false);
  assert.match(status.detail, /exactly https:\/\/integrate\.api\.nvidia\.com\/v1/i);

  process.env.ASTRA_NVIDIA_URL =
    "https://user:password@integrate.api.nvidia.com/v1";
  status = await getNvidiaStatus();
  assert.equal(status.available, false);
  assert.match(status.detail, /embedded credentials/i);
});

test("explicit NVIDIA execution stays reasoning-only", async () => {
  const result = await astraBrain.execute(
    {
      input: "ubah file ini",
      approved: true,
    },
    {
      provider: "nvidia",
    },
  );

  assert.equal(result.state, "blocked");
  assert.equal(result.brain.execution, "blocked");
  assert.match(result.message, /reasoning|Codex|Auto/i);
  assert.equal(chatCalls, 0);
});
