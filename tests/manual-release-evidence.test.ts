import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isManualGateId,
  upsertManualGate,
} from "../lib/release/manual-evidence";

test("manual gate recorder recognizes only the six Phase 20 manual gates", () => {
  assert.equal(
    isManualGateId(
      "emergency-stop",
    ),
    true,
  );
  assert.equal(
    isManualGateId(
      "fake-ready-gate",
    ),
    false,
  );
});

test("manual gate recorder refuses PASS without real evidence metadata", () => {
  assert.throws(
    () =>
      upsertManualGate(null, {
        gate: "emergency-stop",
        status: "PASS",
      }),
    /PASS requires observedAt and evidencePath/,
  );
});

test("manual gate recorder upserts one gate without duplicating other evidence", () => {
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
      note: "Retest passed.",
    },
  );

  assert.equal(
    second.gates.length,
    1,
  );
  assert.equal(
    second.gates[0].status,
    "PASS",
  );
  assert.equal(
    second.gates[0].note,
    "Retest passed.",
  );
  assert.equal(
    second.externalConfigurationRequired,
    true,
  );
});
