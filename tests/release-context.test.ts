import assert from "node:assert/strict";
import { test } from "node:test";

import {
  updateReleaseContext,
} from "../lib/release/release-context";

const COMMIT = "a".repeat(40);
const RECORDED_AT =
  "2026-09-21T09:00:00.000Z";

test("release context recorder stamps commit/time and preserves gate evidence", () => {
  const result = updateReleaseContext(
    {
      schemaVersion: 1,
      gates: [
        {
          id: "emergency-stop",
          status: "NOT_RUN",
        },
      ],
    },
    {
      recordedAt: RECORDED_AT,
      commit: COMMIT,
      connected: [
        "Ollama",
        "Codex CLI",
      ],
      requiresUserLogin: [
        "Gmail OAuth",
      ],
      notImplemented: [
        "Visual screen understanding",
      ],
      externalConfigurationRequired:
        true,
    },
  );

  assert.equal(result.gates.length, 1);
  assert.equal(
    result.contextRecordedAt,
    RECORDED_AT,
  );
  assert.equal(
    result.contextCommit,
    COMMIT,
  );
  assert.deepEqual(
    result.connected,
    ["Ollama", "Codex CLI"],
  );
  assert.deepEqual(
    result.requiresUserLogin,
    ["Gmail OAuth"],
  );
  assert.deepEqual(
    result.notImplemented,
    ["Visual screen understanding"],
  );
});

test("release context defaults missing lists and external config conservatively", () => {
  const result = updateReleaseContext(
    null,
    {
      recordedAt: RECORDED_AT,
      commit: COMMIT,
      connected: ["Ollama"],
    },
  );

  assert.deepEqual(
    result.connected,
    ["Ollama"],
  );
  assert.deepEqual(
    result.requiresUserLogin,
    [],
  );
  assert.deepEqual(
    result.notImplemented,
    [],
  );
  assert.equal(
    result.externalConfigurationRequired,
    true,
  );
});

test("release context labels are bounded deduplicated and secret-like material is scrubbed", () => {
  const result = updateReleaseContext(
    null,
    {
      recordedAt: RECORDED_AT,
      commit: COMMIT,
      connected: [
        "Ollama",
        "Ollama",
        "Authorization: Bearer sk-proj-FAKESECRET123456789",
      ],
    },
  );

  assert.equal(
    result.connected?.filter(
      (item) => item === "Ollama",
    ).length,
    1,
  );
  assert.doesNotMatch(
    JSON.stringify(result.connected),
    /FAKESECRET123456789/,
  );
});

test("release context rejects invalid provenance metadata", () => {
  assert.throws(
    () =>
      updateReleaseContext(
        null,
        {
          recordedAt: "invalid",
          commit: COMMIT,
          connected: [],
        },
      ),
    /recordedAt/,
  );

  assert.throws(
    () =>
      updateReleaseContext(
        null,
        {
          recordedAt: RECORDED_AT,
          commit: "short",
          connected: [],
        },
      ),
    /commit/,
  );
});
