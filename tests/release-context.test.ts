import assert from "node:assert/strict";
import { test } from "node:test";

import {
  updateReleaseContext,
} from "../lib/release/release-context";

test("release context recorder updates final-report labels without changing gate evidence", () => {
  const result = updateReleaseContext(
    {
      schemaVersion: 1,
      gates: [
        {
          id: "emergency-stop",
          status: "NOT_RUN",
        },
      ],
      externalConfigurationRequired:
        true,
    },
    {
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

  assert.equal(
    result.gates.length,
    1,
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

test("release context labels are bounded deduplicated and secret-like material is scrubbed", () => {
  const result = updateReleaseContext(
    null,
    {
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
