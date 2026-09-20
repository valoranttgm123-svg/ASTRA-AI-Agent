import assert from "node:assert/strict";
import { test } from "node:test";

import {
  RequestError,
  errorResponse,
} from "../lib/brain/http";
import {
  AstraAutomationService,
} from "../lib/automation/service";
import type {
  AstraToolLifecycleEvent,
} from "../lib/tools/contracts";
import {
  createExecutableToolRegistry,
} from "../lib/tools/executor";
import {
  redactSensitiveText,
  safeErrorDetail,
} from "../lib/security/redaction";

const FAKE_BEARER =
  "Bearer fake_bearer_token_1234567890";
const FAKE_API_KEY =
  "sk-proj-FAKESECRETKEY1234567890";
const FAKE_APPROVAL =
  "approvalToken=11111111-2222-3333-4444-555555555555";
const FAKE_URL =
  "https://example.test/path?token=fake-query-token&ok=1";
const FAKE_WINDOWS_PATH =
  "C:\\Users\\alice\\ASTRA\\private\\auth.json";
const FAKE_UNIX_PATH =
  "/home/alice/ASTRA/private/auth.json";

function secretError() {
  return new Error(
    [
      "Provider failed.",
      "Authorization:",
      FAKE_BEARER,
      "api_key=" + FAKE_API_KEY,
      FAKE_APPROVAL,
      FAKE_URL,
      FAKE_WINDOWS_PATH,
      FAKE_UNIX_PATH,
    ].join(" "),
  );
}

function assertRedacted(value: string) {
  assert.doesNotMatch(
    value,
    /fake_bearer_token_1234567890/i,
  );
  assert.doesNotMatch(
    value,
    /FAKESECRETKEY1234567890/i,
  );
  assert.doesNotMatch(
    value,
    /11111111-2222-3333-4444-555555555555/i,
  );
  assert.doesNotMatch(
    value,
    /fake-query-token/i,
  );
  assert.doesNotMatch(
    value,
    /Users\\alice/i,
  );
  assert.doesNotMatch(
    value,
    /home\/alice/i,
  );
  assert.match(value, /redacted|local-path/i);
}

test("Phase 15E shared redaction removes credentials URL tokens and local paths while preserving useful context", () => {
  const detail = safeErrorDetail(
    secretError(),
    "fallback",
  );

  assert.match(detail, /Provider failed/i);
  assertRedacted(detail);
});

test("Phase 15E redaction bounds public detail size", () => {
  const detail = redactSensitiveText(
    "failure " + "x".repeat(5000),
    200,
  );

  assert.ok(detail.length <= 200);
  assert.match(detail, /…$/);
});

test("Phase 15E HTTP error responses never echo approval tokens or secret material", async () => {
  const response = errorResponse(
    new RequestError(secretError().message, 400),
  );
  const payload = (await response.json()) as {
    ok?: boolean;
    error?: string;
  };

  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.ok(payload.error);
  assertRedacted(payload.error ?? "");
});

test("Phase 15E Tool Runtime scrubs thrown provider errors before result and telemetry exposure", async () => {
  const events: AstraToolLifecycleEvent[] = [];
  const runtime = createExecutableToolRegistry(
    [
      {
        id: "fixture.secret-error",
        name: "Secret Error Fixture",
        category: "analytics",
        description: "Fixture for telemetry redaction",
        permissionLevel: 1,
        sideEffect: "read",
        timeoutMs: 5000,
        supportsCancellation: true,
        provider: "fixture-provider",
        availability: "READY",
      },
    ],
    {
      "fixture.secret-error": async () => {
        throw secretError();
      },
    },
  );

  const result = await runtime.execute(
    "fixture.secret-error",
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

  assert.equal(result.status, "failed");
  assert.equal(result.verified, false);
  assertRedacted(result.detail);

  const failed = events.find(
    (event) => event.type === "tool.failed",
  );
  assert.ok(failed);
  assertRedacted(failed?.detail ?? "");
});

test("Phase 15E Tool Runtime also scrubs provider-supplied failed detail", async () => {
  const runtime = createExecutableToolRegistry(
    [
      {
        id: "fixture.provider-detail",
        name: "Provider Detail Fixture",
        category: "mcp",
        description: "Fixture provider detail",
        permissionLevel: 1,
        sideEffect: "read",
        timeoutMs: 5000,
        supportsCancellation: true,
        provider: "mcp:fixture",
        availability: "READY",
      },
    ],
    {
      "fixture.provider-detail": async () => ({
        status: "failed",
        detail: secretError().message,
        verified: false,
        provider: "mcp:fixture",
      }),
    },
  );

  const result = await runtime.execute(
    "fixture.provider-detail",
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
  assertRedacted(result.detail);
});

test("Phase 15E Automation service status scrubs tick errors before UI status exposure", async () => {
  const service = new AstraAutomationService({
    enabled: true,
    pollIntervalMs: 60_000,
    async tick() {
      throw secretError();
    },
  });

  const result = await service.tickNow();
  assert.equal(result, null);

  const status = service.getStatus();
  assert.equal(status.tickActive, false);
  assert.match(status.lastDetail, /tick failed/i);
  assertRedacted(status.lastDetail);
});
