import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { after, before, beforeEach, test } from "node:test";

import { ASTRA_AGENT_MAP } from "../lib/agent/roster";
import {
  chatWithCloud,
  getCloudStatus,
} from "../lib/brain/cloud";
import {
  getCodexStatus,
  parseCodexLine,
} from "../lib/brain/codex";
import {
  chatWithHermes,
  getHermesStatus,
} from "../lib/brain/hermes";
import {
  chatWithOllama,
  getOllamaStatus,
} from "../lib/brain/ollama";
import type { AstraBrainPermissionSnapshot } from "../lib/brain/types";

type Mode =
  | "valid"
  | "malformed"
  | "primitive"
  | "empty"
  | "oversized"
  | "http503"
  | "missing-model"
  | "bad-models-field";

let server: Server;
let base = "";

let ollamaTagsMode: Mode = "valid";
let ollamaChatMode: Mode = "valid";
let hermesCapabilitiesMode: Mode = "valid";
let hermesChatMode: Mode = "valid";
let cloudModelsMode: Mode = "valid";
let cloudChatMode: Mode = "valid";

const agent = ASTRA_AGENT_MAP.chief_of_staff;

const cloudPolicy: AstraBrainPermissionSnapshot = {
  requireApproval: true,
  allowShell: false,
  allowFileWrite: false,
  allowExternalActions: false,
  allowPaidCloud: true,
};

function writeMode(
  response: import("node:http").ServerResponse,
  mode: Mode,
  validPayload: unknown,
) {
  if (mode === "http503") {
    response.statusCode = 503;
    response.end("fixture provider unavailable");
    return;
  }

  response.setHeader("content-type", "application/json");

  if (mode === "malformed") {
    response.end("{not-json");
    return;
  }

  if (mode === "primitive") {
    response.end(JSON.stringify("primitive"));
    return;
  }

  if (mode === "empty") {
    response.end("");
    return;
  }

  if (mode === "oversized") {
    response.end(JSON.stringify({ blob: "x".repeat(1_050_000) }));
    return;
  }

  response.end(JSON.stringify(validPayload));
}

before(async () => {
  server = createServer(async (request, response) => {
    if (request.url === "/api/tags") {
      if (ollamaTagsMode === "bad-models-field") {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ models: "not-an-array" }));
        return;
      }

      const payload =
        ollamaTagsMode === "missing-model"
          ? { models: [{ name: "other-model" }] }
          : { models: [{ name: "fixture-model" }] };
      writeMode(response, ollamaTagsMode, payload);
      return;
    }

    if (request.url === "/api/chat") {
      writeMode(response, ollamaChatMode, {
        message: {
          role: "assistant",
          content: "ollama fixture response",
        },
        done: true,
      });
      return;
    }

    if (request.url === "/v1/capabilities") {
      writeMode(response, hermesCapabilitiesMode, {
        tools: [],
        status: "ok",
      });
      return;
    }

    if (request.url === "/v1/chat/completions") {
      writeMode(response, hermesChatMode, {
        choices: [
          {
            message: {
              content: "hermes fixture response",
            },
          },
        ],
      });
      return;
    }

    if (request.url === "/models") {
      writeMode(response, cloudModelsMode, {
        data: [{ id: "fixture-cloud-model" }],
      });
      return;
    }

    if (request.url === "/chat/completions") {
      writeMode(response, cloudChatMode, {
        choices: [
          {
            message: {
              content: "cloud fixture response",
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
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  ollamaTagsMode = "valid";
  ollamaChatMode = "valid";
  hermesCapabilitiesMode = "valid";
  hermesChatMode = "valid";
  cloudModelsMode = "valid";
  cloudChatMode = "valid";

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
  delete process.env.ASTRA_HERMES_API_KEY;

  process.env.ASTRA_CLOUD_ENABLED = "true";
  process.env.ASTRA_CLOUD_URL = base;
  process.env.ASTRA_CLOUD_API_KEY = "fake-test-key";
  process.env.ASTRA_CLOUD_MODEL = "fixture-cloud-model";
  process.env.ASTRA_CLOUD_TIMEOUT_MS = "3000";
  process.env.ASTRA_CLOUD_STATUS_TIMEOUT_MS = "1000";

  process.env.ASTRA_CODEX_ENABLED = "true";
});

test("Phase 15C2 Ollama status and chat accept only structured bounded payloads", async () => {
  const status = await getOllamaStatus();
  assert.equal(status.available, true);
  assert.equal(status.model, "fixture-model");

  const chat = await chatWithOllama({
    input: "fixture",
    agent,
  });
  assert.equal(chat.message, "ollama fixture response");

  ollamaTagsMode = "malformed";
  const malformedStatus = await getOllamaStatus();
  assert.equal(malformedStatus.available, false);
  assert.match(malformedStatus.detail, /malformed JSON/i);

  ollamaTagsMode = "missing-model";
  const missing = await getOllamaStatus();
  assert.equal(missing.available, false);
  assert.equal(missing.model, "fixture-model");

  ollamaTagsMode = "valid";
  ollamaChatMode = "malformed";
  await assert.rejects(
    chatWithOllama({
      input: "fixture",
      agent,
    }),
    /malformed JSON/i,
  );

  ollamaChatMode = "oversized";
  await assert.rejects(
    chatWithOllama({
      input: "fixture",
      agent,
    }),
    /size limit/i,
  );

  ollamaChatMode = "http503";
  await assert.rejects(
    chatWithOllama({
      input: "fixture",
      agent,
    }),
    /HTTP 503/i,
  );
});

test("Phase 15C2 Ollama rejects a malformed models field instead of fabricating readiness", async () => {
  ollamaTagsMode = "bad-models-field";

  const status = await getOllamaStatus();
  assert.equal(status.available, false);
  assert.match(status.detail, /malformed model list/i);
});

test("Phase 15C2 Hermes status validates the capabilities payload before reporting available", async () => {
  const status = await getHermesStatus();
  assert.equal(status.available, true);

  hermesCapabilitiesMode = "malformed";
  const malformed = await getHermesStatus();
  assert.equal(malformed.available, false);
  assert.match(malformed.detail, /malformed JSON/i);

  hermesCapabilitiesMode = "primitive";
  const primitive = await getHermesStatus();
  assert.equal(primitive.available, false);
  assert.match(primitive.detail, /malformed payload/i);

  hermesCapabilitiesMode = "oversized";
  const oversized = await getHermesStatus();
  assert.equal(oversized.available, false);
  assert.match(oversized.detail, /size limit/i);

  hermesCapabilitiesMode = "http503";
  const unavailable = await getHermesStatus();
  assert.equal(unavailable.available, false);
  assert.match(unavailable.detail, /HTTP 503/i);
});

test("Phase 15C2 Hermes chat fails closed on malformed empty oversized and HTTP-error responses", async () => {
  const ok = await chatWithHermes({
    input: "fixture",
    agent,
  });
  assert.equal(ok.message, "hermes fixture response");

  for (const [mode, expected] of [
    ["malformed", /malformed JSON/i],
    ["empty", /empty JSON response/i],
    ["oversized", /size limit/i],
    ["http503", /HTTP 503/i],
  ] as const) {
    hermesChatMode = mode;
    await assert.rejects(
      chatWithHermes({
        input: "fixture",
        agent,
      }),
      expected,
    );
  }
});

test("Phase 15C2 Hermes refuses non-loopback endpoints", async () => {
  process.env.ASTRA_HERMES_URL = "https://example.com";
  const status = await getHermesStatus();
  assert.equal(status.available, false);
  assert.match(status.detail, /loopback/i);

  await assert.rejects(
    chatWithHermes({
      input: "fixture",
      agent,
    }),
    /loopback/i,
  );
});

test("Phase 15C2 Cloud remains policy-gated and validates models status payload", async () => {
  const denied = await getCloudStatus({
    ...cloudPolicy,
    allowPaidCloud: false,
  });
  assert.equal(denied.available, false);
  assert.match(denied.detail, /blocked/i);

  const status = await getCloudStatus(cloudPolicy);
  assert.equal(status.available, true);

  cloudModelsMode = "malformed";
  const malformed = await getCloudStatus(cloudPolicy);
  assert.equal(malformed.available, false);
  assert.match(malformed.detail, /malformed JSON/i);

  cloudModelsMode = "primitive";
  const primitive = await getCloudStatus(cloudPolicy);
  assert.equal(primitive.available, false);
  assert.match(primitive.detail, /malformed payload/i);

  cloudModelsMode = "oversized";
  const oversized = await getCloudStatus(cloudPolicy);
  assert.equal(oversized.available, false);
  assert.match(oversized.detail, /size limit/i);

  cloudModelsMode = "http503";
  const unavailable = await getCloudStatus(cloudPolicy);
  assert.equal(unavailable.available, false);
  assert.match(unavailable.detail, /HTTP 503/i);
});

test("Phase 15C2 Cloud chat fails closed on malformed empty oversized and HTTP-error responses", async () => {
  const ok = await chatWithCloud({
    input: "fixture",
    agent,
    policy: cloudPolicy,
  });
  assert.equal(ok.message, "cloud fixture response");

  for (const [mode, expected] of [
    ["malformed", /malformed JSON/i],
    ["empty", /empty JSON response/i],
    ["oversized", /size limit/i],
    ["http503", /HTTP 503/i],
  ] as const) {
    cloudChatMode = mode;
    await assert.rejects(
      chatWithCloud({
        input: "fixture",
        agent,
        policy: cloudPolicy,
      }),
      expected,
    );
  }
});

test("Phase 15C2 incomplete Cloud configuration is unavailable before any chat call", async () => {
  delete process.env.ASTRA_CLOUD_API_KEY;
  const status = await getCloudStatus(cloudPolicy);
  assert.equal(status.available, false);
  assert.match(status.detail, /missing/i);

  await assert.rejects(
    chatWithCloud({
      input: "fixture",
      agent,
      policy: cloudPolicy,
    }),
    /incomplete/i,
  );
});

test("Phase 15C2 Codex status is truthful when executable is absent", async () => {
  process.env.ASTRA_CODEX_COMMAND =
    process.platform === "win32"
      ? "Z:\\definitely-missing\\codex.exe"
      : "/definitely/missing/codex";

  const status = await getCodexStatus({
    requireApproval: true,
    allowShell: false,
    allowFileWrite: false,
    allowExternalActions: false,
    allowPaidCloud: false,
  });

  assert.equal(status.available, false);
  assert.match(status.detail, /unavailable/i);
  assert.equal(status.sandbox, "read-only");
});

test("Phase 15C2 Codex JSONL parser ignores malformed lines and accepts bounded agent messages", () => {
  assert.equal(parseCodexLine("not-json"), null);
  assert.equal(parseCodexLine("{broken"), null);

  const parsed = parseCodexLine(
    JSON.stringify({
      type: "item.completed",
      item: {
        type: "agent_message",
        text: "fixture",
      },
    }),
  );

  assert.equal(parsed?.type, "item.completed");
  assert.equal(parsed?.item?.text, "fixture");
});
