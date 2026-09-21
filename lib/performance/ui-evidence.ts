import type {
  BrowserFrameSummary,
} from "./browser-evidence";

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
  runtime: {
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

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

function numberField(
  record: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
) {
  const value = record[key];
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(
      `UI performance numeric field ${key} is invalid.`,
    );
  }
  return value;
}

function booleanField(
  record: Record<string, unknown>,
  key: string,
) {
  if (typeof record[key] !== "boolean") {
    throw new Error(
      `UI performance boolean field ${key} is invalid.`,
    );
  }
  return record[key] as boolean;
}

function boundedString(
  value: unknown,
  max: number,
) {
  return typeof value === "string"
    ? value.slice(0, max)
    : "";
}

function count(
  record: Record<string, unknown>,
  key: string,
) {
  return Math.round(
    numberField(
      record,
      key,
      0,
      1_000_000,
    ),
  );
}

export function parseUiPerformanceEvidence(
  value: unknown,
): UiPerformanceEvidence {
  if (!isRecord(value)) {
    throw new Error(
      "UI performance evidence must be an object.",
    );
  }

  const scenario = value.scenario;
  if (
    typeof scenario !== "string" ||
    !(UI_PERFORMANCE_SCENARIOS as readonly string[])
      .includes(scenario)
  ) {
    throw new Error(
      "UI performance scenario is invalid.",
    );
  }

  const frame = value.frame;
  const environment = value.environment;
  const runtime = value.runtime;
  const diagnostics = value.diagnostics;

  if (
    !isRecord(frame) ||
    !isRecord(environment) ||
    !isRecord(runtime) ||
    !isRecord(diagnostics)
  ) {
    throw new Error(
      "UI performance evidence is incomplete.",
    );
  }

  const viewport = environment.viewport;
  if (!isRecord(viewport)) {
    throw new Error(
      "UI performance viewport is missing.",
    );
  }

  const heap = environment.jsHeap;
  if (
    heap !== null &&
    heap !== undefined &&
    !isRecord(heap)
  ) {
    throw new Error(
      "UI performance JS heap is invalid.",
    );
  }

  const orbStates =
    Array.isArray(runtime.orbStatesObserved)
      ? runtime.orbStatesObserved
          .filter(
            (item): item is string =>
              typeof item === "string",
          )
          .map((item) => item.slice(0, 40))
          .slice(0, 12)
      : [];

  return {
    schemaVersion: 1,
    capturedAt:
      boundedString(value.capturedAt, 64) ||
      new Date().toISOString(),
    scenario:
      scenario as UiPerformanceScenario,
    releaseVerdict: "NOT_EVALUATED",
    frame: {
      sampleCount: count(
        frame,
        "sampleCount",
      ),
      durationMs: numberField(
        frame,
        "durationMs",
        1,
        300_000,
      ),
      averageFps: numberField(
        frame,
        "averageFps",
        0.1,
        1000,
      ),
      p50FrameMs: numberField(
        frame,
        "p50FrameMs",
        0.01,
        10000,
      ),
      p95FrameMs: numberField(
        frame,
        "p95FrameMs",
        0.01,
        10000,
      ),
      maxFrameMs: numberField(
        frame,
        "maxFrameMs",
        0.01,
        300_000,
      ),
      slowFramesOver25Ms: count(
        frame,
        "slowFramesOver25Ms",
      ),
    },
    environment: {
      userAgent: boundedString(
        environment.userAgent,
        600,
      ),
      viewport: {
        width: Math.round(
          numberField(
            viewport,
            "width",
            1,
            20000,
          ),
        ),
        height: Math.round(
          numberField(
            viewport,
            "height",
            1,
            20000,
          ),
        ),
        dpr: numberField(
          viewport,
          "dpr",
          0.1,
          10,
        ),
      },
      jsHeap: isRecord(heap)
        ? {
            usedBytes: numberField(
              heap,
              "usedBytes",
              0,
              Number.MAX_SAFE_INTEGER,
            ),
            totalBytes: numberField(
              heap,
              "totalBytes",
              0,
              Number.MAX_SAFE_INTEGER,
            ),
            limitBytes: numberField(
              heap,
              "limitBytes",
              0,
              Number.MAX_SAFE_INTEGER,
            ),
          }
        : null,
    },
    runtime: {
      brainPanelPresent: booleanField(
        runtime,
        "brainPanelPresent",
      ),
      consolePresent: booleanField(
        runtime,
        "consolePresent",
      ),
      automationPanelOpenAtStart:
        booleanField(
          runtime,
          "automationPanelOpenAtStart",
        ),
      automationPanelOpenAtEnd:
        booleanField(
          runtime,
          "automationPanelOpenAtEnd",
        ),
      brainStreamingObserved:
        booleanField(
          runtime,
          "brainStreamingObserved",
        ),
      automationStreamingObserved:
        booleanField(
          runtime,
          "automationStreamingObserved",
        ),
      brainEventCountStart: count(
        runtime,
        "brainEventCountStart",
      ),
      brainEventCountEnd: count(
        runtime,
        "brainEventCountEnd",
      ),
      orbStatesObserved: [
        ...new Set(orbStates),
      ],
    },
    diagnostics: {
      longTaskCount: count(
        diagnostics,
        "longTaskCount",
      ),
      longTaskTotalMs: numberField(
        diagnostics,
        "longTaskTotalMs",
        0,
        300_000,
      ),
      windowErrorCount: count(
        diagnostics,
        "windowErrorCount",
      ),
      unhandledRejectionCount: count(
        diagnostics,
        "unhandledRejectionCount",
      ),
      consoleErrorCount: count(
        diagnostics,
        "consoleErrorCount",
      ),
      consoleWarnCount: count(
        diagnostics,
        "consoleWarnCount",
      ),
    },
  };
}
