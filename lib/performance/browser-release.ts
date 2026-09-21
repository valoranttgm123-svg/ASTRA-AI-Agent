import {
  parseBrowserPerformanceEvidence,
  type BrowserPerformanceEvidence,
} from "./browser-evidence";

export const REQUIRED_BROWSER_RELEASE_SCENARIOS = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "assembly",
  "shockwave",
] as const;

export type BrowserReleaseScenario =
  (typeof REQUIRED_BROWSER_RELEASE_SCENARIOS)[number];

export type BrowserReleaseCaptureSource = {
  path: string;
  sha256: string;
  bytes: number;
  evidence: BrowserPerformanceEvidence;
};

export type BrowserReleaseBundle = {
  schemaVersion: 1;
  kind: "browser-humanoid-release-bundle";
  capturedAt: string;
  commit: string;
  releaseVerdict: "NOT_EVALUATED";
  scenarios: Record<
    BrowserReleaseScenario,
    BrowserReleaseCaptureSource
  >;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isCommit(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{40}$/i.test(value)
  );
}

function validTimestamp(value: unknown) {
  return (
    typeof value === "string" &&
    !Number.isNaN(Date.parse(value))
  );
}

function assertSha256(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{64}$/i.test(value)
  ) {
    throw new Error(
      "Browser release source SHA-256 is invalid.",
    );
  }
  return value.toLowerCase();
}

function assertBytes(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      "Browser release source byte size is invalid.",
    );
  }
  return value;
}

function assertPrivateSourcePath(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\.astra[\\/]performance[\\/]browser-[a-z-]+-[^\\/]+\.json$/i.test(
      value,
    )
  ) {
    throw new Error(
      "Browser release source path is invalid.",
    );
  }
  return value.replace(/\\/g, "/");
}

export function parseStoredBrowserReleaseCapture(
  value: unknown,
  scenario: BrowserReleaseScenario,
  expectedCommit: string,
) {
  if (!isRecord(value)) {
    throw new Error(
      `Browser release capture ${scenario} must be an object.`,
    );
  }

  const repository = value.repository;
  if (!isRecord(repository)) {
    throw new Error(
      `Browser release capture ${scenario} is missing repository provenance.`,
    );
  }

  if (
    !isCommit(repository.commit) ||
    repository.commit.toLowerCase() !==
      expectedCommit.toLowerCase()
  ) {
    throw new Error(
      `Browser release capture ${scenario} does not match the current Git commit.`,
    );
  }

  if (repository.workingTreeClean !== true) {
    throw new Error(
      `Browser release capture ${scenario} was recorded from a dirty Git working tree.`,
    );
  }

  if (value.releaseVerdict !== "NOT_EVALUATED") {
    throw new Error(
      `Browser release capture ${scenario} has an invalid release verdict.`,
    );
  }

  if (!validTimestamp(value.capturedAt)) {
    throw new Error(
      `Browser release capture ${scenario} has an invalid timestamp.`,
    );
  }

  const evidence =
    parseBrowserPerformanceEvidence(value);

  if (
    evidence.runtime.commit !==
      expectedCommit.toLowerCase() ||
    evidence.runtime.workingTreeClean !== true ||
    evidence.runtime.verifiedAtStart !== true ||
    evidence.runtime.verifiedAtCompletion !== true
  ) {
    throw new Error(
      `Browser release capture ${scenario} does not match the clean running ASTRA build.`,
    );
  }

  if (evidence.scenario !== scenario) {
    throw new Error(
      `Browser release capture expected ${scenario} but found ${evidence.scenario}.`,
    );
  }

  if (evidence.humanoid.quality !== "high") {
    throw new Error(
      `Browser release capture ${scenario} must use HIGH quality.`,
    );
  }

  return evidence;
}

export function createBrowserReleaseBundle(
  input: Record<
    BrowserReleaseScenario,
    BrowserReleaseCaptureSource
  >,
  commit: string,
  now = new Date(),
): BrowserReleaseBundle {
  if (!isCommit(commit)) {
    throw new Error(
      "Browser release bundle requires a full Git commit.",
    );
  }

  const scenarios = Object.fromEntries(
    REQUIRED_BROWSER_RELEASE_SCENARIOS.map(
      (scenario) => {
        const source = input[scenario];
        if (!source) {
          throw new Error(
            `Browser release bundle is missing ${scenario}.`,
          );
        }

        if (source.evidence.scenario !== scenario) {
          throw new Error(
            `Browser release bundle source mismatch for ${scenario}.`,
          );
        }
        if (
          source.evidence.humanoid.quality !==
          "high"
        ) {
          throw new Error(
            `Browser release bundle source ${scenario} is not HIGH quality.`,
          );
        }
        if (
          source.evidence.runtime.commit !==
            commit.toLowerCase() ||
          source.evidence.runtime.workingTreeClean !==
            true ||
          source.evidence.runtime.verifiedAtStart !==
            true ||
          source.evidence.runtime.verifiedAtCompletion !==
            true
        ) {
          throw new Error(
            `Browser release bundle source ${scenario} does not match the clean running ASTRA build.`,
          );
        }

        return [
          scenario,
          {
            path: assertPrivateSourcePath(
              source.path,
            ),
            sha256: assertSha256(
              source.sha256,
            ),
            bytes: assertBytes(source.bytes),
            evidence: source.evidence,
          },
        ];
      },
    ),
  ) as BrowserReleaseBundle["scenarios"];

  return {
    schemaVersion: 1,
    kind: "browser-humanoid-release-bundle",
    capturedAt: now.toISOString(),
    commit: commit.toLowerCase(),
    releaseVerdict: "NOT_EVALUATED",
    scenarios,
  };
}

export function validateBrowserReleaseBundle(
  value: unknown,
  expectedCommit: string,
): BrowserReleaseBundle {
  if (!isRecord(value)) {
    throw new Error(
      "Browser release bundle must be an object.",
    );
  }

  if (
    value.schemaVersion !== 1 ||
    value.kind !==
      "browser-humanoid-release-bundle" ||
    value.releaseVerdict !== "NOT_EVALUATED" ||
    !validTimestamp(value.capturedAt) ||
    !isCommit(value.commit) ||
    value.commit.toLowerCase() !==
      expectedCommit.toLowerCase() ||
    !isRecord(value.scenarios)
  ) {
    throw new Error(
      "Browser release bundle provenance is invalid.",
    );
  }

  const scenarios =
    {} as BrowserReleaseBundle["scenarios"];

  for (const scenario of
    REQUIRED_BROWSER_RELEASE_SCENARIOS) {
    const source = value.scenarios[scenario];
    if (!isRecord(source)) {
      throw new Error(
        `Browser release bundle is missing ${scenario}.`,
      );
    }

    const evidence =
      parseBrowserPerformanceEvidence(
        source.evidence,
      );
    if (
      evidence.scenario !== scenario ||
      evidence.humanoid.quality !== "high" ||
      evidence.releaseVerdict !==
        "NOT_EVALUATED" ||
      evidence.runtime.commit !==
        expectedCommit.toLowerCase() ||
      evidence.runtime.workingTreeClean !== true ||
      evidence.runtime.verifiedAtStart !== true ||
      evidence.runtime.verifiedAtCompletion !== true
    ) {
      throw new Error(
        `Browser release bundle scenario ${scenario} is invalid.`,
      );
    }

    scenarios[scenario] = {
      path: assertPrivateSourcePath(
        source.path,
      ),
      sha256: assertSha256(source.sha256),
      bytes: assertBytes(source.bytes),
      evidence,
    };
  }

  if (
    Object.keys(value.scenarios).some(
      (scenario) =>
        !(
          REQUIRED_BROWSER_RELEASE_SCENARIOS as readonly string[]
        ).includes(scenario),
    )
  ) {
    throw new Error(
      "Browser release bundle contains an unknown scenario.",
    );
  }

  return {
    schemaVersion: 1,
    kind: "browser-humanoid-release-bundle",
    capturedAt: value.capturedAt as string,
    commit: (
      value.commit as string
    ).toLowerCase(),
    releaseVerdict: "NOT_EVALUATED",
    scenarios,
  };
}
