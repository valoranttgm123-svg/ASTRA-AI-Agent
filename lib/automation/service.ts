import type { AstraBrainEvent } from "@/lib/brain/types";
import { safeErrorDetail } from "@/lib/security/redaction";
import type {
  AstraAutomationLifecycleEvent,
} from "./queue";
import type {
  AstraAutomationTickResult,
} from "./runner";
import { runAutomationTickFromStore } from "./runner";
import { createReadOnlyAutomationExecutor } from "./read-only";
import { automationEventToBrainEvent } from "./telemetry";

export const ASTRA_AUTOMATION_SERVICE_DEFAULT_POLL_MS = 60_000;
export const ASTRA_AUTOMATION_SERVICE_MIN_POLL_MS = 15_000;
export const ASTRA_AUTOMATION_SERVICE_MAX_POLL_MS = 5 * 60_000;
const MAX_RECENT_EVENTS = 48;

export type AstraAutomationServiceSummary = {
  available: boolean;
  waitingApprovalCount: number;
  runCount: number;
  completed: number;
  failed: number;
  cancelled: number;
  skipped: number;
  stopped: boolean;
};

export type AstraAutomationServiceStatus = {
  enabled: boolean;
  running: boolean;
  tickActive: boolean;
  pollIntervalMs: number;
  startedAt?: string;
  lastTickStartedAt?: string;
  lastTickCompletedAt?: string;
  nextTickAt?: string;
  lastDetail: string;
  lastSummary?: AstraAutomationServiceSummary;
  recentEvents: AstraBrainEvent[];
};

export type AstraAutomationServiceTick = (options: {
  signal: AbortSignal;
  onEvent: (event: AstraAutomationLifecycleEvent) => void;
}) => Promise<AstraAutomationTickResult>;

type Listener = (event: AstraBrainEvent) => void;
type LifecycleListener = (event: AstraAutomationLifecycleEvent) => void;

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "off", "no"].includes(value);
}

function boundedPollMs(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return ASTRA_AUTOMATION_SERVICE_DEFAULT_POLL_MS;
  }
  return Math.min(
    ASTRA_AUTOMATION_SERVICE_MAX_POLL_MS,
    Math.max(
      ASTRA_AUTOMATION_SERVICE_MIN_POLL_MS,
      Math.floor(parsed),
    ),
  );
}

export function getAutomationServiceConfig() {
  return {
    enabled: envFlag("ASTRA_AUTOMATION_SERVICE_ENABLED", false),
    pollIntervalMs: boundedPollMs(
      process.env.ASTRA_AUTOMATION_SERVICE_POLL_MS,
    ),
  };
}

function summarize(
  result: AstraAutomationTickResult,
): AstraAutomationServiceSummary {
  return {
    available: result.available,
    waitingApprovalCount: result.waitingApproval.length,
    runCount: result.runs.length,
    completed: result.runs.filter((run) => run.status === "completed").length,
    failed: result.runs.filter((run) => run.status === "failed").length,
    cancelled: result.runs.filter((run) => run.status === "cancelled").length,
    skipped: result.runs.filter((run) => run.status === "skipped").length,
    stopped: result.stopped,
  };
}

function defaultTick(): AstraAutomationServiceTick {
  const execute = createReadOnlyAutomationExecutor();
  return ({ signal, onEvent }) =>
    runAutomationTickFromStore({
      execute,
      signal,
      onEvent,
    });
}

export class AstraAutomationService {
  private readonly enabled: boolean;
  private readonly pollIntervalMs: number;
  private readonly tick: AstraAutomationServiceTick;
  private readonly now: () => Date;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private activeController: AbortController | null = null;
  private activePromise: Promise<AstraAutomationTickResult | null> | null = null;
  private listeners = new Set<Listener>();
  private lifecycleListeners = new Set<LifecycleListener>();
  private recentEvents: AstraBrainEvent[] = [];
  private running = false;
  private startedAt: string | undefined;
  private lastTickStartedAt: string | undefined;
  private lastTickCompletedAt: string | undefined;
  private nextTickAt: string | undefined;
  private lastDetail: string;
  private lastSummary: AstraAutomationServiceSummary | undefined;

  constructor(options: {
    enabled: boolean;
    pollIntervalMs: number;
    tick?: AstraAutomationServiceTick;
    now?: () => Date;
  }) {
    this.enabled = options.enabled;
    this.pollIntervalMs = options.pollIntervalMs;
    this.tick = options.tick ?? defaultTick();
    this.now = options.now ?? (() => new Date());
    this.lastDetail = this.enabled
      ? "Automation service is enabled but not started."
      : "Automation service is disabled by ASTRA_AUTOMATION_SERVICE_ENABLED.";
  }

  getStatus(): AstraAutomationServiceStatus {
    return {
      enabled: this.enabled,
      running: this.running,
      tickActive: Boolean(this.activePromise),
      pollIntervalMs: this.pollIntervalMs,
      startedAt: this.startedAt,
      lastTickStartedAt: this.lastTickStartedAt,
      lastTickCompletedAt: this.lastTickCompletedAt,
      nextTickAt: this.nextTickAt,
      lastDetail: this.lastDetail,
      lastSummary: this.lastSummary
        ? { ...this.lastSummary }
        : undefined,
      recentEvents: this.recentEvents.map((event) => ({ ...event })),
    };
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeLifecycle(listener: LifecycleListener) {
    this.lifecycleListeners.add(listener);
    return () => {
      this.lifecycleListeners.delete(listener);
    };
  }

  start() {
    if (!this.enabled) {
      this.lastDetail =
        "Automation service remains OFF until ASTRA_AUTOMATION_SERVICE_ENABLED=true and ASTRA restarts.";
      return false;
    }
    if (this.running) return true;

    this.running = true;
    this.startedAt = this.now().toISOString();
    this.lastDetail =
      "Automation service started; unattended ceiling is Permission Level 1.";
    this.schedule(0);
    return true;
  }

  stop() {
    this.running = false;
    this.clearTimer();
    this.stopActive();
    this.nextTickAt = undefined;
    this.lastDetail = "Automation service stopped for this ASTRA process.";
  }

  stopActive() {
    if (!this.activeController) return false;
    this.activeController.abort(
      new DOMException(
        "ASTRA automation service stopped by global STOP.",
        "AbortError",
      ),
    );
    this.lastDetail =
      "Global STOP requested for the active automation service tick.";
    return true;
  }

  async tickNow(): Promise<AstraAutomationTickResult | null> {
    if (!this.enabled) {
      this.lastDetail =
        "Automation service tick refused because the service is disabled.";
      return null;
    }
    if (this.activePromise) return this.activePromise;

    this.clearTimer();
    const controller = new AbortController();
    this.activeController = controller;
    this.lastTickStartedAt = this.now().toISOString();
    this.nextTickAt = undefined;

    const promise = (async () => {
      try {
        const result = await this.tick({
          signal: controller.signal,
          onEvent: (event) => this.emitLifecycle(event),
        });
        this.lastSummary = summarize(result);
        this.lastDetail = result.detail;
        return result;
      } catch (error) {
        const cancelled =
          controller.signal.aborted ||
          (error instanceof Error && error.name === "AbortError");
        this.lastDetail = cancelled
          ? "Automation service tick cancelled by global STOP."
          : "Automation service tick failed: " +
            safeErrorDetail(
              error,
              "operation failed",
              700,
            );
        return null;
      } finally {
        this.activeController = null;
        this.activePromise = null;
        this.lastTickCompletedAt = this.now().toISOString();
        if (this.running) this.schedule(this.pollIntervalMs);
      }
    })();

    this.activePromise = promise;
    return promise;
  }

  private emitLifecycle(event: AstraAutomationLifecycleEvent) {
    for (const listener of this.lifecycleListeners) {
      try {
        listener(event);
      } catch {
        // Lifecycle observers must never break automation execution.
      }
    }

    const brainEvent = automationEventToBrainEvent(event);
    this.recentEvents = [
      ...this.recentEvents,
      brainEvent,
    ].slice(-MAX_RECENT_EVENTS);
    for (const listener of this.listeners) {
      try {
        listener(brainEvent);
      } catch {
        // A disconnected UI listener must never break the service.
      }
    }
  }

  private schedule(delayMs: number) {
    if (!this.running || !this.enabled) return;
    this.clearTimer();

    const now = this.now().getTime();
    this.nextTickAt = new Date(now + delayMs).toISOString();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.tickNow();
    }, delayMs);

    const timer = this.timer as ReturnType<typeof setTimeout> & {
      unref?: () => void;
    };
    timer.unref?.();
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

const config = getAutomationServiceConfig();
const service = new AstraAutomationService(config);

export function getAutomationService() {
  return service;
}

export function getAutomationServiceStatus() {
  return service.getStatus();
}

export function startAutomationServiceIfEnabled() {
  return service.start();
}

export function stopAutomationService() {
  service.stop();
}

export function stopAutomationServiceActiveTick() {
  return service.stopActive();
}

export function runAutomationServiceTickNow() {
  return service.tickNow();
}
