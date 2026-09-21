import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isManualGateId,
  upsertManualGate,
} from "../lib/release/manual-evidence";

const COMMIT = "a".repeat(40);
const SHA256 = "b".repeat(64);

test("manual gate recorder recognizes only the six Phase 20 manual gates", () => {
  assert.equal(
    isManualGateId("emergency-stop"),
    true,
  );
  assert.equal(
    isManualGateId("fake-ready-gate"),
    false,
  );
});

test("manual gate recorder refuses PASS without integrity and commit metadata", () => {
  assert.throws(
    () =>
      upsertManualGate(null, {
        gate: "emergency-stop",
        status: "PASS",
        observedAt:
          "2026-09-21T08:10:00.000Z",
        evidencePath:
          ".astra/validation/stop-pass.json",
      }),
    /evidenceSha256|evidenceBytes|commit/,
  );
});

test("manual gate recorder upserts one gate with immutable evidence metadata", () => {
  const first = upsertManualGate(
    null,
    {
      gate: "emergency-stop",
      status: "FAIL",
      observedAt:
        "2026-09-21T08:00:00.000Z",
      evidencePath:
        ".astra/validation/stop.json",
      note: "STOP evidence failed.",
    },
  );

  const second = upsertManualGate(
    first,
    {
      gate: "emergency-stop",
      status: "PASS",
      observedAt:
        "2026-09-21T08:10:00.000Z",
      evidencePath:
        ".astra/validation/stop-pass.json",
      evidenceSha256: SHA256,
      evidenceBytes: 128,
      commit: COMMIT,
      note: "Retest passed.",
    },
  );

  assert.equal(second.gates.length, 1);
  assert.equal(
    second.gates[0].status,
    "PASS",
  );
  assert.equal(
    second.gates[0].note,
    "Retest passed.",
  );
  assert.equal(
    second.gates[0].evidenceSha256,
    SHA256,
  );
  assert.equal(
    second.gates[0].evidenceBytes,
    128,
  );
  assert.equal(
    second.gates[0].commit,
    COMMIT,
  );
});

test("manual gate validation rejects malformed integrity metadata", () => {
  assert.throws(
    () =>
      upsertManualGate(null, {
        gate: "emergency-stop",
        status: "PASS",
        observedAt:
          "2026-09-21T08:10:00.000Z",
        evidencePath:
          ".astra/validation/stop-pass.json",
        evidenceSha256: "not-a-hash",
        evidenceBytes: 128,
        commit: COMMIT,
      }),
    /SHA-256/,
  );

  assert.throws(
    () =>
      upsertManualGate(null, {
        gate: "emergency-stop",
        status: "PASS",
        observedAt:
          "2026-09-21T08:10:00.000Z",
        evidencePath:
          ".astra/validation/stop-pass.json",
        evidenceSha256: SHA256,
        evidenceBytes: 0,
        commit: COMMIT,
      }),
    /byte size/,
  );
});
