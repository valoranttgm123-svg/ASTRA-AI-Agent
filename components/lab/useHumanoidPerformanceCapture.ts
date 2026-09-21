"use client";

import {
  useCallback,
  useRef,
  useState,
} from "react";

import {
  summarizeBrowserFrames,
  type BrowserPerformanceEvidence,
} from "@/lib/performance/browser-evidence";

type Snapshot = {
  state:
    | "idle"
    | "listening"
    | "thinking"
    | "speaking"
    | "executing"
    | "success"
    | "error";
  quality: "low" | "high";
  effects: boolean;
  particleCount: number | null;
  reducedMotion: boolean;
  cameraEnabled: boolean;
  assemblyActive: boolean;
  shockwaveActive: boolean;
  gpu: {
    renderer: string;
    vendor: string;
    software: boolean;
  } | null;
};

type CaptureResult = {
  evidencePath: string;
  scenario: string;
};

type PerformanceMemory = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
};

function scenarioFor(snapshot: Snapshot) {
  if (snapshot.assemblyActive) return "assembly" as const;
  if (snapshot.shockwaveActive) return "shockwave" as const;
  return snapshot.state;
}

export function useHumanoidPerformanceCapture() {
  const [capturing, setCapturing] =
    useState(false);
  const [status, setStatus] =
    useState("NOT CAPTURED");
  const activeRef = useRef(false);

  const capture = useCallback(
    async (
      snapshot: Snapshot,
      durationMs = 10_000,
    ): Promise<CaptureResult> => {
      if (activeRef.current) {
        throw new Error(
          "Performance capture already running.",
        );
      }
      if (snapshot.quality !== "high") {
        throw new Error(
          "Set Humanoid QUALITY HIGH before capture.",
        );
      }

      activeRef.current = true;
      setCapturing(true);
      setStatus("CAPTURING 10S...");

      let windowErrorCount = 0;
      let unhandledRejectionCount = 0;
      let consoleErrorCount = 0;
      let consoleWarnCount = 0;
      let longTaskCount = 0;
      let longTaskTotalMs = 0;

      const originalError = console.error;
      const originalWarn = console.warn;
      console.error = (...args: unknown[]) => {
        consoleErrorCount += 1;
        originalError.apply(console, args);
      };
      console.warn = (...args: unknown[]) => {
        consoleWarnCount += 1;
        originalWarn.apply(console, args);
      };

      const onWindowError = () => {
        windowErrorCount += 1;
      };
      const onUnhandled = () => {
        unhandledRejectionCount += 1;
      };
      window.addEventListener(
        "error",
        onWindowError,
      );
      window.addEventListener(
        "unhandledrejection",
        onUnhandled,
      );

      let observer: PerformanceObserver | null = null;
      try {
        observer = new PerformanceObserver(
          (list) => {
            for (const entry of list.getEntries()) {
              longTaskCount += 1;
              longTaskTotalMs += entry.duration;
            }
          },
        );
        observer.observe({
          entryTypes: ["longtask"],
        });
      } catch {
        observer = null;
      }

      const intervals: number[] = [];
      let raf = 0;
      let previous = 0;
      const started = performance.now();

      try {
        await new Promise<void>((resolve) => {
          const tick = (time: number) => {
            if (previous > 0) {
              intervals.push(time - previous);
            }
            previous = time;
            if (
              time - started >= durationMs
            ) {
              resolve();
              return;
            }
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        });

        if (intervals.length === 0) {
          throw new Error(
            "No animation frames were captured.",
          );
        }

        const memory = (
          performance as Performance & {
            memory?: PerformanceMemory;
          }
        ).memory;

        const evidence:
          BrowserPerformanceEvidence = {
            schemaVersion: 1,
            capturedAt:
              new Date().toISOString(),
            scenario: scenarioFor(snapshot),
            releaseVerdict:
              "NOT_EVALUATED",
            frame:
              summarizeBrowserFrames(
                intervals,
              ),
            environment: {
              userAgent:
                navigator.userAgent,
              viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                dpr:
                  window.devicePixelRatio ||
                  1,
              },
              gpu: snapshot.gpu,
              jsHeap: memory
                ? {
                    usedBytes:
                      memory.usedJSHeapSize,
                    totalBytes:
                      memory.totalJSHeapSize,
                    limitBytes:
                      memory.jsHeapSizeLimit,
                  }
                : null,
            },
            humanoid: {
              quality: snapshot.quality,
              effects: snapshot.effects,
              particleCount:
                snapshot.particleCount,
              reducedMotion:
                snapshot.reducedMotion,
              cameraEnabled:
                snapshot.cameraEnabled,
              assemblyActive:
                snapshot.assemblyActive,
              shockwaveActive:
                snapshot.shockwaveActive,
            },
            diagnostics: {
              longTaskCount,
              longTaskTotalMs:
                Math.round(
                  longTaskTotalMs * 1000,
                ) / 1000,
              windowErrorCount,
              unhandledRejectionCount,
              consoleErrorCount,
              consoleWarnCount,
            },
          };

        const response = await fetch(
          "/api/performance/browser-evidence",
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
              "x-astra-client": "1",
            },
            body: JSON.stringify(evidence),
          },
        );

        if (!response.ok) {
          throw new Error(
            `Browser evidence save failed (${response.status}).`,
          );
        }

        const result = await response.json() as {
          evidencePath?: string;
          scenario?: string;
        };
        if (!result.evidencePath) {
          throw new Error(
            "Browser evidence path missing.",
          );
        }

        setStatus(
          `SAVED ${result.scenario ?? evidence.scenario}`,
        );
        return {
          evidencePath:
            result.evidencePath,
          scenario:
            result.scenario ??
            evidence.scenario,
        };
      } catch (error) {
        setStatus("CAPTURE FAILED");
        throw error;
      } finally {
        if (raf) {
          cancelAnimationFrame(raf);
        }
        observer?.disconnect();
        window.removeEventListener(
          "error",
          onWindowError,
        );
        window.removeEventListener(
          "unhandledrejection",
          onUnhandled,
        );
        console.error = originalError;
        console.warn = originalWarn;
        activeRef.current = false;
        setCapturing(false);
      }
    },
    [],
  );

  return {
    capture,
    capturing,
    status,
  };
}
