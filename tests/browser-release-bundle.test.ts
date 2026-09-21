import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createBrowserReleaseBundle,
  parseStoredBrowserReleaseCapture,
  REQUIRED_BROWSER_RELEASE_SCENARIOS,
  validateBrowserReleaseBundle,
  type BrowserReleaseCaptureSource,
  type BrowserReleaseScenario,
} from "../lib/performance/browser-release";

const COMMIT = "a".repeat(40);
const OTHER_COMMIT = "b".repeat(40);
const SHA256 = "c".repeat(64);

function rawCapture(
  scenario: BrowserReleaseScenario,
  overrides: Record<string, unknown> = {},
) {
  return {
    schemaVersion: 1,
    capturedAt:
      "2026-09-21T10:00:00.000Z",
    scenario,
    releaseVerdict: "NOT_EVALUATED",
    frame: {
      sampleCount: 600,
      durationMs: 10000,
      averageFps: 60,
      p50FrameMs: 16.6,
      p95FrameMs: 18.2,
      maxFrameMs: 30,
      slowFramesOver25Ms: 1,
    },
    environment: {
      userAgent: "browser",
      viewport: {
        width: 1920,
        height: 1080,
        dpr: 1,
      },
      gpu: {
        renderer: "GPU",
        vendor: "Vendor",
        software: false,
      },
      jsHeap: null,
    },
    humanoid: {
      quality: "high",
      effects: true,
      particleCount: 8000,
      reducedMotion: false,
      cameraEnabled: false,
      assemblyActive:
        scenario === "assembly",
      shockwaveActive:
        scenario === "shockwave",
    },
    diagnostics: {
      longTaskCount: 0,
      longTaskTotalMs: 0,
      windowErrorCount: 0,
      unhandledRejectionCount: 0,
      consoleErrorCount: 0,
      consoleWarnCount: 0,
    },
    repository: {
      commit: COMMIT,
      workingTreeClean: true,
    },
    ...overrides,
  };
}

function completeSources() {
  return Object.fromEntries(
    REQUIRED_BROWSER_RELEASE_SCENARIOS.map(
      (scenario) => {
        const evidence =
          parseStoredBrowserReleaseCapture(
            rawCapture(scenario),
            scenario,
            COMMIT,
          );
        return [
          scenario,
          {
            path:
              `.astra/performance/browser-${scenario}-2026-09-21.json`,
            sha256: SHA256,
            bytes: 512,
            evidence,
          },
        ];
      },
    ),
  ) as Record<
    BrowserReleaseScenario,
    BrowserReleaseCaptureSource
  >;
}

test("browser release capture requires current clean HIGH provenance", () => {
  assert.equal(
    parseStoredBrowserReleaseCapture(
      rawCapture("idle"),
      "idle",
      COMMIT,
    ).scenario,
    "idle",
  );

  assert.throws(
    () =>
      parseStoredBrowserReleaseCapture(
        rawCapture("idle", {
          repository: {
            commit: OTHER_COMMIT,
            workingTreeClean: true,
          },
        }),
        "idle",
        COMMIT,
      ),
    /current Git commit/,
  );

  assert.throws(
    () =>
      parseStoredBrowserReleaseCapture(
        rawCapture("idle", {
          repository: {
            commit: COMMIT,
            workingTreeClean: false,
          },
        }),
        "idle",
        COMMIT,
      ),
    /dirty Git working tree/,
  );

  assert.throws(
    () =>
      parseStoredBrowserReleaseCapture(
        rawCapture("idle", {
          humanoid: {
            ...(
              rawCapture("idle")
                .humanoid as object
            ),
            quality: "low",
          },
        }),
        "idle",
        COMMIT,
      ),
    /HIGH quality/,
  );
});

test("browser release bundle requires all six required scenarios", () => {
  const bundle =
    createBrowserReleaseBundle(
      completeSources(),
      COMMIT,
      new Date(
        "2026-09-21T10:10:00.000Z",
      ),
    );

  assert.deepEqual(
    Object.keys(bundle.scenarios).sort(),
    [...REQUIRED_BROWSER_RELEASE_SCENARIOS]
      .sort(),
  );

  const validated =
    validateBrowserReleaseBundle(
      bundle,
      COMMIT,
    );
  assert.equal(
    validated.commit,
    COMMIT,
  );

  const missing = structuredClone(
    bundle,
  ) as unknown as {
    scenarios: Record<string, unknown>;
  };
  delete missing.scenarios.shockwave;

  assert.throws(
    () =>
      validateBrowserReleaseBundle(
        missing,
        COMMIT,
      ),
    /missing shockwave/,
  );
});

test("browser release bundle rejects stale commit and unknown scenarios", () => {
  const bundle =
    createBrowserReleaseBundle(
      completeSources(),
      COMMIT,
    );

  assert.throws(
    () =>
      validateBrowserReleaseBundle(
        bundle,
        OTHER_COMMIT,
      ),
    /provenance/,
  );

  const extra = structuredClone(
    bundle,
  ) as unknown as {
    scenarios: Record<string, unknown>;
  };
  extra.scenarios.executing =
    extra.scenarios.idle;

  assert.throws(
    () =>
      validateBrowserReleaseBundle(
        extra,
        COMMIT,
      ),
    /unknown scenario/,
  );
});
