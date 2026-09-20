import { randomUUID } from "node:crypto";
import type { AstraInputContext } from "@/lib/agent/types";
import type {
  AstraAutomationLastRun,
  AstraAutomationRecord,
  AstraAutomationRunner,
  AstraAutomationRunResult,
} from "./contracts";
import {
  automationEnabled,
  nextRunFromSchedule,
  withAutomationStore,
} from "./store";

const MAX_RUNS_PER_TICK = 5;
const DEFAULT_LEASE_MS = 15 * 60_000;

function leaseMs() {
  const parsed = Number(process.env.ASTRA_AUTOMATION_LEASE_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_LEASE_MS;
  return Math.max(60_000, Math.min(60 * 60_000, Math.floor(parsed)));
}

function automationInputContext(): AstraInputContext {
  return {
    source: "text",
    trigger: "automation",
    modalities: ["text"],
    consent: {
      microphone: false,
      camera: false,
      image: false,
      screen: false,
    },
    visualContentProvided: false,
  };
}

function leaseExpired(record: AstraAutomationRecord, nowMs: number) {
  if (!record.activeRun) return true;
  const until = Date.parse(record.activeRun.leaseUntil);
  return !Number.isFinite(until) || until <= nowMs;
}

function isDue(record: AstraAutomationRecord, nowMs: number) {
  if (!record.enabled || !record.nextRunAt) return false;
  const next = Date.parse(record.nextRunAt);
  return Number.isFinite(next) && next <= nowMs && leaseExpired(record, nowMs);
}

export function dueAutomationIds(
  records: readonly AstraAutomationRecord[],
  now = new Date(),
) {
  const nowMs = now.getTime();
  return records
    .filter((record) => isDue(record, nowMs))
    .sort(
      (a, b) =>
        Date.parse(a.nextRunAt ?? "") - Date.parse(b.nextRunAt ?? ""),
    )
    .slice(0, MAX_RUNS_PER_TICK)
    .map((record) => record.id);
}

async function claimAutomation(
  id: string,
  now: Date,
  force = false,
): Promise<AstraAutomationRecord | null> {
  return withAutomationStore((records) => {
    const nowMs = now.getTime();
    let claimed: AstraAutomationRecord | null = null;
    const next = records.map((record) => {
      if (record.id !== id) return record;
      if (!record.enabled) return record;
      if (!force && !isDue(record, nowMs)) return record;
      if (!leaseExpired(record, nowMs)) return record;

      const runId = "run-" + randomUUID();
      const startedAt = now.toISOString();
      claimed = {
        ...record,
        activeRun: {
          runId,
          startedAt,
          leaseUntil: new Date(nowMs + leaseMs()).toISOString(),
        },
        lastRun: {
          runId,
          startedAt,
          status: "running",
          detail: "Automation run claimed by the local ASTRA scheduler.",
        },
        updatedAt: startedAt,
      };
      return claimed;
    });

    return { records: next, result: claimed };
  });
}

function safeApproval(
  result: AstraAutomationRunResult,
): AstraAutomationLastRun["approval"] {
  const request = result.approvalRequest;
  if (!request || request.level !== 3) return undefined;
  return {
    level: 3,
    planId: request.planId,
    stepId: request.stepId,
    title: request.title,
    toolId: request.toolId,
    expiresAt: request.expiresAt,
  };
}

function runStatus(result: AstraAutomationRunResult) {
  if (result.requiresApproval) return "waiting_approval" as const;
  if (result.state === "completed") return "completed" as const;
  if (result.state === "blocked") return "blocked" as const;
  return "error" as const;
}

async function finishAutomation(
  claimed: AstraAutomationRecord,
  result: AstraAutomationRunResult,
  finishedAt: Date,
) {
  const runId = claimed.activeRun?.runId;
  if (!runId) return;

  await withAutomationStore((records) => {
    const next = records.map((record) => {
      if (
        record.id !== claimed.id ||
        record.activeRun?.runId !== runId
      ) {
        return record;
      }

      const once = record.schedule.kind === "once";
      const approval = safeApproval(result);

      return {
        ...record,
        enabled: once ? false : record.enabled,
        nextRunAt: once
          ? null
          : nextRunFromSchedule(record.schedule, finishedAt),
        activeRun: undefined,
        lastRun: {
          runId,
          startedAt:
            claimed.activeRun?.startedAt ?? finishedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          status: runStatus(result),
          detail: result.message.slice(0, 2_000),
          ...(result.requiresApproval
            ? { requiresApproval: true }
            : {}),
          ...(approval ? { approval } : {}),
        },
        updatedAt: finishedAt.toISOString(),
      };
    });
    return { records: next, result: undefined };
  });
}

async function failAutomation(
  claimed: AstraAutomationRecord,
  error: unknown,
  finishedAt: Date,
  cancelled = false,
) {
  const result: AstraAutomationRunResult = {
    ok: false,
    state: "error",
    message:
      error instanceof Error
        ? error.message.slice(0, 2_000)
        : "Automation execution failed.",
  };

  const runId = claimed.activeRun?.runId;
  if (!runId) return;

  await withAutomationStore((records) => {
    const next = records.map((record) => {
      if (
        record.id !== claimed.id ||
        record.activeRun?.runId !== runId
      ) {
        return record;
      }
      const once = record.schedule.kind === "once";
      return {
        ...record,
        enabled: once ? false : record.enabled,
        nextRunAt: once
          ? null
          : nextRunFromSchedule(record.schedule, finishedAt),
        activeRun: undefined,
        lastRun: {
          runId,
          startedAt:
            claimed.activeRun?.startedAt ?? finishedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          status: cancelled ? ("cancelled" as const) : ("error" as const),
          detail: result.message,
        },
        updatedAt: finishedAt.toISOString(),
      };
    });
    return { records: next, result: undefined };
  });
}

async function executeClaim(
  claimed: AstraAutomationRecord,
  runner: AstraAutomationRunner,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();

  try {
    const options = {
      provider: claimed.provider,
      inputContext: automationInputContext(),
      signal,
    };
    const result =
      claimed.mode === "execute"
        ? await runner.execute(
            {
              input: claimed.prompt,
              // Scheduling is not approval. The normal Brain permission gate
              // remains authoritative for every scheduled execution request.
              approved: false,
            },
            options,
          )
        : await runner.chat(claimed.prompt, options);

    await finishAutomation(claimed, result, new Date());
    return {
      id: claimed.id,
      runId: claimed.activeRun?.runId,
      status: runStatus(result),
      result,
    };
  } catch (error) {
    const cancelled =
      signal?.aborted ||
      (error instanceof DOMException && error.name === "AbortError");
    await failAutomation(claimed, error, new Date(), cancelled);
    if (cancelled) throw error;
    return {
      id: claimed.id,
      runId: claimed.activeRun?.runId,
      status: "error" as const,
      result: {
        ok: false,
        state: "error" as const,
        message:
          error instanceof Error
            ? error.message
            : "Automation execution failed.",
      },
    };
  }
}

export async function runDueAutomations({
  runner,
  now = new Date(),
  signal,
}: {
  runner: AstraAutomationRunner;
  now?: Date;
  signal?: AbortSignal;
}) {
  if (!automationEnabled()) {
    return {
      enabled: false,
      claimed: 0,
      runs: [],
    };
  }

  const ids = await withAutomationStore((records) => ({
    records,
    result: dueAutomationIds(records, now),
  }));

  const runs = [];
  for (const id of ids) {
    signal?.throwIfAborted();
    const claimed = await claimAutomation(id, now);
    if (!claimed) continue;
    runs.push(await executeClaim(claimed, runner, signal));
  }

  return {
    enabled: true,
    claimed: runs.length,
    runs,
  };
}

export async function runAutomationNow({
  id,
  runner,
  signal,
}: {
  id: string;
  runner: AstraAutomationRunner;
  signal?: AbortSignal;
}) {
  if (!automationEnabled()) {
    throw new Error("ASTRA automation is disabled.");
  }

  const claimed = await claimAutomation(id, new Date(), true);
  if (!claimed) {
    throw new Error(
      "Automation is disabled, missing, or already running.",
    );
  }
  return executeClaim(claimed, runner, signal);
}
