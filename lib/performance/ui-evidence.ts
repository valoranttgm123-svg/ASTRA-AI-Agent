import type {
  BrowserFrameSummary,
  BrowserRuntimeEvidence,
} from "./browser-evidence";
import { parseBrowserRuntimeIdentity } from "./browser-evidence";

export const UI_PERFORMANCE_SCENARIOS = [
  "main-idle",
  "command-center-active",
  "automation-panel-open",
] as const;

export type UiPerformanceScenario =
  (typeof UI_PERFORMANCE_SCENARIOS)[number];

export type UiPerformanceEvidence = {
  schemaVersion: 1;
  capturedAt: string;
  scenario: UiPerformanceScenario;
  releaseVerdict: "NOT_EVALUATED";
  runtime: BrowserRuntimeEvidence;
  frame: BrowserFrameSummary;
  environment: {
    userAgent: string;
    viewport: {
      width: number;
      height: number;
      dpr: number;
    };
    jsHeap: {
      usedBytes: number;
      totalBytes: number;
      limitBytes: number;
    } | null;
  };
  activity: {
    brainPanelPresent: boolean;
    consolePresent: boolean;
    automationPanelOpenAtStart: boolean;
    automationPanelOpenAtEnd: boolean;
    brainStreamingObserved: boolean;
    automationStreamingObserved: boolean;
    brainEventCountStart: number;
    brainEventCountEnd: number;
    orbStatesObserved: string[];
  };
  diagnostics: {
    longTaskCount: number;
    longTaskTotalMs: number;
    windowErrorCount: number;
    unhandledRejectionCount: number;
    consoleErrorCount: number;
    consoleWarnCount: number;
  };
};

function record(value: unknown, field: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("UI performance " + field + " is invalid.");
  }
  return value as Record<string, unknown>;
}

function finite(
  value: unknown,
  field: string,
  min: number,
  max: number,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw new Error("UI performance numeric field " + field + " is invalid.");
  }
  return value;
}

function count(value: unknown, field: string) {
  return Math.round(finite(value, field, 0, 1_000_000));
}

function bool(value: unknown, field: string) {
  if (typeof value !== "boolean") {
    throw new Error("UI performance boolean field " + field + " is invalid.");
  }
  return value;
}

function boundedString(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export function parseUiPerformanceEvidence(
  value: unknown,
): UiPerformanceEvidence {
  const raw = record(value, "evidence");
  if (raw.schemaVersion !== 1) {
    throw new Error("UI performance schemaVersion is invalid.");
  }

  const scenario = raw.scenario;
  if (
    typeof scenario !== "string" ||
    !(UI_PERFORMANCE_SCENARIOS as readonly string[]).includes(scenario)
  ) {
    throw new Error("UI performance scenario is invalid.");
  }

  const runtimeRaw = record(raw.runtime, "runtime");
  const frame = record(raw.frame, "frame");
  const environment = record(raw.environment, "environment");
  const viewport = record(environment.viewport, "viewport");
  const activity = record(raw.activity, "activity");
  const diagnostics = record(raw.diagnostics, "diagnostics");

  const runtime = parseBrowserRuntimeIdentity(runtimeRaw);
  if (
    runtimeRaw.verifiedAtStart !== true ||
    runtimeRaw.verifiedAtCompletion !== true
  ) {
    throw new Error(
      "UI performance runtime identity was not verified across the capture.",
    );
  }

  const heapRaw =
    environment.jsHeap === null || environment.jsHeap === undefined
      ? null
      : record(environment.jsHeap, "JS heap");

  const orbStates = Array.isArray(activity.orbStatesObserved)
    ? [
        ...new Set(
          activity.orbStatesObserved
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => entry.slice(0, 40))
            .slice(0, 16),
        ),
      ]
    : [];

  const parsed: UiPerformanceEvidence = {
    schemaVersion: 1,
    capturedAt:
      boundedString(raw.capturedAt, 64) || new Date().toISOString(),
    scenario: scenario as UiPerformanceScenario,
    releaseVerdict: "NOT_EVALUATED",
    runtime: {
      ...runtime,
      verifiedAtStart: true,
      verifiedAtCompletion: true,
    },
    frame: {
      sampleCount: count(frame.sampleCount, "sampleCount"),
      durationMs: finite(frame.durationMs, "durationMs", 1, 300_000),
      averageFps: finite(frame.averageFps, "averageFps", 0.1, 1000),
      p50FrameMs: finite(frame.p50FrameMs, "p50FrameMs", 0.01, 10_000),
      p95FrameMs: finite(frame.p95FrameMs, "p95FrameMs", 0.01, 10_000),
      maxFrameMs: finite(frame.maxFrameMs, "maxFrameMs", 0.01, 300_000),
      slowFramesOver25Ms: count(
        frame.slowFramesOver25Ms,
        "slowFramesOver25Ms",
      ),
    },
    environment: {
      userAgent: boundedString(environment.userAgent, 600),
      viewport: {
        width: Math.round(finite(viewport.width, "width", 1, 20_000)),
        height: Math.round(finite(viewport.height, "height", 1, 20_000)),
        dpr: finite(viewport.dpr, "dpr", 0.1, 10),
      },
      jsHeap: heapRaw
        ? {
            usedBytes: finite(
              heapRaw.usedBytes,
              "usedBytes",
              0,
              Number.MAX_SAFE_INTEGER,
            ),
            totalBytes: finite(
              heapRaw.totalBytes,
              "totalBytes",
              0,
              Number.MAX_SAFE_INTEGER,
            ),
            limitBytes: finite(
              heapRaw.limitBytes,
              "limitBytes",
              0,
              Number.MAX_SAFE_INTEGER,
            ),
          }
        : null,
    },
    activity: {
      brainPanelPresent: bool(
        activity.brainPanelPresent,
        "brainPanelPresent",
      ),
      consolePresent: bool(activity.consolePresent, "consolePresent"),
      automationPanelOpenAtStart: bool(
        activity.automationPanelOpenAtStart,
        "automationPanelOpenAtStart",
      ),
      automationPanelOpenAtEnd: bool(
        activity.automationPanelOpenAtEnd,
        "automationPanelOpenAtEnd",
      ),
      brainStreamingObserved: bool(
        activity.brainStreamingObserved,
        "brainStreamingObserved",
      ),
      automationStreamingObserved: bool(
        activity.automationStreamingObserved,
        "automationStreamingObserved",
      ),
      brainEventCountStart: count(
        activity.brainEventCountStart,
        "brainEventCountStart",
      ),
      brainEventCountEnd: count(
        activity.brainEventCountEnd,
        "brainEventCountEnd",
      ),
      orbStatesObserved: orbStates,
    },
    diagnostics: {
      longTaskCount: count(diagnostics.longTaskCount, "longTaskCount"),
      longTaskTotalMs: finite(
        diagnostics.longTaskTotalMs,
        "longTaskTotalMs",
        0,
        300_000,
      ),
      windowErrorCount: count(
        diagnostics.windowErrorCount,
        "windowErrorCount",
      ),
      unhandledRejectionCount: count(
        diagnostics.unhandledRejectionCount,
        "unhandledRejectionCount",
      ),
      consoleErrorCount: count(
        diagnostics.consoleErrorCount,
        "consoleErrorCount",
      ),
      consoleWarnCount: count(
        diagnostics.consoleWarnCount,
        "consoleWarnCount",
      ),
    },
  };

  if (
    parsed.scenario === "automation-panel-open" &&
    (!parsed.activity.automationPanelOpenAtStart ||
      !parsed.activity.automationPanelOpenAtEnd)
  ) {
    throw new Error(
      "Automation-panel UI evidence requires the real Automation panel to remain open.",
    );
  }

  if (
    parsed.scenario === "command-center-active" &&
    !parsed.activity.brainStreamingObserved &&
    parsed.activity.brainEventCountEnd <=
      parsed.activity.brainEventCountStart &&
    parsed.activity.orbStatesObserved.every((state) => state === "idle")
  ) {
    throw new Error(
      "Command Center active evidence did not observe real ASTRA activity.",
    );
  }

  return parsed;
}
