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
  NVIDIA_JARVIS_MODELS,
  selectNvidiaJarvisProfile,
} from "../lib/brain/nvidia";
import type { AstraBrainEvent } from "../lib/brain/types";

let server: http.Server;
let rootUrl = "";
let chatCalls = 0;
let lastAuthorization: string | undefined;
let lastBody: Record<string, unknown> | null = null;

before(async () => {
  server = http.createServer(async (request, response) => {
    if (request.url === "/v1/models" && request.method === "GET") {
      lastAuthorization = request.headers.authorization;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          object: "list",
          data: Object.values(NVIDIA_JARVIS_MODELS).map((id) => ({
            id,
            object: "model",
          })),
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
      lastBody = JSON.parse(raw) as Record<string, unknown>;
      assert.equal(lastBody.stream, false);
      assert.ok(
        Object.values(NVIDIA_JARVIS_MODELS).includes(
          lastBody.model as (typeof NVIDIA_JARVIS_MODELS)[keyof typeof NVIDIA_JARVIS_MODELS],
        ),
      );

      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: "NVIDIA JARVIS MESH SIAP",
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
  process.env.ASTRA_NVIDIA_MODEL = NVIDIA_JARVIS_MODELS.chief;
  process.env.ASTRA_NVIDIA_MODEL_CHIEF = NVIDIA_JARVIS_MODELS.chief;
  process.env.ASTRA_NVIDIA_MODEL_DEEP = NVIDIA_JARVIS_MODELS.deep;
  process.env.ASTRA_NVIDIA_MODEL_FAST = NVIDIA_JARVIS_MODELS.fast;
  process.env.ASTRA_NVIDIA_MODEL_VISION = NVIDIA_JARVIS_MODELS.vision;
  process.env.ASTRA_NVIDIA_ROUTER_MODE = "auto";
  process.env.ASTRA_NVIDIA_THINKING = "true";
  process.env.ASTRA_NVIDIA_AUTO_FALLBACK = "false";
  process.env.ASTRA_NVIDIA_INCLUDE_MEMORY = "false";
  process.env.ASTRA_NVIDIA_TIMEOUT_MS = "3000";
  process.env.ASTRA_NVIDIA_STATUS_TIMEOUT_MS = "1000";
  delete process.env.NVIDIA_API_KEY;

  process.env.ASTRA_MEMORY_ENABLED = "false";
  process.env.ASTRA_PROJECTS_ENABLED = "false";
  process.env.ASTRA_SKILLS_ENABLED = "false";
  process.env.ASTRA_SONOR_ENABLED = "false";
  process.env.ASTRA_HERMES_ENABLED = "false";
  process.env.ASTRA_OLLAMA_ENABLED = "false";
  process.env.ASTRA_CODEX_ENABLED = "false";

  chatCalls = 0;
  lastAuthorization = undefined;
  lastBody = null;
});

test("JARVIS model catalog matches NVIDIA live model IDs", () => {
  assert.equal(NVIDIA_JARVIS_MODELS.chief, "nvidia/nemotron-3-ultra-550b-a55b");
  assert.equal(NVIDIA_JARVIS_MODELS.fast, "nvidia/nemotron-3.5-lightning-30b-a3b");
  assert.equal(NVIDIA_JARVIS_MODELS.deep, "z-ai/glm-5.3");
  assert.equal(NVIDIA_JARVIS_MODELS.vision, "z-ai/glm-5.3-flash");
});

test("NVIDIA provider is accepted by the public request parser", () => {
  const parsed = parseAgentRequest({
    message: "reason about this",
    provider: "nvidia",
  });
  assert.equal(parsed.provider, "nvidia");
});

test("JARVIS router selects fast, deep, chief, and vision profiles deterministically", () => {
  assert.equal(
    selectNvidiaJarvisProfile({
      input: "halo, apa kabar?",
      agent: ASTRA_AGENT_MAP.chief_of_staff,
    }),
    "fast",
  );

  assert.equal(
    selectNvidiaJarvisProfile({
      input: "review bug TypeScript di repository ini",
      agent: ASTRA_AGENT_MAP.developer,
    }),
    "deep",
  );

  assert.equal(
    selectNvidiaJarvisProfile({
      input:
        "Analisis strategi dan arsitektur sistem multi-agent ini secara mendalam, bandingkan trade-off lalu buat rencana.",
      agent: ASTRA_AGENT_MAP.chief_of_staff,
    }),
    "chief",
  );

  assert.equal(
    selectNvidiaJarvisProfile({
      input: "jelaskan isi gambar ini",
      agent: ASTRA_AGENT_MAP.chief_of_staff,
      visualContentProvided: true,
    }),
    "vision",
  );
});

test("NVIDIA NIM status verifies the complete JARVIS model mesh", async () => {
  const status = await getNvidiaStatus();
  assert.equal(status.enabled, true);
  assert.equal(status.available, true);
  assert.equal(status.model, NVIDIA_JARVIS_MODELS.chief);
  assert.equal(status.models?.length, 4);
  assert.ok(status.models?.every((entry) => entry.available));
  assert.match(status.detail, /Chief=.*Ultra.*Deep=.*GLM.*Fast=.*Lightning.*Vision=.*Flash/i);
  assert.equal(lastAuthorization, undefined);
});

test("short NVIDIA chat uses Lightning fast profile", async () => {
  const result = await chatWithNvidia({
    input: "halo",
    agent: ASTRA_AGENT_MAP.chief_of_staff,
  });

  assert.equal(result.message, "NVIDIA JARVIS MESH SIAP");
  assert.equal(result.profile, "fast");
  assert.equal(result.model, NVIDIA_JARVIS_MODELS.fast);
  assert.equal(chatCalls, 1);
  assert.equal(lastBody?.model, NVIDIA_JARVIS_MODELS.fast);
  assert.deepEqual(lastBody?.chat_template_kwargs, {
    enable_thinking: true,
  });
  assert.equal(lastBody?.reasoning_budget, 4096);
});

test("developer NVIDIA chat uses GLM-5.3 deep profile", async () => {
  const result = await chatWithNvidia({
    input: "debug dan refactor TypeScript API ini",
    agent: ASTRA_AGENT_MAP.developer,
  });

  assert.equal(result.profile, "deep");
  assert.equal(result.model, NVIDIA_JARVIS_MODELS.deep);
  assert.equal(lastBody?.model, NVIDIA_JARVIS_MODELS.deep);
  assert.equal(lastBody?.chat_template_kwargs, undefined);
});

test("complex planning NVIDIA chat uses Nemotron Ultra chief profile", async () => {
  const result = await chatWithNvidia({
    input:
      "Buat analisis strategi, planning, trade-off, dan arsitektur agent yang paling aman untuk ASTRA.",
    agent: ASTRA_AGENT_MAP.chief_of_staff,
  });

  assert.equal(result.profile, "chief");
  assert.equal(result.model, NVIDIA_JARVIS_MODELS.chief);
  assert.equal(lastBody?.model, NVIDIA_JARVIS_MODELS.chief);
  assert.deepEqual(lastBody?.chat_template_kwargs, {
    enable_thinking: true,
  });
});

test("real visual payload flag routes to GLM-5.3 Flash vision profile", async () => {
  const result = await chatWithNvidia({
    input: "analisis tampilan ini",
    agent: ASTRA_AGENT_MAP.chief_of_staff,
    visualContentProvided: true,
  });

  assert.equal(result.profile, "vision");
  assert.equal(result.model, NVIDIA_JARVIS_MODELS.vision);
  assert.equal(lastBody?.model, NVIDIA_JARVIS_MODELS.vision);
});

test("router mode can pin a model profile without changing the public provider", async () => {
  process.env.ASTRA_NVIDIA_ROUTER_MODE = "chief";
  const result = await chatWithNvidia({
    input: "halo",
    agent: ASTRA_AGENT_MAP.chief_of_staff,
  });

  assert.equal(result.profile, "chief");
  assert.equal(result.model, NVIDIA_JARVIS_MODELS.chief);
});

test("explicit NVIDIA mode reports the actual selected submodel", async () => {
  const events: AstraBrainEvent[] = [];
  const result = await astraBrain.chat("halo", {
    provider: "nvidia",
    onEvent: (event) => events.push(event),
  });

  assert.equal(result.state, "completed");
  assert.equal(result.brain.provider, "nvidia");
  assert.equal(result.brain.model, NVIDIA_JARVIS_MODELS.fast);
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
  assert.match(
    status.detail,
    /exactly https:\/\/integrate\.api\.nvidia\.com\/v1/i,
  );

  process.env.ASTRA_NVIDIA_URL =
    "https://user:password@integrate.api.nvidia.com/v1";
  status = await getNvidiaStatus();
  assert.equal(status.available, false);
  assert.match(status.detail, /embedded credentials/i);
});

test("NVIDIA status fails closed when one mesh profile disappears", async () => {
  process.env.ASTRA_NVIDIA_MODEL_VISION = "missing/vision-model";
  const status = await getNvidiaStatus();
  assert.equal(status.available, false);
  assert.match(status.detail, /vision=missing\/vision-model/i);
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
