import assert from "node:assert/strict";
import { test } from "node:test";

import {
  evaluateCoreRelease,
  renderCoreReleaseMarkdown,
  validateManualReleaseEvidence,
} from "../lib/release/core-report";

const COMMIT = "a".repeat(40);
const OTHER_COMMIT = "c".repeat(40);
const SHA256 = "b".repeat(64);

const repositoryGateEvidence = {
  schemaVersion: 1,
  capturedAt: "2026-09-21T00:00:00.000Z",
  commit: COMMIT,
  passed: true,
  workingTreeClean: true,
  steps: [
    "test",
    "typecheck",
    "lint",
    "build",
    "audit",
    "diff-check",
  ],
};

const targetPcEvidence = {
  SchemaVersion: 1,
  CapturedAt: "2026-09-21T00:01:00.000Z",
  Commit: COMMIT,
  WorkingTreeClean: true,
  BaseUrl: "http://127.0.0.1:3017",
  Port: 3017,
  ReadOnlyCollectionPassed: true,
  ReleaseVerdict: "NOT_EVALUATED",
  Checks: [
    "windows-preflight",
    "runtime-self-check",
    "windows-release-validator",
    "automation-readonly-status",
  ].map((Name) => ({
    Name,
    Status: "PASS",
  })),
};

const runtimePerformanceEvidence = {
  schemaVersion: 1,
  completedAt: "2026-09-21T00:02:00.000Z",
  environment: {
    commit: COMMIT,
    workingTreeClean: true,
  },
  statusMeasurements: {
    "/api/agent": {
      samplesMs: [10, 11],
    },
    "/api/automation": {
      samplesMs: [8, 9],
    },
    "/api/automation/service": {
      samplesMs: [7, 8],
    },
  },
};

const fullChatPreflightEvidence = {
  schemaVersion: 1,
  capturedAt: "2026-09-21T00:03:00.000Z",
  commit: COMMIT,
  workingTreeClean: true,
  mode: "chat-preflight-only",
  scenarios: ["A", "B", "C", "D"].map(
    (id) => ({
      id,
      captureStatus: "completed",
      evidence: {
        provider: "ollama",
      },
    }),
  ),
};

const allManualPass = {
  schemaVersion: 1 as const,
  contextRecordedAt:
    "2026-09-21T00:04:00.000Z",
  contextCommit: COMMIT,
  connected: ["Ollama"],
  requiresUserLogin: [],
  notImplemented: [],
  externalConfigurationRequired: false,
  gates: [
    "automation-approval-stop",
    "sonor-graph-memory",
    "browser-humanoid-performance",
    "full-system-approved-actions",
    "emergency-stop",
    "windows-install-update-reinstall",
  ].map((id) => ({
    id: id as
      | "automation-approval-stop"
      | "sonor-graph-memory"
      | "browser-humanoid-performance"
      | "full-system-approved-actions"
      | "emergency-stop"
      | "windows-install-update-reinstall",
    status: "PASS" as const,
    observedAt:
      "2026-09-21T00:04:00.000Z",
    evidencePath:
      `.astra/release/${id}.json`,
    evidenceSha256: SHA256,
    evidenceBytes: 42,
    commit: COMMIT,
  })),
};

function completeEvidence() {
  return {
    repositoryGate: repositoryGateEvidence,
    targetPc: targetPcEvidence,
    performance: runtimePerformanceEvidence,
    validation: fullChatPreflightEvidence,
    manual: allManualPass,
  };
}

test("Phase 20 report fails closed when evidence is absent", () => {
  const report = evaluateCoreRelease(
    {},
    new Date("2026-09-21T00:00:00.000Z"),
  );

  assert.equal(
    report.sections.RELEASE_STATUS,
    "BLOCKED",
  );
  assert.equal(report.gates.repositoryGate, false);
  assert.equal(
    report.gates.repositoryCommit,
    null,
  );
  assert.ok(
    report.sections.REQUIRES_PHYSICAL_TEST
      .length > 0,
  );
});

test("Phase 20 report accepts complete current-commit evidence only", () => {
  const report = evaluateCoreRelease(
    completeEvidence(),
    new Date("2026-09-21T00:05:00.000Z"),
    COMMIT,
  );

  assert.equal(
    report.sections.RELEASE_STATUS,
    "READY",
  );
  assert.equal(
    report.gates.repositoryGate,
    true,
  );
  assert.equal(
    report.gates.targetPcReadOnly,
    true,
  );
  assert.equal(
    report.gates.runtimePerformanceCaptured,
    true,
  );
  assert.equal(
    report.gates.chatPreflightCaptured,
    true,
  );
  assert.equal(
    report.gates.releaseContextRecorded,
    true,
  );
  assert.equal(
    report.gates.manualCommitAligned,
    true,
  );
  assert.deepEqual(
    report.sections.REQUIRES_PHYSICAL_TEST,
    [],
  );

  const markdown =
    renderCoreReleaseMarkdown(report);
  for (const heading of [
    "COMPLETED",
    "VERIFIED",
    "CONNECTED",
    "REQUIRES USER LOGIN",
    "REQUIRES PHYSICAL TEST",
    "NOT IMPLEMENTED",
    "SECURITY STATUS",
    "PERFORMANCE STATUS",
    "TEST STATUS",
    "RELEASE STATUS",
  ]) {
    assert.match(
      markdown,
      new RegExp(`## ${heading}`),
    );
  }
});

test("Phase 20 rejects boolean-only repository and target-PC evidence", () => {
  const report = evaluateCoreRelease({
    repositoryGate: {
      passed: true,
    },
    targetPc: {
      ReadOnlyCollectionPassed: true,
    },
    performance: runtimePerformanceEvidence,
    validation: fullChatPreflightEvidence,
    manual: allManualPass,
  });

  assert.equal(
    report.gates.repositoryGate,
    false,
  );
  assert.equal(
    report.gates.targetPcReadOnly,
    false,
  );
  assert.equal(
    report.sections.RELEASE_STATUS,
    "BLOCKED",
  );
});

test("Phase 20 binds every automatic evidence class to one commit", () => {
  const wrongTarget = {
    ...targetPcEvidence,
    Commit: OTHER_COMMIT,
  };
  const wrongPerformance = {
    ...runtimePerformanceEvidence,
    environment: {
      commit: OTHER_COMMIT,
    },
  };
  const wrongValidation = {
    ...fullChatPreflightEvidence,
    commit: OTHER_COMMIT,
  };

  for (const evidence of [
    {
      ...completeEvidence(),
      targetPc: wrongTarget,
    },
    {
      ...completeEvidence(),
      performance: wrongPerformance,
    },
    {
      ...completeEvidence(),
      validation: wrongValidation,
    },
  ]) {
    const report = evaluateCoreRelease(
      evidence,
      new Date(),
      COMMIT,
    );

    assert.equal(
      report.sections.RELEASE_STATUS,
      "BLOCKED",
    );
  }

  const staleHead = evaluateCoreRelease(
    completeEvidence(),
    new Date(),
    OTHER_COMMIT,
  );
  assert.equal(
    staleHead.gates.repositoryGate,
    false,
  );
});

test("Phase 20 rejects automatic evidence captured from a dirty working tree", () => {
  const cases = [
    {
      ...completeEvidence(),
      targetPc: {
        ...targetPcEvidence,
        WorkingTreeClean: false,
      },
    },
    {
      ...completeEvidence(),
      performance: {
        ...runtimePerformanceEvidence,
        environment: {
          commit: COMMIT,
          workingTreeClean: false,
        },
      },
    },
    {
      ...completeEvidence(),
      validation: {
        ...fullChatPreflightEvidence,
        workingTreeClean: false,
      },
    },
  ];

  for (const evidence of cases) {
    const report = evaluateCoreRelease(
      evidence,
      new Date(),
      COMMIT,
    );

    assert.equal(
      report.sections.RELEASE_STATUS,
      "BLOCKED",
    );
  }
});

test("Phase 20 requires release context from the same commit", () => {
  const manual = {
    ...allManualPass,
    contextRecordedAt: undefined,
    contextCommit: undefined,
  };

  const report = evaluateCoreRelease({
    ...completeEvidence(),
    manual,
  });

  assert.equal(
    report.gates.releaseContextRecorded,
    false,
  );
  assert.equal(
    report.sections.RELEASE_STATUS,
    "BLOCKED",
  );
  assert.deepEqual(
    report.sections.CONNECTED,
    [],
  );
});

test("stale manual PASS gates remain physical blockers and are not VERIFIED", () => {
  const manual = {
    ...allManualPass,
    gates: allManualPass.gates.map(
      (gate, index) =>
        index === 0
          ? {
              ...gate,
              commit: OTHER_COMMIT,
            }
          : gate,
    ),
  };

  const report = evaluateCoreRelease({
    ...completeEvidence(),
    manual,
  });

  assert.equal(
    report.gates.manualCommitAligned,
    false,
  );
  assert.equal(
    report.sections.RELEASE_STATUS,
    "BLOCKED",
  );
  assert.ok(
    report.sections.REQUIRES_PHYSICAL_TEST
      .includes("automation-approval-stop"),
  );
  assert.equal(
    report.sections.VERIFIED.includes(
      "Manual gate PASS: automation-approval-stop",
    ),
    false,
  );
});

test("Phase 20 report rejects malformed runtime performance evidence", () => {
  for (const statusMeasurements of [
    null,
    {},
    {
      "/api/agent": {
        samplesMs: [10],
      },
    },
  ]) {
    const report = evaluateCoreRelease({
      repositoryGate:
        repositoryGateEvidence,
      performance: {
        schemaVersion: 1,
        completedAt:
          "2026-09-21T00:00:00.000Z",
        environment: {
          commit: COMMIT,
          workingTreeClean: true,
        },
        statusMeasurements,
      },
    });

    assert.equal(
      report.gates.runtimePerformanceCaptured,
      false,
    );
  }
});

test("Phase 20 report requires completed chat preflight scenarios A through D", () => {
  const partial = evaluateCoreRelease({
    repositoryGate:
      repositoryGateEvidence,
    validation: {
      schemaVersion: 1,
      capturedAt:
        "2026-09-21T00:00:00.000Z",
      commit: COMMIT,
      mode: "chat-preflight-only",
      scenarios: [{
        id: "A",
        captureStatus: "completed",
        evidence: {},
      }],
    },
  });

  assert.equal(
    partial.gates.chatPreflightCaptured,
    false,
  );

  const malformed = evaluateCoreRelease({
    repositoryGate:
      repositoryGateEvidence,
    validation: {
      ...fullChatPreflightEvidence,
      scenarios: [
        {
          id: "A",
          captureStatus: "completed",
          evidence: {},
        },
        {
          id: "B",
          captureStatus: "completed",
          evidence: {},
        },
        {
          id: "C",
          captureStatus: "completed",
          evidence: {},
        },
        {
          id: "D",
          captureStatus: "failed",
          evidence: {},
        },
      ],
    },
  });

  assert.equal(
    malformed.gates.chatPreflightCaptured,
    false,
  );
});

test("manual PASS gates require integrity and commit metadata", () => {
  assert.throws(
    () =>
      validateManualReleaseEvidence({
        schemaVersion: 1,
        gates: [{
          id: "emergency-stop",
          status: "PASS",
          observedAt:
            "2026-09-21T00:00:00.000Z",
          evidencePath:
            ".astra/validation/stop.json",
        }],
      }),
    /SHA-256|metadata/,
  );
});

test("Phase 20 report script verifies manual integrity and selects only preflight validation artifacts", async () => {
  const { readFile } =
    await import("node:fs/promises");
  const script = await readFile(
    new URL(
      "../scripts/release/core-report.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    script,
    /assertExistingPrivateAstraEvidenceFile/,
  );
  assert.match(
    script,
    /evidenceSha256/,
  );
  assert.match(
    script,
    /evidenceBytes/,
  );
  assert.match(
    script,
    /validateBrowserReleaseBundle/,
  );
  assert.match(
    script,
    /validateManualGateObservation/,
  );
  assert.match(
    script,
    /full-system-preflight-/,
  );
  assert.match(
    script,
    /cleanRepositorySnapshot/,
  );
  assert.match(
    script,
    /assertSameCleanRepositorySnapshot/,
  );
});
