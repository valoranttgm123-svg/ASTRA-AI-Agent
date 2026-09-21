import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  parseUiPerformanceEvidence,
} from "../lib/performance/ui-evidence";

function fixture() {
  return {
    capturedAt:
      "2026-09-21T08:00:00.000Z",
    scenario:
      "automation-panel-open",
    releaseVerdict: "READY",
    frame: {
      sampleCount: 600,
      durationMs: 10000,
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
    runtime: {
      brainPanelPresent: true,
      consolePresent: true,
      automationPanelOpenAtStart:
        true,
      automationPanelOpenAtEnd:
        true,
      brainStreamingObserved: false,
      automationStreamingObserved:
        false,
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
    responseText:
      "must not survive parser",
  };
}

test("main UI evidence parser preserves structured telemetry and forces NOT_EVALUATED", () => {
  const result =
    parseUiPerformanceEvidence(
      fixture(),
    );

  assert.equal(
    result.releaseVerdict,
    "NOT_EVALUATED",
  );
  assert.equal(
    result.scenario,
    "automation-panel-open",
  );
  assert.equal(
    result.runtime
      .automationPanelOpenAtStart,
    true,
  );
  assert.equal(
    "responseText" in result,
    false,
  );
});

test("main UI evidence parser rejects unknown scenarios", () => {
  assert.throws(
    () =>
      parseUiPerformanceEvidence({
        ...fixture(),
        scenario: "fake-pass",
      }),
    /scenario is invalid/,
  );
});

test("main UI performance probe remains opt-in by query string and stores no message text", () => {
  const source = readFileSync(
    path.resolve(
      "components",
      "UiPerformanceProbe.tsx",
    ),
    "utf8",
  );

  assert.match(
    source,
    /get\("perf"\) === "1"/,
  );
  assert.match(
    source,
    /automation-panel-open/,
  );
  assert.match(
    source,
    /document\.querySelector\(\s*"\.astra-automation"/,
  );
  assert.doesNotMatch(
    source,
    /lastResponse\?\.message/,
  );
  assert.doesNotMatch(
    source,
    /micTranscript/,
  );
});
