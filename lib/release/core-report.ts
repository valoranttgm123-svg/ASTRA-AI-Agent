export const REQUIRED_MANUAL_GATE_IDS = [
  "automation-approval-stop",
  "sonor-graph-memory",
  "browser-humanoid-performance",
  "full-system-approved-actions",
  "emergency-stop",
  "windows-install-update-reinstall",
] as const;

export type ManualGateId =
  (typeof REQUIRED_MANUAL_GATE_IDS)[number];

export type ManualGateStatus =
  | "PASS"
  | "FAIL"
  | "NOT_RUN";

export type ManualGateRecord = {
  id: ManualGateId;
  status: ManualGateStatus;
  observedAt?: string;
  evidencePath?: string;
  evidenceSha256?: string;
  evidenceBytes?: number;
  commit?: string;
  note?: string;
};

export type ManualReleaseEvidence = {
  schemaVersion: 1;
  gates: ManualGateRecord[];
  connected?: string[];
  requiresUserLogin?: string[];
  notImplemented?: string[];
  externalConfigurationRequired?: boolean;
};

export type CoreReleaseEvidence = {
  repositoryGate?: {
    schemaVersion?: number;
    passed?: boolean;
    workingTreeClean?: boolean;
    capturedAt?: string;
    commit?: string;
    steps?: unknown;
  } | null;
  targetPc?: {
    SchemaVersion?: number;
    CapturedAt?: string;
    Commit?: string;
    BaseUrl?: string;
    Port?: number;
    ReadOnlyCollectionPassed?: boolean;
    ReleaseVerdict?: string;
    Checks?: unknown;
  } | null;
  performance?: {
    schemaVersion?: number;
    completedAt?: string;
    environment?: unknown;
    statusMeasurements?: unknown;
  } | null;
  validation?: {
    schemaVersion?: number;
    capturedAt?: string;
    commit?: string;
    mode?: string;
    scenarios?: unknown[];
  } | null;
  manual?: ManualReleaseEvidence | null;
};

export type CoreReleaseStatus =
  | "READY"
  | "READY WITH EXTERNAL CONFIGURATION REQUIRED"
  | "BLOCKED";

export type CoreReleaseReport = {
  schemaVersion: 1;
  generatedAt: string;
  sections: {
    COMPLETED: string[];
    VERIFIED: string[];
    CONNECTED: string[];
    REQUIRES_USER_LOGIN: string[];
    REQUIRES_PHYSICAL_TEST: string[];
    NOT_IMPLEMENTED: string[];
    SECURITY_STATUS: string;
    PERFORMANCE_STATUS: string;
    TEST_STATUS: string;
    RELEASE_STATUS: CoreReleaseStatus;
  };
  gates: {
    repositoryGate: boolean;
    repositoryCommit: string | null;
    targetPcReadOnly: boolean;
    runtimePerformanceCaptured: boolean;
    chatPreflightCaptured: boolean;
    manualCommitAligned: boolean;
    manual: Record<ManualGateId, ManualGateStatus>;
  };
};

function manualGateMap(
  manual: ManualReleaseEvidence | null | undefined,
) {
  const result = Object.fromEntries(
    REQUIRED_MANUAL_GATE_IDS.map(
      (id) => [id, "NOT_RUN" as ManualGateStatus],
    ),
  ) as Record<ManualGateId, ManualGateStatus>;

  for (const gate of manual?.gates ?? []) {
    if (
      REQUIRED_MANUAL_GATE_IDS.includes(gate.id)
    ) {
      result[gate.id] = gate.status;
    }
  }

  return result;
}

const REQUIRED_RUNTIME_STATUS_ENDPOINTS = [
  "/api/agent",
  "/api/automation",
  "/api/automation/service",
] as const;

const REQUIRED_CHAT_PREFLIGHT_SCENARIOS = [
  "A",
  "B",
  "C",
  "D",
] as const;

const REQUIRED_REPOSITORY_GATE_STEPS = [
  "test",
  "typecheck",
  "lint",
  "build",
  "audit",
  "diff-check",
] as const;

const REQUIRED_TARGET_PC_CHECKS = [
  "windows-preflight",
  "runtime-self-check",
  "windows-release-validator",
  "automation-readonly-status",
] as const;

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isValidTimestamp(value: unknown) {
  return (
    typeof value === "string" &&
    !Number.isNaN(Date.parse(value))
  );
}

function isGitCommit(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{40}$/i.test(value)
  );
}

function sameCommit(
  value: unknown,
  expected: string | null,
) {
  return (
    expected !== null &&
    isGitCommit(value) &&
    value.toLowerCase() === expected.toLowerCase()
  );
}

function repositoryGateCommit(
  repositoryGate:
    | CoreReleaseEvidence["repositoryGate"]
    | undefined,
) {
  if (
    repositoryGate?.schemaVersion !== 1 ||
    repositoryGate.passed !== true ||
    repositoryGate.workingTreeClean !== true ||
    !isValidTimestamp(repositoryGate.capturedAt) ||
    !isGitCommit(repositoryGate.commit) ||
    !Array.isArray(repositoryGate.steps)
  ) {
    return null;
  }

  const steps = repositoryGate.steps;
  if (
    steps.length !==
      REQUIRED_REPOSITORY_GATE_STEPS.length ||
    !REQUIRED_REPOSITORY_GATE_STEPS.every(
      (step) => steps.includes(step),
    )
  ) {
    return null;
  }

  return repositoryGate.commit.toLowerCase();
}

function hasTargetPcEvidence(
  targetPc:
    | CoreReleaseEvidence["targetPc"]
    | undefined,
  expectedCommit: string | null,
) {
  if (
    targetPc?.SchemaVersion !== 1 ||
    targetPc.ReadOnlyCollectionPassed !== true ||
    targetPc.ReleaseVerdict !== "NOT_EVALUATED" ||
    !isValidTimestamp(targetPc.CapturedAt) ||
    !sameCommit(targetPc.Commit, expectedCommit) ||
    !Number.isInteger(targetPc.Port) ||
    (targetPc.Port ?? 0) < 1024 ||
    (targetPc.Port ?? 0) > 65535 ||
    targetPc.BaseUrl !==
      `http://127.0.0.1:${targetPc.Port}` ||
    !Array.isArray(targetPc.Checks)
  ) {
    return false;
  }

  return REQUIRED_TARGET_PC_CHECKS.every(
    (name) =>
      targetPc.Checks?.some((check) => {
        if (!isRecord(check)) {
          return false;
        }
        return (
          check.Name === name &&
          check.Status === "PASS"
        );
      }) === true,
  );
}

function hasRuntimePerformanceEvidence(
  performance:
    | CoreReleaseEvidence["performance"]
    | undefined,
  expectedCommit: string | null,
) {
  if (
    performance?.schemaVersion !== 1 ||
    !isValidTimestamp(performance.completedAt) ||
    !isRecord(performance.environment) ||
    !sameCommit(
      performance.environment.commit,
      expectedCommit,
    )
  ) {
    return false;
  }

  const statusMeasurements =
    performance.statusMeasurements;
  if (!isRecord(statusMeasurements)) {
    return false;
  }

  return REQUIRED_RUNTIME_STATUS_ENDPOINTS.every(
    (endpoint) => {
      const measurement =
        statusMeasurements[endpoint];

      if (!isRecord(measurement)) {
        return false;
      }

      const samples = measurement.samplesMs;
      return (
        Array.isArray(samples) &&
        samples.length > 0 &&
        samples.every(
          (sample) =>
            typeof sample === "number" &&
            Number.isFinite(sample) &&
            sample >= 0,
        )
      );
    },
  );
}

function hasChatPreflightEvidence(
  validation:
    | CoreReleaseEvidence["validation"]
    | undefined,
  expectedCommit: string | null,
) {
  if (
    validation?.schemaVersion !== 1 ||
    validation.mode !== "chat-preflight-only" ||
    !isValidTimestamp(validation.capturedAt) ||
    !sameCommit(validation.commit, expectedCommit)
  ) {
    return false;
  }

  const scenarios = validation.scenarios;
  if (!Array.isArray(scenarios)) {
    return false;
  }

  return REQUIRED_CHAT_PREFLIGHT_SCENARIOS.every(
    (scenarioId) =>
      scenarios.some((scenario) => {
        if (!isRecord(scenario)) {
          return false;
        }

        return (
          scenario.id === scenarioId &&
          scenario.captureStatus === "completed" &&
          isRecord(scenario.evidence)
        );
      }),
  );
}

export function validateManualReleaseEvidence(
  manual: ManualReleaseEvidence,
) {
  if (manual.schemaVersion !== 1) {
    throw new Error(
      "Manual release evidence schemaVersion must be 1.",
    );
  }

  const seen = new Set<string>();
  for (const gate of manual.gates) {
    if (
      !REQUIRED_MANUAL_GATE_IDS.includes(gate.id)
    ) {
      throw new Error(
        `Unknown manual release gate: ${gate.id}`,
      );
    }
    if (seen.has(gate.id)) {
      throw new Error(
        `Duplicate manual release gate: ${gate.id}`,
      );
    }
    seen.add(gate.id);

    if (
      gate.status !== "PASS" &&
      gate.status !== "FAIL" &&
      gate.status !== "NOT_RUN"
    ) {
      throw new Error(
        `Invalid manual gate status for ${gate.id}.`,
      );
    }

    if (gate.status === "PASS") {
      if (
        !gate.observedAt ||
        !gate.evidencePath ||
        !gate.evidenceSha256 ||
        gate.evidenceBytes === undefined ||
        !gate.commit
      ) {
        throw new Error(
          `PASS manual gate ${gate.id} requires timestamp, evidence path, SHA-256, byte size, and commit metadata.`,
        );
      }
      if (Number.isNaN(Date.parse(gate.observedAt))) {
        throw new Error(
          `PASS manual gate ${gate.id} has an invalid observedAt timestamp.`,
        );
      }
      if (
        !/^[0-9a-f]{64}$/i.test(
          gate.evidenceSha256,
        )
      ) {
        throw new Error(
          `PASS manual gate ${gate.id} has an invalid evidence SHA-256.`,
        );
      }
      if (
        !Number.isInteger(gate.evidenceBytes) ||
        gate.evidenceBytes <= 0
      ) {
        throw new Error(
          `PASS manual gate ${gate.id} has an invalid evidence byte size.`,
        );
      }
      if (!isGitCommit(gate.commit)) {
        throw new Error(
          `PASS manual gate ${gate.id} has an invalid commit.`,
        );
      }
    }
  }
}

export function evaluateCoreRelease(
  evidence: CoreReleaseEvidence,
  now = new Date(),
): CoreReleaseReport {
  if (evidence.manual) {
    validateManualReleaseEvidence(evidence.manual);
  }

  const manual = manualGateMap(evidence.manual);
  const repositoryCommit =
    repositoryGateCommit(
      evidence.repositoryGate,
    );
  const repositoryGate =
    repositoryCommit !== null;
  const targetPcReadOnly =
    hasTargetPcEvidence(
      evidence.targetPc,
      repositoryCommit,
    );
  const runtimePerformanceCaptured =
    hasRuntimePerformanceEvidence(
      evidence.performance,
      repositoryCommit,
    );
  const chatPreflightCaptured =
    hasChatPreflightEvidence(
      evidence.validation,
      repositoryCommit,
    );

  const manualCommitAligned =
    repositoryCommit !== null &&
    REQUIRED_MANUAL_GATE_IDS.every(
      (id) =>
        evidence.manual?.gates.some(
          (gate) =>
            gate.id === id &&
            gate.status === "PASS" &&
            sameCommit(
              gate.commit,
              repositoryCommit,
            ),
        ) === true,
    );

  const manualAllPass =
    REQUIRED_MANUAL_GATE_IDS.every(
      (id) => manual[id] === "PASS",
    ) &&
    manualCommitAligned;

  const releasePrerequisitesPass =
    repositoryGate &&
    targetPcReadOnly &&
    runtimePerformanceCaptured &&
    chatPreflightCaptured &&
    manualAllPass;

  const releaseStatus: CoreReleaseStatus =
    releasePrerequisitesPass
      ? evidence.manual?.externalConfigurationRequired === true
        ? "READY WITH EXTERNAL CONFIGURATION REQUIRED"
        : "READY"
      : "BLOCKED";

  const requiresPhysical = REQUIRED_MANUAL_GATE_IDS
    .filter((id) => manual[id] !== "PASS")
    .map((id) => id);

  const completed = [
    "Phase 15 repository security/failure hardening",
    "Phase 18A repository RC gate tooling",
    "Phase 19A-19G Windows repository tooling/hardening",
    "Target-PC read-only evidence collector",
  ];

  const verified: string[] = [];
  if (repositoryGate) {
    verified.push(
      "Repository gate execution evidence is PASS.",
    );
  }
  if (targetPcReadOnly) {
    verified.push(
      "Target-PC read-only evidence collection is PASS.",
    );
  }
  if (runtimePerformanceCaptured) {
    verified.push(
      "Loopback runtime performance evidence is captured.",
    );
  }
  if (chatPreflightCaptured) {
    verified.push(
      "Phase 17 chat-mode preflight evidence is captured.",
    );
  }
  for (const id of REQUIRED_MANUAL_GATE_IDS) {
    if (manual[id] === "PASS") {
      verified.push(`Manual gate PASS: ${id}`);
    }
  }

  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    sections: {
      COMPLETED: completed,
      VERIFIED: verified,
      CONNECTED: evidence.manual?.connected ?? [],
      REQUIRES_USER_LOGIN:
        evidence.manual?.requiresUserLogin ?? [],
      REQUIRES_PHYSICAL_TEST: requiresPhysical,
      NOT_IMPLEMENTED:
        evidence.manual?.notImplemented ?? [],
      SECURITY_STATUS:
        repositoryGate
          ? "Repository security and RC gate evidence present; local security-sensitive gates still depend on the manual gate matrix."
          : "Repository RC gate execution evidence is missing.",
      PERFORMANCE_STATUS:
        runtimePerformanceCaptured &&
        manual["browser-humanoid-performance"] === "PASS"
          ? "Runtime and browser/Humanoid performance evidence are present."
          : runtimePerformanceCaptured
            ? "Runtime performance evidence is present; browser/Humanoid performance proof is still pending."
            : "Performance evidence is incomplete.",
      TEST_STATUS:
        repositoryGate
          ? "Repository gate PASS evidence is present."
          : "Repository gate PASS evidence is missing.",
      RELEASE_STATUS: releaseStatus,
    },
    gates: {
      repositoryGate,
      repositoryCommit,
      targetPcReadOnly,
      runtimePerformanceCaptured,
      chatPreflightCaptured,
      manualCommitAligned,
      manual,
    },
  };
}

export function renderCoreReleaseMarkdown(
  report: CoreReleaseReport,
) {
  const list = (items: string[]) =>
    items.length > 0
      ? items.map((item) => `- ${item}`).join("\n")
      : "- None recorded";

  return [
    "# ASTRA MAX Core Release Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## COMPLETED",
    list(report.sections.COMPLETED),
    "",
    "## VERIFIED",
    list(report.sections.VERIFIED),
    "",
    "## CONNECTED",
    list(report.sections.CONNECTED),
    "",
    "## REQUIRES USER LOGIN",
    list(report.sections.REQUIRES_USER_LOGIN),
    "",
    "## REQUIRES PHYSICAL TEST",
    list(report.sections.REQUIRES_PHYSICAL_TEST),
    "",
    "## NOT IMPLEMENTED",
    list(report.sections.NOT_IMPLEMENTED),
    "",
    "## SECURITY STATUS",
    report.sections.SECURITY_STATUS,
    "",
    "## PERFORMANCE STATUS",
    report.sections.PERFORMANCE_STATUS,
    "",
    "## TEST STATUS",
    report.sections.TEST_STATUS,
    "",
    "## RELEASE STATUS",
    report.sections.RELEASE_STATUS,
    "",
  ].join("\n");
}
