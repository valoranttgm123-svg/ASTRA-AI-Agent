import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  REQUIRED_MANUAL_OBSERVATION_CHECKS,
  type ManualObservationGateId,
  validateManualGateObservation,
} from "../lib/release/manual-observation";

const COMMIT = "a".repeat(40);
const OTHER_COMMIT = "b".repeat(40);

function observation(
  gate: ManualObservationGateId,
  status: "PASS" | "FAIL" = "PASS",
) {
  return {
    schemaVersion: 1 as const,
    kind:
      "astra-manual-gate-observation" as const,
    gate,
    observedAt:
      "2026-09-21T12:00:00.000Z",
    commit: COMMIT,
    workingTreeClean: true as const,
    releaseVerdict:
      "NOT_EVALUATED" as const,
    checks:
      REQUIRED_MANUAL_OBSERVATION_CHECKS[
        gate
      ].map((id) => ({
        id,
        status,
      })),
  };
}

test("all five non-browser manual gates have explicit required observation checks", () => {
  assert.deepEqual(
    Object.keys(
      REQUIRED_MANUAL_OBSERVATION_CHECKS,
    ).sort(),
    [
      "automation-approval-stop",
      "emergency-stop",
      "full-system-approved-actions",
      "sonor-graph-memory",
      "windows-install-update-reinstall",
    ],
  );

  for (
    const checks of Object.values(
      REQUIRED_MANUAL_OBSERVATION_CHECKS,
    )
  ) {
    assert.ok(checks.length >= 5);
    assert.equal(
      new Set(checks).size,
      checks.length,
    );
  }
});

test("structured manual observation accepts exact current-commit all-PASS evidence", () => {
  const gate:
    ManualObservationGateId =
    "emergency-stop";
  const value = observation(gate);

  assert.equal(
    validateManualGateObservation(
      value,
      gate,
      COMMIT,
    ),
    value,
  );
});

test("structured manual observation rejects wrong gate, commit, missing checks, dirty tree, and failed checks", () => {
  const gate:
    ManualObservationGateId =
    "automation-approval-stop";
  const base = observation(gate);

  assert.throws(
    () =>
      validateManualGateObservation(
        base,
        gate,
        OTHER_COMMIT,
      ),
    /provenance|schema/i,
  );

  assert.throws(
    () =>
      validateManualGateObservation(
        {
          ...base,
          workingTreeClean: false,
        },
        gate,
        COMMIT,
      ),
    /provenance|schema/i,
  );

  assert.throws(
    () =>
      validateManualGateObservation(
        {
          ...base,
          checks: base.checks.slice(1),
        },
        gate,
        COMMIT,
      ),
    /exactly the required checks/i,
  );

  const failed = observation(
    gate,
    "FAIL",
  );
  assert.throws(
    () =>
      validateManualGateObservation(
        failed,
        gate,
        COMMIT,
      ),
    /not all PASS/i,
  );

  assert.equal(
    validateManualGateObservation(
      failed,
      gate,
      COMMIT,
      {
        requireAllPass: false,
      },
    ),
    failed,
  );
});

test("manual gate recorder routes PASS evidence through semantic validators", () => {
  const source = readFileSync(
    path.resolve(
      "scripts",
      "release",
      "record-manual-gate.ts",
    ),
    "utf8",
  );
  const observationRecorder =
    readFileSync(
      path.resolve(
        "scripts",
        "release",
        "record-manual-observation.ts",
      ),
      "utf8",
    );

  assert.match(
    source,
    /validateBrowserReleaseBundle/,
  );
  assert.match(
    source,
    /validateManualGateObservation/,
  );
  assert.match(
    observationRecorder,
    /finalReleaseStatus:[\s\S]*NOT_EVALUATED/,
  );
  assert.match(
    observationRecorder,
    /cleanRepositorySnapshot/,
  );
  assert.match(
    observationRecorder,
    /assertSameCleanRepositorySnapshot/,
  );
});
