import type {
  AstraAutomationRunner,
  AstraAutomationSystemStatus,
} from "./contracts";
import { dueAutomationIds, runDueAutomations } from "./engine";
import {
  automationEnabled,
  automationPath,
  listAutomations,
} from "./store";

const DEFAULT_POLL_MS = 30_000;
let timer: ReturnType<typeof setInterval> | null = null;
let controller: AbortController | null = null;
let tickActive = false;
let lastError: string | null = null;

function pollMs() {
  const parsed = Number(process.env.ASTRA_AUTOMATION_POLL_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_POLL_MS;
  return Math.max(5_000, Math.min(5 * 60_000, Math.floor(parsed)));
}

async function tick(runner: AstraAutomationRunner) {
  if (tickActive || !automationEnabled()) return;
  tickActive = true;
  try {
    await runDueAutomations({
      runner,
      signal: controller?.signal,
    });
    lastError = null;
  } catch (error) {
    if (controller?.signal.aborted) return;
    lastError =
      error instanceof Error
        ? error.message.slice(0, 1_000)
        : "Automation worker tick failed.";
  } finally {
    tickActive = false;
  }
}

export function ensureAutomationWorker(
  runner: AstraAutomationRunner,
) {
  if (!automationEnabled()) return false;
  if (timer) return true;

  controller = new AbortController();
  void tick(runner);
  timer = setInterval(() => {
    void tick(runner);
  }, pollMs());
  timer.unref?.();
  return true;
}

export function stopAutomationWorker() {
  if (timer) clearInterval(timer);
  timer = null;
  controller?.abort(
    new DOMException("Automation worker stopped.", "AbortError"),
  );
  controller = null;
  tickActive = false;
}

export function automationWorkerRunning() {
  return Boolean(timer && !controller?.signal.aborted);
}

export async function getAutomationSystemStatus(): Promise<AstraAutomationSystemStatus> {
  const source = automationPath();
  const enabled = automationEnabled();

  try {
    const records = await listAutomations();
    const due = dueAutomationIds(records).length;
    return {
      enabled,
      available: true,
      workerRunning: automationWorkerRunning(),
      source,
      automations: records.length,
      due,
      detail: enabled
        ? lastError
          ? "Automation is enabled but the worker reported: " + lastError
          : "Automation is enabled. Scheduled execution still uses normal ASTRA permission and approval gates."
        : "Automation is OFF by default. Set ASTRA_AUTOMATION_ENABLED=true to allow scheduled runs.",
    };
  } catch (error) {
    return {
      enabled,
      available: false,
      workerRunning: automationWorkerRunning(),
      source,
      automations: 0,
      due: 0,
      detail:
        error instanceof Error
          ? "Automation store unavailable: " + error.message
          : "Automation store unavailable.",
    };
  }
}
