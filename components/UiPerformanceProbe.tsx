"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  summarizeBrowserFrames,
} from "@/lib/performance/browser-evidence";
import type {
  UiPerformanceEvidence,
  UiPerformanceScenario,
} from "@/lib/performance/ui-evidence";
import { useAstraRuntime } from "./AstraRuntime";

type PerformanceMemory = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
};

function queryEnabled() {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    new URLSearchParams(
      window.location.search,
    ).get("perf") === "1"
  );
}

function automationPanelOpen() {
  return Boolean(
    document.querySelector(
      ".astra-automation",
    ),
  );
}

export default function UiPerformanceProbe() {
  const runtime = useAstraRuntime();
  const [enabled, setEnabled] =
    useState(false);
  const [capturing, setCapturing] =
    useState(false);
  const [status, setStatus] =
    useState("READY");
  const activeRef = useRef(false);

  useEffect(() => {
    setEnabled(queryEnabled());
  }, []);

  if (!enabled) return null;

  const capture = async (
    scenario: UiPerformanceScenario,
  ) => {
    if (activeRef.current) return;

    if (
      scenario ===
        "automation-panel-open" &&
      !automationPanelOpen()
    ) {
      setStatus(
        "OPEN AUTOMATION PANEL FIRST",
      );
      return;
    }

    const brainPanelPresent = Boolean(
      document.querySelector(
        '[aria-label="ASTRA Brain activity"]',
      ),
    );
    const consolePresent = Boolean(
      document.querySelector(
        ".astra-console",
      ),
    );

    if (
      scenario ===
        "command-center-active" &&
      !brainPanelPresent
    ) {
      setStatus(
        "BRAIN PANEL NOT FOUND",
      );
      return;
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
    let brainStreamingObserved =
      runtime.brainStreaming;
    let automationStreamingObserved =
      runtime.automationStreaming;
    const brainEventCountStart =
      runtime.brainEvents.length;
    const orbStates = new Set<string>([
      runtime.orbState,
    ]);
    const automationOpenStart =
      automationPanelOpen();

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

    const onError = () => {
      windowErrorCount += 1;
    };
    const onUnhandled = () => {
      unhandledRejectionCount += 1;
    };
    window.addEventListener(
      "error",
      onError,
    );
    window.addEventListener(
      "unhandledrejection",
      onUnhandled,
    );

    let observer: PerformanceObserver | null =
      null;
    try {
      observer = new PerformanceObserver(
        (list) => {
          for (
            const entry of list.getEntries()
          ) {
            longTaskCount += 1;
            longTaskTotalMs +=
              entry.duration;
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
    let previous = 0;
    let raf = 0;
    const started = performance.now();

    try {
      await new Promise<void>(
        (resolve) => {
          const tick = (time: number) => {
            if (previous > 0) {
              intervals.push(
                time - previous,
              );
            }
            previous = time;

            brainStreamingObserved ||= 
              runtime.brainStreaming;
            automationStreamingObserved ||=
              runtime.automationStreaming;
            orbStates.add(
              runtime.orbState,
            );

            if (
              time - started >= 10_000
            ) {
              resolve();
              return;
            }
            raf =
              requestAnimationFrame(
                tick,
              );
          };
          raf =
            requestAnimationFrame(tick);
        },
      );

      if (intervals.length === 0) {
        throw new Error(
          "No animation frames captured.",
        );
      }

      const memory = (
        performance as Performance & {
          memory?: PerformanceMemory;
        }
      ).memory;

      const evidence:
        UiPerformanceEvidence = {
          schemaVersion: 1,
          capturedAt:
            new Date().toISOString(),
          scenario,
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
              width:
                window.innerWidth,
              height:
                window.innerHeight,
              dpr:
                window.devicePixelRatio ||
                1,
            },
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
          runtime: {
            brainPanelPresent,
            consolePresent,
            automationPanelOpenAtStart:
              automationOpenStart,
            automationPanelOpenAtEnd:
              automationPanelOpen(),
            brainStreamingObserved,
            automationStreamingObserved,
            brainEventCountStart,
            brainEventCountEnd:
              runtime.brainEvents.length,
            orbStatesObserved:
              [...orbStates],
          },
          diagnostics: {
            longTaskCount,
            longTaskTotalMs:
              Math.round(
                longTaskTotalMs *
                  1000,
              ) / 1000,
            windowErrorCount,
            unhandledRejectionCount,
            consoleErrorCount,
            consoleWarnCount,
          },
        };

      const response = await fetch(
        "/api/performance/ui-evidence",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
            "x-astra-client": "1",
          },
          body: JSON.stringify(
            evidence,
          ),
        },
      );
      if (!response.ok) {
        throw new Error(
          `UI evidence save failed (${response.status}).`,
        );
      }

      const result =
        await response.json() as {
          evidencePath?: string;
        };

      setStatus(
        result.evidencePath
          ? `SAVED ${scenario}`
          : "CAPTURE SAVED",
      );
    } catch {
      setStatus("CAPTURE FAILED");
    } finally {
      if (raf) {
        cancelAnimationFrame(raf);
      }
      observer?.disconnect();
      window.removeEventListener(
        "error",
        onError,
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
  };

  return (
    <aside
      aria-label="ASTRA UI performance probe"
      style={{
        position: "fixed",
        left: 16,
        bottom: 16,
        zIndex: 2000,
        width: 250,
        padding: 10,
        border:
          "1px solid rgba(99,234,255,.35)",
        borderRadius: 10,
        background:
          "rgba(2,8,14,.94)",
        color: "#bdf7ff",
        fontFamily:
          "var(--font-mono)",
        fontSize: 9,
      }}
    >
      <div
        style={{
          marginBottom: 7,
          letterSpacing: ".14em",
        }}
      >
        PERF UI · {status}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 5,
        }}
      >
        <button
          type="button"
          disabled={capturing}
          onClick={() =>
            void capture(
              "main-idle",
            )
          }
        >
          MAIN IDLE
        </button>
        <button
          type="button"
          disabled={capturing}
          onClick={() =>
            void capture(
              "command-center-active",
            )
          }
          title="Start capture, then trigger real ASTRA activity during the 10 second window"
        >
          COMMAND CENTER
        </button>
        <button
          type="button"
          disabled={capturing}
          onClick={() =>
            void capture(
              "automation-panel-open",
            )
          }
        >
          AUTOMATION PANEL
        </button>
      </div>
      <div
        style={{
          marginTop: 7,
          color:
            "rgba(189,247,255,.55)",
          lineHeight: 1.45,
        }}
      >
        Evidence only. No chat or console
        message text is stored.
      </div>
    </aside>
  );
}
