import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseBrowserPerformanceEvidence,
  summarizeBrowserFrames,
} from "../lib/performance/browser-evidence";

test("browser performance frame summary is deterministic", () => {
  const result =
    summarizeBrowserFrames([
      16, 16, 17, 16, 33,
    ]);

  assert.equal(result.sampleCount, 5);
  assert.equal(result.durationMs, 98);
  assert.equal(
    result.averageFps,
    51.02,
  );
  assert.equal(result.p50FrameMs, 16);
  assert.equal(result.p95FrameMs, 33);
  assert.equal(
    result.slowFramesOver25Ms,
    1,
  );
});

test("browser performance evidence parser bounds and preserves only structured telemetry", () => {
  const result =
    parseBrowserPerformanceEvidence({
      capturedAt:
        "2026-09-21T07:00:00.000Z",
      scenario: "thinking",
      releaseVerdict: "READY",
      runtime: {
        commit: "a".repeat(40),
        workingTreeClean: true,
        verifiedAtStart: true,
        verifiedAtCompletion: true,
      },
      frame: {
        sampleCount: 600,
        durationMs: 10000,
        averageFps: 60,
        p50FrameMs: 16.6,
        p95FrameMs: 18.2,
        maxFrameMs: 40,
        slowFramesOver25Ms: 2,
      },
      environment: {
        userAgent: "browser",
        viewport: {
          width: 1920,
          height: 1080,
          dpr: 1.5,
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
        assemblyActive: false,
        shockwaveActive: false,
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
        "must not be persisted",
    });

  assert.equal(
    result.releaseVerdict,
    "NOT_EVALUATED",
  );
  assert.equal(
    "responseText" in result,
    false,
  );
});

test("browser performance evidence requires clean start/end runtime provenance", () => {
  const base = {
    capturedAt:
      "2026-09-21T07:00:00.000Z",
    scenario: "idle",
    releaseVerdict: "NOT_EVALUATED",
    runtime: {
      commit: "a".repeat(40),
      workingTreeClean: true,
      verifiedAtStart: true,
      verifiedAtCompletion: true,
    },
    frame: {
      sampleCount: 2,
      durationMs: 32,
      averageFps: 62.5,
      p50FrameMs: 16,
      p95FrameMs: 16,
      maxFrameMs: 16,
      slowFramesOver25Ms: 0,
    },
    environment: {
      userAgent: "browser",
      viewport: {
        width: 1280,
        height: 720,
        dpr: 1,
      },
      gpu: null,
      jsHeap: null,
    },
    humanoid: {
      quality: "high",
      effects: true,
      particleCount: 8000,
      reducedMotion: false,
      cameraEnabled: false,
      assemblyActive: false,
      shockwaveActive: false,
    },
    diagnostics: {
      longTaskCount: 0,
      longTaskTotalMs: 0,
      windowErrorCount: 0,
      unhandledRejectionCount: 0,
      consoleErrorCount: 0,
      consoleWarnCount: 0,
    },
  };

  for (const runtime of [
    undefined,
    {
      ...base.runtime,
      workingTreeClean: false,
    },
    {
      ...base.runtime,
      verifiedAtCompletion: false,
    },
  ]) {
    assert.throws(
      () =>
        parseBrowserPerformanceEvidence({
          ...base,
          runtime,
        }),
      /runtime build identity/i,
    );
  }
});

test("browser performance evidence rejects invalid frame inputs and scenarios", () => {
  assert.throws(
    () =>
      summarizeBrowserFrames([
        16,
        Number.NaN,
      ]),
    /positive finite/,
  );

  assert.throws(
    () =>
      parseBrowserPerformanceEvidence({
        scenario: "unknown",
      }),
    /scenario is invalid/,
  );
});
