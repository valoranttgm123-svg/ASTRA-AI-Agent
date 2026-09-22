"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AstraBackgroundTask,
  AstraTaskTickPlan,
} from "@/lib/tasks/contracts";
import type {
  AstraAuditCategory,
  AstraAuditEntry,
  AstraAuditOutcome,
  AstraDiagnosticsSnapshot,
  AstraHealthStatus,
} from "@/lib/diagnostics/contracts";

type TaskStatusResponse = {
  ok: boolean;
  available: boolean;
  detail: string;
  tasks: AstraBackgroundTask[];
  plan?: AstraTaskTickPlan;
};

type DiagnosticsResponse = {
  ok: boolean;
  diagnostics: AstraDiagnosticsSnapshot;
  audit: {
    available: boolean;
    detail: string;
    entries: AstraAuditEntry[];
  };
  truthBoundary: string;
};

type Tab = "tasks" | "diagnostics";

const HEALTH_ORDER: Record<AstraHealthStatus, number> = {
  unavailable: 0,
  degraded: 1,
  unknown: 2,
  not_configured: 3,
  healthy: 4,
};

function message(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string") return record.error;
  if (typeof record.message === "string") return record.message;
  return fallback;
}

function displayTime(value: string | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "INVALID";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function taskActionAllowed(
  task: AstraBackgroundTask,
  action: "resume" | "pause" | "cancel" | "delete",
) {
  if (action === "resume") {
    return (
      task.status === "paused" ||
      task.status === "failed" ||
      task.status === "cancelled"
    );
  }
  if (action === "pause") {
    return (
      task.status === "queued" ||
      task.status === "retry_wait" ||
      task.status === "running"
    );
  }
  if (action === "cancel") {
    return task.status !== "succeeded" && task.status !== "cancelled";
  }
  return task.status !== "running";
}

function queueCount(plan: AstraTaskTickPlan | undefined) {
  if (!plan) return 0;
  return (
    plan.ready.length +
    plan.waitingApproval.length +
    plan.waitingDependency.length +
    plan.blockedDependency.length +
    plan.deferredCapacity.length
  );
}

export default function AstraOperationsPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("tasks");
  const [tasks, setTasks] = useState<TaskStatusResponse | null>(null);
  const [diagnostics, setDiagnostics] =
    useState<DiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [category, setCategory] = useState<AstraAuditCategory | "">("");
  const [outcome, setOutcome] = useState<AstraAuditOutcome | "">("");

  const refreshTasks = useCallback(async () => {
    const response = await fetch("/api/tasks", {
      method: "GET",
      cache: "no-store",
    });
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(message(payload, "Background task status failed."));
    }
    setTasks(payload as TaskStatusResponse);
  }, []);

  const refreshDiagnostics = useCallback(async () => {
    const params = new URLSearchParams({ limit: "50" });
    if (category) params.set("category", category);
    if (outcome) params.set("outcome", outcome);

    const response = await fetch(
      "/api/diagnostics?" + params.toString(),
      {
        method: "GET",
        cache: "no-store",
      },
    );
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(message(payload, "Diagnostics request failed."));
    }
    setDiagnostics(payload as DiagnosticsResponse);
  }, [category, outcome]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "tasks") await refreshTasks();
      else await refreshDiagnostics();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Operations refresh failed.",
      );
    } finally {
      setLoading(false);
    }
  }, [refreshDiagnostics, refreshTasks, tab]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  const mutateTask = useCallback(
    async (
      task: AstraBackgroundTask,
      action: "resume" | "pause" | "cancel" | "delete",
    ) => {
      if (!taskActionAllowed(task, action)) return;
      if (
        action === "delete" &&
        typeof window !== "undefined" &&
        !window.confirm('Delete background task "' + task.title + '"?')
      ) {
        return;
      }

      setBusyKey(action + ":" + task.id);
      setError(null);
      setNotice(null);
      try {
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-astra-client": "1",
          },
          body: JSON.stringify({ action, id: task.id }),
        });
        const payload = (await response.json()) as unknown;
        if (!response.ok) {
          throw new Error(message(payload, "Task mutation failed."));
        }
        setNotice(task.id + " → " + action.toUpperCase());
        await refreshTasks();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Task mutation failed.",
        );
      } finally {
        setBusyKey(null);
      }
    },
    [refreshTasks],
  );

  const sortedHealth = useMemo(
    () =>
      [...(diagnostics?.diagnostics.samples ?? [])].sort(
        (left, right) =>
          HEALTH_ORDER[left.status] - HEALTH_ORDER[right.status] ||
          left.id.localeCompare(right.id),
      ),
    [diagnostics?.diagnostics.samples],
  );

  if (!open) {
    return (
      <button
        type="button"
        className="astra-operations__launcher"
        onClick={() => setOpen(true)}
      >
        OPERATIONS
      </button>
    );
  }

  return (
    <aside
      className="astra-operations"
      aria-label="ASTRA operations panel"
    >
      <div className="astra-operations__head">
        <div>
          <div className="astra-operations__title">OPERATIONS</div>
          <div className="astra-operations__subtitle">
            TASKS · DIAGNOSTICS · AUDIT
          </div>
        </div>
        <button
          type="button"
          className="astra-operations__close"
          onClick={() => setOpen(false)}
          aria-label="Close operations panel"
        >
          ×
        </button>
      </div>

      <div className="astra-operations__tabs">
        <button
          type="button"
          aria-pressed={tab === "tasks"}
          onClick={() => setTab("tasks")}
        >
          TASKS
        </button>
        <button
          type="button"
          aria-pressed={tab === "diagnostics"}
          onClick={() => setTab("diagnostics")}
        >
          DIAGNOSTICS
        </button>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? "REFRESHING" : "REFRESH"}
        </button>
      </div>

      {error ? (
        <p className="astra-operations__error">{error}</p>
      ) : null}
      {notice ? (
        <p className="astra-operations__notice">{notice}</p>
      ) : null}

      {tab === "tasks" ? (
        <section className="astra-operations__section">
          <div className="astra-operations__section-title">
            DURABLE BACKGROUND TASKS
          </div>

          <div className="astra-operations__summary">
            <span>{tasks?.tasks.length ?? 0} TASKS</span>
            <span>{queueCount(tasks?.plan)} PLANNED</span>
            <span>
              {tasks?.available ? "STORE READY" : "STORE UNAVAILABLE"}
            </span>
          </div>

          <p className="astra-operations__detail">
            {tasks?.detail ??
              "Task state is loaded from the private durable task store."}
          </p>

          {(tasks?.tasks.length ?? 0) === 0 ? (
            <div className="astra-operations__empty">
              No durable background tasks are registered.
            </div>
          ) : (
            <div className="astra-operations__list">
              {tasks?.tasks.map((task) => (
                <article
                  key={task.id}
                  className="astra-operations__task"
                >
                  <div className="astra-operations__item-head">
                    <div>
                      <strong>{task.title}</strong>
                      <span>{task.id}</span>
                    </div>
                    <span
                      className={
                        "astra-operations__status astra-operations__status--" +
                        task.status
                      }
                    >
                      {task.status.toUpperCase()}
                    </span>
                  </div>

                  <p>{task.goal}</p>

                  <div className="astra-operations__meta">
                    <span>AGENT {task.agent}</span>
                    <span>PRIORITY {task.priority}</span>
                    <span>LEVEL {task.requiredPermissionLevel}</span>
                    <span>ATTEMPTS {task.attempts}/{task.maxAttempts}</span>
                    <span>UPDATED {displayTime(task.updatedAt)}</span>
                  </div>

                  {task.checkpoint ? (
                    <div className="astra-operations__checkpoint">
                      CHECKPOINT #{task.checkpoint.sequence} ·{" "}
                      {task.checkpoint.summary}
                    </div>
                  ) : null}

                  {task.lastError ? (
                    <div className="astra-operations__failure">
                      {task.lastError}
                    </div>
                  ) : null}

                  <div className="astra-operations__actions">
                    {(["resume", "pause", "cancel", "delete"] as const).map(
                      (action) => (
                        <button
                          type="button"
                          key={action}
                          disabled={
                            !taskActionAllowed(task, action) ||
                            busyKey !== null
                          }
                          className={
                            action === "cancel" || action === "delete"
                              ? "astra-operations__danger"
                              : undefined
                          }
                          onClick={() => void mutateTask(task, action)}
                        >
                          {busyKey === action + ":" + task.id
                            ? "WORKING"
                            : action.toUpperCase()}
                        </button>
                      ),
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {tasks?.plan ? (
            <div className="astra-operations__queue">
              <strong>QUEUE PLAN</strong>
              <span>READY {tasks.plan.ready.length}</span>
              <span>APPROVAL {tasks.plan.waitingApproval.length}</span>
              <span>DEPENDENCY {tasks.plan.waitingDependency.length}</span>
              <span>BLOCKED {tasks.plan.blockedDependency.length}</span>
              <span>CAPACITY {tasks.plan.deferredCapacity.length}</span>
            </div>
          ) : null}

          <p className="astra-operations__truth">
            This panel exposes durable task state and lifecycle controls only.
            Production executors and real restart evidence remain separate
            integration gates.
          </p>
        </section>
      ) : (
        <section className="astra-operations__section">
          <div className="astra-operations__section-title">
            HEALTH + ACTION HISTORY
          </div>

          <div className="astra-operations__summary">
            <span>
              MODE{" "}
              {diagnostics?.diagnostics.operatingMode.toUpperCase() ??
                "UNKNOWN"}
            </span>
            <span>
              HEALTHY {diagnostics?.diagnostics.healthy ?? 0}
            </span>
            <span>
              DEGRADED {diagnostics?.diagnostics.degraded ?? 0}
            </span>
            <span>
              UNAVAILABLE {diagnostics?.diagnostics.unavailable ?? 0}
            </span>
          </div>

          <div className="astra-operations__filters">
            <select
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value as AstraAuditCategory | "",
                )
              }
              aria-label="Audit category"
            >
              <option value="">ALL CATEGORIES</option>
              {[
                "brain",
                "tool",
                "automation",
                "task",
                "event",
                "provider",
                "memory",
                "system",
                "security",
              ].map((value) => (
                <option key={value} value={value}>
                  {value.toUpperCase()}
                </option>
              ))}
            </select>

            <select
              value={outcome}
              onChange={(event) =>
                setOutcome(event.target.value as AstraAuditOutcome | "")
              }
              aria-label="Audit outcome"
            >
              <option value="">ALL OUTCOMES</option>
              {["success", "failure", "blocked", "cancelled"].map(
                (value) => (
                  <option key={value} value={value}>
                    {value.toUpperCase()}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="astra-operations__health">
            {sortedHealth.length === 0 ? (
              <div className="astra-operations__empty">
                No health samples available.
              </div>
            ) : (
              sortedHealth.map((sample) => (
                <div
                  className="astra-operations__health-row"
                  key={sample.id}
                >
                  <div>
                    <strong>{sample.id}</strong>
                    <span>{sample.detail}</span>
                  </div>
                  <span
                    className={
                      "astra-operations__health-status astra-operations__health-status--" +
                      sample.status
                    }
                  >
                    {sample.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="astra-operations__audit">
            <div className="astra-operations__section-title">
              WHAT ASTRA DID
            </div>
            {(diagnostics?.audit.entries.length ?? 0) === 0 ? (
              <div className="astra-operations__empty">
                No audit entries match the current filters.
              </div>
            ) : (
              diagnostics?.audit.entries.map((entry) => (
                <article
                  className="astra-operations__audit-entry"
                  key={entry.id}
                >
                  <div className="astra-operations__item-head">
                    <div>
                      <strong>{entry.action}</strong>
                      <span>
                        {entry.category.toUpperCase()} ·{" "}
                        {displayTime(entry.at)}
                      </span>
                    </div>
                    <span
                      className={
                        "astra-operations__outcome astra-operations__outcome--" +
                        entry.outcome
                      }
                    >
                      {entry.outcome.toUpperCase()}
                    </span>
                  </div>
                  <p>{entry.detail}</p>
                  <div className="astra-operations__meta">
                    <span>
                      ACTOR {entry.actor.kind}:{entry.actor.id}
                    </span>
                    {entry.permissionLevel !== undefined ? (
                      <span>LEVEL {entry.permissionLevel}</span>
                    ) : null}
                    {entry.projectId ? (
                      <span>PROJECT {entry.projectId}</span>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>

          <p className="astra-operations__truth">
            {diagnostics?.truthBoundary ??
              "Diagnostics are read-only. Connectivity remains UNKNOWN until a real probe is wired."}
          </p>
        </section>
      )}
    </aside>
  );
}
