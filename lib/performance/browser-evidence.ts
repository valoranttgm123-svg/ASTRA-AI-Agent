export type BrowserFrameSummary = {
  sampleCount: number;
  durationMs: number;
  averageFps: number;
  p50FrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  slowFramesOver25Ms: number;
};

function percentile(
  sorted: readonly number[],
  fraction: number,
) {
  if (sorted.length === 0) {
    throw new Error("Frame samples are empty.");
  }
  const index = Math.min(
    sorted.length - 1,
    Math.max(
      0,
      Math.ceil(sorted.length * fraction) - 1,
    ),
  );
  return sorted[index];
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function summarizeBrowserFrames(
  frameIntervalsMs: readonly number[],
): BrowserFrameSummary {
  if (
    frameIntervalsMs.length === 0 ||
    frameIntervalsMs.some(
      (value) =>
        !Number.isFinite(value) || value <= 0,
    )
  ) {
    throw new Error(
      "Frame intervals must contain positive finite values.",
    );
  }

  const sorted = [...frameIntervalsMs].sort(
    (a, b) => a - b,
  );
  const durationMs = frameIntervalsMs.reduce(
    (sum, value) => sum + value,
    0,
  );

  return {
    sampleCount: frameIntervalsMs.length,
    durationMs: round(durationMs),
    averageFps: round(
      (frameIntervalsMs.length * 1000) / durationMs,
    ),
    p50FrameMs: round(percentile(sorted, 0.5)),
    p95FrameMs: round(percentile(sorted, 0.95)),
    maxFrameMs: round(sorted[sorted.length - 1]),
    slowFramesOver25Ms:
      frameIntervalsMs.filter(
        (value) => value > 25,
      ).length,
  };
}

export type BrowserPerformanceEvidence = {
  schemaVersion: 1;
  capturedAt: string;
  scenario:
    | "idle"
    | "listening"
    | "thinking"
    | "speaking"
    | "assembly"
    | "shockwave";
  releaseVerdict: "NOT_EVALUATED";
  frame: BrowserFrameSummary;
  environment: {
    userAgent: string;
    viewport: {
      width: number;
      height: number;
      dpr: number;
    };
    gpu: {
      renderer: string;
      vendor: string;
      software: boolean;
    } | null;
    jsHeap: {
      usedBytes: number;
      totalBytes: number;
      limitBytes: number;
    } | null;
  };
  humanoid: {
    quality: "low" | "high";
    effects: boolean;
    particleCount: number | null;
    reducedMotion: boolean;
    cameraEnabled: boolean;
    assemblyActive: boolean;
    shockwaveActive: boolean;
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

function boundedString(
  value: unknown,
  max: number,
) {
  return typeof value === "string"
    ? value.slice(0, max)
    : "";
}

function finiteNumber(
  value: unknown,
  min: number,
  max: number,
) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
    ? value
    : null;
}

export function parseBrowserPerformanceEvidence(
  value: unknown,
): BrowserPerformanceEvidence {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "Browser performance evidence must be an object.",
    );
  }

  const raw = value as Record<string, unknown>;
  const scenario = raw.scenario;
  if (
    scenario !== "idle" &&
    scenario !== "listening" &&
    scenario !== "thinking" &&
    scenario !== "speaking" &&
    scenario !== "assembly" &&
    scenario !== "shockwave"
  ) {
    throw new Error(
      "Browser performance scenario is invalid.",
    );
  }

  const frameRaw = raw.frame as
    | Record<string, unknown>
    | undefined;
  const envRaw = raw.environment as
    | Record<string, unknown>
    | undefined;
  const humanoidRaw = raw.humanoid as
    | Record<string, unknown>
    | undefined;
  const diagnosticsRaw = raw.diagnostics as
    | Record<string, unknown>
    | undefined;

  if (
    !frameRaw ||
    !envRaw ||
    !humanoidRaw ||
    !diagnosticsRaw
  ) {
    throw new Error(
      "Browser performance evidence is incomplete.",
    );
  }

  const quality = humanoidRaw.quality;
  if (quality !== "low" && quality !== "high") {
    throw new Error(
      "Browser performance quality is invalid.",
    );
  }

  const viewportRaw = envRaw.viewport as
    | Record<string, unknown>
    | undefined;
  if (!viewportRaw) {
    throw new Error(
      "Browser performance viewport is missing.",
    );
  }

  const gpuRaw =
    envRaw.gpu &&
    typeof envRaw.gpu === "object" &&
    !Array.isArray(envRaw.gpu)
      ? envRaw.gpu as Record<string, unknown>
      : null;
  const heapRaw =
    envRaw.jsHeap &&
    typeof envRaw.jsHeap === "object" &&
    !Array.isArray(envRaw.jsHeap)
      ? envRaw.jsHeap as Record<string, unknown>
      : null;

  const number = (
    record: Record<string, unknown>,
    key: string,
    min: number,
    max: number,
  ) => {
    const result = finiteNumber(
      record[key],
      min,
      max,
    );
    if (result === null) {
      throw new Error(
        `Browser performance numeric field ${key} is invalid.`,
      );
    }
    return result;
  };

  return {
    schemaVersion: 1,
    capturedAt:
      boundedString(raw.capturedAt, 64) ||
      new Date().toISOString(),
    scenario,
    releaseVerdict: "NOT_EVALUATED",
    frame: {
      sampleCount: Math.round(
        number(frameRaw, "sampleCount", 1, 100000),
      ),
      durationMs:
        number(frameRaw, "durationMs", 1, 300000),
      averageFps:
        number(frameRaw, "averageFps", 0.1, 1000),
      p50FrameMs:
        number(frameRaw, "p50FrameMs", 0.01, 10000),
      p95FrameMs:
        number(frameRaw, "p95FrameMs", 0.01, 10000),
      maxFrameMs:
        number(frameRaw, "maxFrameMs", 0.01, 300000),
      slowFramesOver25Ms: Math.round(
        number(
          frameRaw,
          "slowFramesOver25Ms",
          0,
          100000,
        ),
      ),
    },
    environment: {
      userAgent: boundedString(
        envRaw.userAgent,
        600,
      ),
      viewport: {
        width: Math.round(
          number(
            viewportRaw,
            "width",
            1,
            20000,
          ),
        ),
        height: Math.round(
          number(
            viewportRaw,
            "height",
            1,
            20000,
          ),
        ),
        dpr:
          number(
            viewportRaw,
            "dpr",
            0.1,
            10,
          ),
      },
      gpu: gpuRaw
        ? {
            renderer: boundedString(
              gpuRaw.renderer,
              300,
            ),
            vendor: boundedString(
              gpuRaw.vendor,
              300,
            ),
            software:
              gpuRaw.software === true,
          }
        : null,
      jsHeap: heapRaw
        ? {
            usedBytes: number(
              heapRaw,
              "usedBytes",
              0,
              Number.MAX_SAFE_INTEGER,
            ),
            totalBytes: number(
              heapRaw,
              "totalBytes",
              0,
              Number.MAX_SAFE_INTEGER,
            ),
            limitBytes: number(
              heapRaw,
              "limitBytes",
              0,
              Number.MAX_SAFE_INTEGER,
            ),
          }
        : null,
    },
    humanoid: {
      quality,
      effects: humanoidRaw.effects === true,
      particleCount:
        humanoidRaw.particleCount === null
          ? null
          : Math.round(
              number(
                humanoidRaw,
                "particleCount",
                1,
                1000000,
              ),
            ),
      reducedMotion:
        humanoidRaw.reducedMotion === true,
      cameraEnabled:
        humanoidRaw.cameraEnabled === true,
      assemblyActive:
        humanoidRaw.assemblyActive === true,
      shockwaveActive:
        humanoidRaw.shockwaveActive === true,
    },
    diagnostics: {
      longTaskCount: Math.round(
        number(
          diagnosticsRaw,
          "longTaskCount",
          0,
          100000,
        ),
      ),
      longTaskTotalMs:
        number(
          diagnosticsRaw,
          "longTaskTotalMs",
          0,
          300000,
        ),
      windowErrorCount: Math.round(
        number(
          diagnosticsRaw,
          "windowErrorCount",
          0,
          100000,
        ),
      ),
      unhandledRejectionCount: Math.round(
        number(
          diagnosticsRaw,
          "unhandledRejectionCount",
          0,
          100000,
        ),
      ),
      consoleErrorCount: Math.round(
        number(
          diagnosticsRaw,
          "consoleErrorCount",
          0,
          100000,
        ),
      ),
      consoleWarnCount: Math.round(
        number(
          diagnosticsRaw,
          "consoleWarnCount",
          0,
          100000,
        ),
      ),
    },
  };
}
