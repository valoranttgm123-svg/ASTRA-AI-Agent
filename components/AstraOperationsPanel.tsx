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
import type {
  AstraEventRecord,
  AstraEventSubscription,
} from "@/lib/events/contracts";

type TaskStatusResponse = {
  ok: boolean;
  available: boolean;
  detail: string;
  tasks: AstraBackgroundTask[];
  plan?: AstraTaskTickPlan;
};

type EventStatusResponse = {
  ok: boolean;
  available: boolean;
  detail: string;
  subscriptions: AstraEventSubscription[];
  events: AstraEventRecord[];
  unacknowledged: AstraEventRecord[];
};

type GitHubEventSourceStatusResponse = {
  ok: boolean;
  enabled: boolean;
  available: boolean;
  repository: string | null;
  authenticated: boolean;
  detail: string;
  runCount: number;
};

type ServiceHealthSourceStatusResponse = {
  ok: boolean;
  available: boolean;
  detail: string;
  sampleCount: number;
  unhealthy: number;
  capturedAt: string | null;
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

type Tab = "tasks" | "events" | "diagnostics";

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
  const [events, setEvents] = useState<EventStatusResponse | null>(null);
  const [githubEvents, setGithubEvents] =
    useState<GitHubEventSourceStatusResponse | null>(null);
  const [healthEvents, setHealthEvents] =
    useState<ServiceHealthSourceStatusResponse | null>(null);
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

  const refreshEvents = useCallback(async () => {
    const response = await fetch("/api/events", {
      method: "GET",
      cache: "no-store",
    });
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(message(payload, "Event Engine status failed."));
    }
    setEvents(payload as EventStatusResponse);
  }, []);

  const refreshGitHubEvents = useCallback(async () => {
    const response = await fetch("/api/events/github", {
      method: "GET",
      cache: "no-store",
    });
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(
        message(payload, "GitHub Actions event status failed."),
      );
    }
    setGithubEvents(payload as GitHubEventSourceStatusResponse);
  }, []);

  const refreshHealthEvents = useCallback(async () => {
    const response = await fetch("/api/events/health", {
      method: "GET",
      cache: "no-store",
    });
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(
        message(payload, "Service-health event status failed."),
      );
    }
    setHealthEvents(payload as ServiceHealthSourceStatusResponse);
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
      else if (tab === "events") {
        await Promise.all([
          refreshEvents(),
          refreshGitHubEvents(),
          refreshHealthEvents(),
        ]);
      } else await refreshDiagnostics();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Operations refresh failed.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    refreshDiagnostics,
    refreshEvents,
    refreshGitHubEvents,
    refreshHealthEvents,
    refreshTasks,
    tab,
  ]);

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

  const mutateEvent = useCallback(
    async (
      body:
        | { action: "ack"; id: string }
        | {
            action: "status";
            id: string;
            status: "enabled" | "disabled";
          },
    ) => {
      const key =
        body.action === "ack"
          ? "ack:" + body.id
          : "status:" + body.id;
      setBusyKey(key);
      setError(null);
      setNotice(null);
      try {
        const response = await fetch("/api/events", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-astra-client": "1",
          },
          body: JSON.stringify(body),
        });
        const payload = (await response.json()) as unknown;
        if (!response.ok) {
          throw new Error(message(payload, "Event Engine mutation failed."));
        }
        setNotice(
          body.action === "ack"
            ? "Event acknowledged."
            : body.id + " → " + body.status.toUpperCase(),
        );
        await refreshEvents();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Event Engine mutation failed.",
        );
      } finally {
        setBusyKey(null);
      }
    },
    [refreshEvents],
  );

  const syncGitHubEvents = useCallback(async () => {
    setBusyKey("github-sync");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/events/github", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-astra-client": "1",
        },
        body: JSON.stringify({ action: "sync" }),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error(
          message(payload, "GitHub Actions event sync failed."),
        );
      }
      const result = payload as {
        fetchedRuns?: number;
        records?: number;
        skippedSeen?: number;
      };
      setNotice(
        "GitHub sync: " +
          (result.fetchedRuns ?? 0) +
          " fetched · " +
          (result.records ?? 0) +
          " new record(s) · " +
          (result.skippedSeen ?? 0) +
          " already seen.",
      );
      await Promise.all([refreshEvents(), refreshGitHubEvents()]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "GitHub Actions event sync failed.",
      );
    } finally {
      setBusyKey(null);
    }
  }, [refreshEvents, refreshGitHubEvents]);

  const syncHealthEvents = useCallback(async () => {
    setBusyKey("health-sync");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/events/health", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-astra-client": "1",
        },
        body: JSON.stringify({ action: "sync" }),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error(
          message(payload, "Service-health event sync failed."),
        );
      }
      const result = payload as {
        samples?: number;
        records?: number;
        skippedBaseline?: number;
        skippedUnchanged?: number;
      };
      setNotice(
        "Health sync: " +
          (result.samples ?? 0) +
          " samples · " +
          (result.records ?? 0) +
          " new record(s) · " +
          ((result.skippedBaseline ?? 0) +
            (result.skippedUnchanged ?? 0)) +
          " quiet/unchanged.",
      );
      await Promise.all([refreshEvents(), refreshHealthEvents()]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Service-health event sync failed.",
      );
    } finally {
      setBusyKey(null);
    }
  }, [refreshEvents, refreshHealthEvents]);

  const recentEvents = useMemo(
    () => [...(events?.events ?? [])].reverse().slice(0, 100),
    [events?.events],
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
            TASKS · EVENTS · DIAGNOSTICS · AUDIT
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
          aria-pressed={tab === "events"}
          onClick={() => setTab("events")}
        >
          EVENTS
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
      ) : tab === "events" ? (
        <section className="astra-operations__section">
          <div className="astra-operations__section-title">
            EVENT INBOX + SUBSCRIPTIONS
          </div>

          <div className="astra-operations__summary">
            <span>{events?.subscriptions.length ?? 0} SUBSCRIPTIONS</span>
            <span>{events?.events.length ?? 0} RECORDS</span>
            <span>{events?.unacknowledged.length ?? 0} UNACKNOWLEDGED</span>
            <span>
              {events?.available ? "STORE READY" : "STORE UNAVAILABLE"}
            </span>
          </div>

          <p className="astra-operations__detail">
            {events?.detail ??
              "Event state is loaded from the private Event Engine store."}
          </p>

          <div className="astra-operations__source">
            <div className="astra-operations__item-head">
              <div>
                <strong>GITHUB ACTIONS SOURCE</strong>
                <span>
                  {githubEvents?.repository ?? "NO REPOSITORY CONFIGURED"}
                </span>
              </div>
              <span
                className={
                  "astra-operations__health-status astra-operations__health-status--" +
                  (githubEvents?.available
                    ? "healthy"
                    : githubEvents?.enabled
                      ? "degraded"
                      : "not_configured")
                }
              >
                {githubEvents?.available
                  ? "AVAILABLE"
                  : githubEvents?.enabled
                    ? "UNAVAILABLE"
                    : "DISABLED"}
              </span>
            </div>
            <p>
              {githubEvents?.detail ??
                "GitHub Actions source status has not been loaded."}
            </p>
            <div className="astra-operations__meta">
              <span>{githubEvents?.runCount ?? 0} RUNS READ</span>
              <span>
                {githubEvents?.authenticated
                  ? "TOKEN AUTH"
                  : "PUBLIC/NO TOKEN"}
              </span>
            </div>
            <div className="astra-operations__actions">
              <button
                type="button"
                disabled={
                  busyKey !== null || githubEvents?.enabled !== true
                }
                onClick={() => void syncGitHubEvents()}
              >
                {busyKey === "github-sync"
                  ? "SYNCING"
                  : "SYNC GITHUB"}
              </button>
            </div>
          </div>

          <div className="astra-operations__source">
            <div className="astra-operations__item-head">
              <div>
                <strong>LOCAL SERVICE HEALTH SOURCE</strong>
                <span>
                  {healthEvents?.capturedAt
                    ? "CAPTURE " + displayTime(healthEvents.capturedAt)
                    : "DIAGNOSTICS STATUS NOT LOADED"}
                </span>
              </div>
              <span
                className={
                  "astra-operations__health-status astra-operations__health-status--" +
                  (healthEvents?.available ? "healthy" : "degraded")
                }
              >
                {healthEvents?.available ? "AVAILABLE" : "UNAVAILABLE"}
              </span>
            </div>
            <p>
              {healthEvents?.detail ??
                "Local service-health source status has not been loaded."}
            </p>
            <div className="astra-operations__meta">
              <span>{healthEvents?.sampleCount ?? 0} SAMPLES</span>
              <span>{healthEvents?.unhealthy ?? 0} ATTENTION</span>
            </div>
            <div className="astra-operations__actions">
              <button
                type="button"
                disabled={busyKey !== null || healthEvents?.available !== true}
                onClick={() => void syncHealthEvents()}
              >
                {busyKey === "health-sync"
                  ? "SYNCING"
                  : "SYNC HEALTH"}
              </button>
            </div>
          </div>

          <div className="astra-operations__event-subscriptions">
            <div className="astra-operations__section-title">
              SUBSCRIPTIONS
            </div>
            {(events?.subscriptions.length ?? 0) === 0 ? (
              <div className="astra-operations__empty">
                No event subscriptions are registered.
              </div>
            ) : (
              events?.subscriptions.map((subscription) => (
                <article
                  className="astra-operations__subscription"
                  key={subscription.id}
                >
                  <div className="astra-operations__item-head">
                    <div>
                      <strong>{subscription.id}</strong>
                      <span>
                        {subscription.source.toUpperCase()} ·{" "}
                        {subscription.topic}
                      </span>
                    </div>
                    <span
                      className={
                        "astra-operations__status astra-operations__status--" +
                        subscription.status
                      }
                    >
                      {subscription.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="astra-operations__meta">
                    <span>FLOOR {subscription.severityFloor.toUpperCase()}</span>
                    <span>
                      {subscription.deliveryPolicy
                        .replace("_", " ")
                        .toUpperCase()}
                    </span>
                    <span>RATE {subscription.rateLimitPerHour}/H</span>
                    {subscription.projectId ? (
                      <span>PROJECT {subscription.projectId}</span>
                    ) : null}
                  </div>

                  <div className="astra-operations__actions">
                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() =>
                        void mutateEvent({
                          action: "status",
                          id: subscription.id,
                          status:
                            subscription.status === "enabled"
                              ? "disabled"
                              : "enabled",
                        })
                      }
                    >
                      {busyKey === "status:" + subscription.id
                        ? "WORKING"
                        : subscription.status === "enabled"
                          ? "DISABLE"
                          : "ENABLE"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="astra-operations__event-inbox">
            <div className="astra-operations__section-title">
              RECENT EVENT RECORDS
            </div>
            {recentEvents.length === 0 ? (
              <div className="astra-operations__empty">
                No Event Engine records are available.
              </div>
            ) : (
              recentEvents.map((event) => (
                <article
                  className="astra-operations__event"
                  key={event.id}
                >
                  <div className="astra-operations__item-head">
                    <div>
                      <strong>{event.title}</strong>
                      <span>
                        {event.source.toUpperCase()} · {event.topic} ·{" "}
                        {displayTime(event.occurredAt)}
                      </span>
                    </div>
                    <span
                      className={
                        "astra-operations__severity astra-operations__severity--" +
                        event.severity
                      }
                    >
                      {event.severity.toUpperCase()}
                    </span>
                  </div>

                  {event.detail ? <p>{event.detail}</p> : null}

                  <div className="astra-operations__meta">
                    <span>
                      {event.disposition.replaceAll("_", " ").toUpperCase()}
                    </span>
                    <span>SUB {event.subscriptionId}</span>
                    {event.projectId ? (
                      <span>PROJECT {event.projectId}</span>
                    ) : null}
                    <span>
                      {event.acknowledgedAt
                        ? "ACK " + displayTime(event.acknowledgedAt)
                        : "NOT ACKNOWLEDGED"}
                    </span>
                  </div>

                  {event.disposition === "delivered" &&
                  !event.acknowledgedAt ? (
                    <div className="astra-operations__actions">
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        onClick={() =>
                          void mutateEvent({
                            action: "ack",
                            id: event.id,
                          })
                        }
                      >
                        {busyKey === "ack:" + event.id
                          ? "WORKING"
                          : "ACKNOWLEDGE"}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>

          <p className="astra-operations__truth">
            This inbox only displays records already evaluated by the Event
            Engine. It does not fabricate source activity and does not expose
            manual event publishing.
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
