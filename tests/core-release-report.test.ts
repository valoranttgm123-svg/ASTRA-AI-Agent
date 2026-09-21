import assert from "node:assert/strict";
import { test } from "node:test";

import {
  evaluateCoreRelease,
  renderCoreReleaseMarkdown,
  validateManualReleaseEvidence,
} from "../lib/release/core-report";

const allManualPass = {
  schemaVersion: 1 as const,
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
    observedAt: "2026-09-21T00:00:00.000Z",
    evidencePath: `.astra/release/${id}.json`,
  })),
};

const runtimePerformanceEvidence = {
  schemaVersion: 1,
  completedAt: "2026-09-21T00:00:00.000Z",
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

test("Phase 20 report fails closed when evidence is absent", () => {
  const report = evaluateCoreRelease({}, new Date("2026-09-21T00:00:00.000Z"));

  assert.equal(
    report.sections.RELEASE_STATUS,
    "BLOCKED",
  );
  assert.equal(report.gates.repositoryGate, false);
  assert.ok(
    report.sections.REQUIRES_PHYSICAL_TEST.length > 0,
  );
});

test("Phase 20 report never treats chat preflight or runtime timing alone as final validation", () => {
  const report = evaluateCoreRelease({
    repositoryGate: { passed: true },
    targetPc: { ReadOnlyCollectionPassed: true },
    performance: runtimePerformanceEvidence,
    validation: fullChatPreflightEvidence,
  });

  assert.equal(
    report.sections.RELEASE_STATUS,
    "BLOCKED",
  );
  assert.equal(
    report.gates.runtimePerformanceCaptured,
    true,
  );
  assert.equal(
    report.gates.chatPreflightCaptured,
    true,
  );
  assert.match(
    report.sections.PERFORMANCE_STATUS,
    /browser\/Humanoid performance proof is still pending/,
  );
});

test("Phase 20 report may become READY only when every evidence class and manual gate passes", () => {
  const report = evaluateCoreRelease({
    repositoryGate: { passed: true },
    targetPc: { ReadOnlyCollectionPassed: true },
    performance: runtimePerformanceEvidence,
    validation: fullChatPreflightEvidence,
    manual: allManualPass,
  });

  assert.equal(
    report.sections.RELEASE_STATUS,
    "READY",
  );

  const markdown = renderCoreReleaseMarkdown(report);
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
    assert.match(markdown, new RegExp(`## ${heading}`));
  }
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
      performance: {
        schemaVersion: 1,
        completedAt:
          "2026-09-21T00:00:00.000Z",
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
    validation: {
      schemaVersion: 1,
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
    validation: {
      schemaVersion: 1,
      mode: "chat-preflight-only",
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

  const complete = evaluateCoreRelease({
    validation: fullChatPreflightEvidence,
  });

  assert.equal(
    complete.gates.chatPreflightCaptured,
    true,
  );
});

test("manual PASS gates require timestamp and private evidence path reference", () => {
  assert.throws(
    () =>
      validateManualReleaseEvidence({
        schemaVersion: 1,
        gates: [{
          id: "emergency-stop",
          status: "PASS",
        }],
      }),
    /requires observedAt and evidencePath/,
  );
});


test("Phase 20 report script requires PASS manual evidence files to exist under .astra", async () => {
  const { readFile } = await import("node:fs/promises");
  const script = await readFile(
    new URL("../scripts/release/core-report.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    script,
    /assertPrivateAstraEvidencePath/,
  );
  assert.match(
    script,
    /references missing evidence/,
  );
  assert.match(
    script,
    /existsSync\(referencedEvidence\)/,
  );
});
