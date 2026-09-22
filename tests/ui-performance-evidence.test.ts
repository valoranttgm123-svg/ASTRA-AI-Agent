import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { parseUiPerformanceEvidence } from "../lib/performance/ui-evidence";

const COMMIT = "a".repeat(40);

function fixture() {
  return {
    schemaVersion: 1,
    capturedAt: "2026-09-22T12:00:00.000Z",
    scenario: "automation-panel-open",
    releaseVerdict: "READY",
    runtime: {
      commit: COMMIT,
      workingTreeClean: true,
      verifiedAtStart: true,
      verifiedAtCompletion: true,
    },
    frame: {
      sampleCount: 600,
      durationMs: 10_000,
      averageFps: 60,
      p50FrameMs: 16.6,
      p95FrameMs: 18.2,
      maxFrameMs: 35,
      slowFramesOver25Ms: 2,
    },
    environment: {
      userAgent: "browser",
      viewport: {
        width: 1920,
        height: 1080,
        dpr: 1.5,
      },
      jsHeap: null,
    },
    activity: {
      brainPanelPresent: true,
      consolePresent: true,
      automationPanelOpenAtStart: true,
      automationPanelOpenAtEnd: true,
      brainStreamingObserved: false,
      automationStreamingObserved: false,
      brainEventCountStart: 4,
      brainEventCountEnd: 4,
      orbStatesObserved: ["idle"],
    },
    diagnostics: {
      longTaskCount: 0,
      longTaskTotalMs: 0,
      windowErrorCount: 0,
      unhandledRejectionCount: 0,
      consoleErrorCount: 0,
      consoleWarnCount: 0,
    },
    responseText: "must not survive parser",
    micTranscript: "must not survive parser",
  };
}

test("main UI evidence parser preserves structured telemetry and forces NOT_EVALUATED", () => {
  const result = parseUiPerformanceEvidence(fixture());

  assert.equal(result.releaseVerdict, "NOT_EVALUATED");
  assert.equal(result.scenario, "automation-panel-open");
  assert.equal(result.runtime.commit, COMMIT);
  assert.equal(result.activity.automationPanelOpenAtStart, true);
  assert.equal("responseText" in result, false);
  assert.equal("micTranscript" in result, false);
});

test("main UI evidence rejects fake Command Center active capture", () => {
  assert.throws(
    () =>
      parseUiPerformanceEvidence({
        ...fixture(),
        scenario: "command-center-active",
        activity: {
          ...fixture().activity,
          automationPanelOpenAtStart: false,
          automationPanelOpenAtEnd: false,
        },
      }),
    /did not observe real ASTRA activity/i,
  );

  const active = parseUiPerformanceEvidence({
    ...fixture(),
    scenario: "command-center-active",
    activity: {
      ...fixture().activity,
      automationPanelOpenAtStart: false,
      automationPanelOpenAtEnd: false,
      brainEventCountEnd: 5,
    },
  });
  assert.equal(active.scenario, "command-center-active");
});

test("main UI evidence requires the real Automation panel throughout capture", () => {
  assert.throws(
    () =>
      parseUiPerformanceEvidence({
        ...fixture(),
        activity: {
          ...fixture().activity,
          automationPanelOpenAtEnd: false,
        },
      }),
    /remain open/i,
  );
});

test("main UI performance probe is opt-in, mounted, and stores no message text", () => {
  const source = readFileSync(
    path.resolve("components", "UiPerformanceProbe.tsx"),
    "utf8",
  );
  const page = readFileSync(path.resolve("app", "page.tsx"), "utf8");

  assert.match(source, /get\("perf"\) === "1"/);
  assert.match(source, /automation-panel-open/);
  assert.match(source, /telemetryRef\.current/);
  assert.match(source, /fetchRuntimeIdentity/);
  assert.equal((source.match(/await fetchRuntimeIdentity\(\)/g) ?? []).length, 2);
  assert.match(source, /document\.querySelector\("\.astra-automation"\)/);
  assert.doesNotMatch(source, /lastResponse\?\.message/);
  assert.doesNotMatch(source, /micTranscript/);
  assert.match(page, /<UiPerformanceProbe \/>/);
});

test("main UI evidence endpoint stays guarded, private, and build-bound", () => {
  const route = readFileSync(
    path.resolve(
      "app",
      "api",
      "performance",
      "ui-evidence",
      "route.ts",
    ),
    "utf8",
  );
  const output = readFileSync(
    path.resolve("lib", "performance", "private-output.ts"),
    "utf8",
  );

  assert.match(route, /guardRequest\(request, true\)/);
  assert.match(route, /runtimeBuildIdentity/);
  assert.match(route, /rev-parse/);
  assert.match(route, /--untracked-files=normal/);
  assert.match(route, /prepareUiPerformancePath/);
  assert.match(output, /ui-\$\{safeScenario\}/);
  assert.match(output, /preparePrivateAstraOutputFile/);
  assert.match(route, /NOT_EVALUATED/);
  assert.doesNotMatch(route, /READY["']/);
});
