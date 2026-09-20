"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AstraApprovalRequest } from "@/lib/agent/types";
import type { AstraAutomationDefinition } from "@/lib/automation/contracts";
import type {
  AstraAutomationQueueItem,
  AstraAutomationTickPlan,
} from "@/lib/automation/queue";
import { useAstraRuntime } from "./AstraRuntime";

type AutomationStatusResponse = {
  ok: boolean;
  enabled: boolean;
  available: boolean;
  detail: string;
  automations: AstraAutomationDefinition[];
  queue: AstraAutomationTickPlan | null;
};

type FormState = {
  id: string;
  title: string;
  goal: string;
  projectId: string;
  scheduleKind: "once" | "interval";
  scheduleAt: string;
  everyMinutes: string;
  permissionLevel: "1" | "2" | "3";
  runtimeSeconds: string;
};

type PendingLevel3 = {
  automationId: string;
  scheduledFor: string;
  approval: AstraApprovalRequest;
};

const EMPTY_FORM: FormState = {
  id: "",
  title: "",
  goal: "",
  projectId: "",
  scheduleKind: "interval",
  scheduleAt: "",
  everyMinutes: "1440",
  permissionLevel: "1",
  runtimeSeconds: "60",
};

function localDateTimeValue(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function displayTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "INVALID";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function statusClass(status: AstraAutomationDefinition["status"]) {
  return "astra-automation__status astra-automation__status--" + status;
}

function scheduleText(automation: AstraAutomationDefinition) {
  if (automation.schedule.kind === "once") {
    return "ONCE · " + displayTime(automation.schedule.runAt);
  }
  return (
    "EVERY " +
    automation.schedule.everyMinutes +
    " MIN · FROM " +
    displayTime(automation.schedule.anchorAt)
  );
}

function errorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string") return record.error;
  if (typeof record.message === "string") return record.message;
  return fallback;
}

export default function AstraAutomationPanel() {
  const runtime = useAstraRuntime();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AutomationStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pendingLevel3, setPendingLevel3] =
    useState<PendingLevel3 | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/automation", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error(
          errorMessage(payload, "Automation status request failed."),
        );
      }
      setStatus(payload as AutomationStatusResponse);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Automation status request failed.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  const mutate = useCallback(
    async (body: Record<string, unknown>) => {
      const response = await fetch("/api/automation", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-astra-client": "1",
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error(
          errorMessage(payload, "Automation mutation failed."),
        );
      }
      await refresh();
      return payload;
    },
    [refresh],
  );

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormOpen(false);
  }, []);

  const openCreate = () => {
    const next = new Date(Date.now() + 60 * 60_000);
    next.setSeconds(0, 0);
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      scheduleAt: localDateTimeValue(next.toISOString()),
    });
    setFormOpen(true);
    setError(null);
    setNotice(null);
  };

  const openEdit = (automation: AstraAutomationDefinition) => {
    if (automation.status !== "paused") return;
    setEditingId(automation.id);
    setForm({
      id: automation.id,
      title: automation.title,
      goal: automation.goal,
      projectId: automation.projectId ?? "",
      scheduleKind: automation.schedule.kind,
      scheduleAt: localDateTimeValue(
        automation.schedule.kind === "once"
          ? automation.schedule.runAt
          : automation.schedule.anchorAt,
      ),
      everyMinutes:
        automation.schedule.kind === "interval"
          ? String(automation.schedule.everyMinutes)
          : "1440",
      permissionLevel: String(
        automation.requiredPermissionLevel,
      ) as FormState["permissionLevel"],
      runtimeSeconds: String(
        Math.max(1, Math.floor(automation.maxRuntimeMs / 1000)),
      ),
    });
    setFormOpen(true);
    setError(null);
    setNotice(null);
  };

  const submitDefinition = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.scheduleAt) {
      setError("Schedule date/time is required.");
      return;
    }

    const scheduleDate = new Date(form.scheduleAt);
    if (!Number.isFinite(scheduleDate.getTime())) {
      setError("Schedule date/time is invalid.");
      return;
    }

    const everyMinutes = Number(form.everyMinutes);
    const runtimeSeconds = Number(form.runtimeSeconds);
    const permissionLevel = Number(form.permissionLevel);

    const schedule =
      form.scheduleKind === "once"
        ? {
            kind: "once" as const,
            runAt: scheduleDate.toISOString(),
          }
        : {
            kind: "interval" as const,
            anchorAt: scheduleDate.toISOString(),
            everyMinutes,
          };

    setBusyKey("form");
    setError(null);
    setNotice(null);
    try {
      await mutate({
        action: "upsert",
        definition: {
          id: form.id,
          title: form.title,
          goal: form.goal,
          projectId: form.projectId || undefined,
          status: editingId ? "paused" : undefined,
          schedule,
          requiredPermissionLevel: permissionLevel,
          maxRuntimeMs: runtimeSeconds * 1000,
        },
      });
      setNotice(
        editingId
          ? "Automation definition updated while PAUSED."
          : "Automation created as PAUSED. Enable it after review.",
      );
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Automation save failed.",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const changeStatus = async (
    automation: AstraAutomationDefinition,
    next: AstraAutomationDefinition["status"],
  ) => {
    setBusyKey("status:" + automation.id);
    setError(null);
    setNotice(null);
    try {
      await mutate({
        action: "status",
        id: automation.id,
        status: next,
      });
      setNotice(automation.id + " → " + next.toUpperCase());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Status update failed.",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const removeDefinition = async (
    automation: AstraAutomationDefinition,
  ) => {
    if (automation.status === "enabled") {
      setError("Pause or disable an automation before deleting it.");
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        'Delete automation definition "' + automation.title + '"?',
      )
    ) {
      return;
    }

    setBusyKey("delete:" + automation.id);
    setError(null);
    setNotice(null);
    try {
      await mutate({
        action: "delete",
        id: automation.id,
      });
      if (editingId === automation.id) resetForm();
      setNotice("Automation definition deleted.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Delete failed.",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const approveOccurrence = async (item: AstraAutomationQueueItem) => {
    setBusyKey("run:" + item.automationId);
    setError(null);
    setNotice(null);
    try {
      const result = await runtime.runAutomationOccurrence({
        automationId: item.automationId,
        scheduledFor: item.scheduledFor,
        approved: true,
        provider: "auto",
      });

      const approval = result.brain?.approvalRequest;
      if (
        result.status === "waiting_level3_approval" &&
        approval
      ) {
        setPendingLevel3({
          automationId: item.automationId,
          scheduledFor: item.scheduledFor,
          approval,
        });
        setNotice(
          "Occurrence claimed. Review the Level-3 scope before approval.",
        );
      } else {
        setPendingLevel3(null);
        setNotice(result.detail);
      }
      await refresh();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setNotice("Automation occurrence stopped.");
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Automation occurrence failed.",
        );
      }
    } finally {
      setBusyKey(null);
    }
  };

  const approveLevel3 = async () => {
    if (!pendingLevel3) return;

    setBusyKey("level3:" + pendingLevel3.automationId);
    setError(null);
    setNotice(null);
    try {
      const result = await runtime.runAutomationOccurrence({
        automationId: pendingLevel3.automationId,
        scheduledFor: pendingLevel3.scheduledFor,
        approvalToken: pendingLevel3.approval.token,
        provider: "auto",
      });

      const followUp = result.brain?.approvalRequest;
      if (
        result.status === "waiting_level3_approval" &&
        followUp
      ) {
        setPendingLevel3({
          automationId: pendingLevel3.automationId,
          scheduledFor: pendingLevel3.scheduledFor,
          approval: followUp,
        });
        setNotice("Another exact Level-3 step requires approval.");
      } else {
        setPendingLevel3(null);
        setNotice(result.detail);
      }
      await refresh();
    } catch (err) {
      setPendingLevel3(null);
      if (err instanceof DOMException && err.name === "AbortError") {
        setNotice("Automation occurrence stopped.");
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Level-3 approval failed.",
        );
      }
    } finally {
      setBusyKey(null);
    }
  };

  const dueIds = useMemo(
    () =>
      new Set([
        ...(status?.queue?.ready ?? []).map(
          (item) => item.automationId,
        ),
        ...(status?.queue?.waitingApproval ?? []).map(
          (item) => item.automationId,
        ),
      ]),
    [status?.queue],
  );

  if (!open) {
    return (
      <button
        type="button"
        className="astra-automation__launcher"
        onClick={() => setOpen(true)}
      >
        AUTOMATION
        {runtime.automationStreaming ? " · ACTIVE" : ""}
      </button>
    );
  }

  const queue = status?.queue;
  const approvalScope = pendingLevel3
    ? Object.entries(pendingLevel3.approval.scope)
    : [];

  return (
    <aside
      className="astra-automation"
      aria-label="ASTRA Automation control panel"
    >
      <div className="astra-automation__head">
        <div>
          <div className="astra-automation__title">AUTOMATION</div>
          <div className="astra-automation__subtitle">
            SAFE SCHEDULED WORKFLOWS
          </div>
        </div>
        <button
          type="button"
          className="astra-automation__close"
          onClick={() => setOpen(false)}
          aria-label="Close Automation panel"
        >
          ×
        </button>
      </div>

      <div className="astra-automation__toolbar">
        <button type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "LOADING" : "REFRESH"}
        </button>
        <button type="button" onClick={openCreate}>
          NEW
        </button>
        <button
          type="button"
          className="astra-automation__stop"
          onClick={runtime.stopInteraction}
          disabled={!runtime.automationStreaming}
        >
          STOP ACTIVE
        </button>
      </div>

      <div className="astra-automation__summary">
        <span>
          {status?.enabled === false
            ? "DISABLED"
            : status?.available === false
              ? "ERROR"
              : "LOCAL READY"}
        </span>
        <span>{status?.automations.length ?? 0} DEFINITIONS</span>
        <span>
          {runtime.automationStreaming ? "STREAM ACTIVE" : "STREAM IDLE"}
        </span>
      </div>

      {status?.detail ? (
        <p className="astra-automation__detail">{status.detail}</p>
      ) : null}
      {error ? (
        <p className="astra-automation__error" role="alert">{error}</p>
      ) : null}
      {notice ? (
        <p className="astra-automation__notice">{notice}</p>
      ) : null}

      {pendingLevel3 ? (
        <section className="astra-automation__approval" aria-label="Level 3 approval">
          <strong>LEVEL 3 · EXTERNAL ACTION</strong>
          <span>{pendingLevel3.approval.title}</span>
          <span>TOOL · {pendingLevel3.approval.toolId}</span>
          <span>
            OCCURRENCE · {displayTime(pendingLevel3.scheduledFor)}
          </span>
          {pendingLevel3.approval.projectId ? (
            <span>PROJECT · {pendingLevel3.approval.projectId}</span>
          ) : null}
          {approvalScope.length > 0 ? (
            <div className="astra-automation__scope">
              {approvalScope.map(([key, value]) => (
                <span key={key}>
                  {key.toUpperCase()} · {String(value)}
                </span>
              ))}
            </div>
          ) : null}
          <div className="astra-automation__approval-actions">
            <button
              type="button"
              onClick={() => void approveLevel3()}
              disabled={busyKey?.startsWith("level3:")}
            >
              APPROVE ONCE
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingLevel3(null);
                setNotice(
                  "Level-3 action denied. The claimed occurrence will not silently retry.",
                );
              }}
            >
              DENY
            </button>
          </div>
        </section>
      ) : null}

      {queue ? (
        <section className="astra-automation__section">
          <div className="astra-automation__section-title">
            DUE NOW
          </div>
          {queue.waitingApproval.length === 0 &&
          queue.ready.length === 0 ? (
            <div className="astra-automation__empty">
              No due occurrence. Next wake · {displayTime(queue.nextWakeAt)}
            </div>
          ) : (
            <>
              {queue.waitingApproval.map((item) => (
                <div
                  className="astra-automation__queue-item"
                  key={item.automationId + item.scheduledFor}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      LEVEL {item.requiredPermissionLevel} ·{" "}
                      {displayTime(item.scheduledFor)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void approveOccurrence(item)}
                    disabled={Boolean(busyKey) || runtime.automationStreaming}
                  >
                    APPROVE RUN
                  </button>
                </div>
              ))}
              {queue.ready.map((item) => (
                <div
                  className="astra-automation__queue-item"
                  key={item.automationId + item.scheduledFor}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      READ-ONLY DUE · {displayTime(item.scheduledFor)}
                    </span>
                  </div>
                  <span className="astra-automation__readonly">
                    RUNNER READY
                  </span>
                </div>
              ))}
            </>
          )}
        </section>
      ) : null}

      <section className="astra-automation__section">
        <div className="astra-automation__section-title">
          DEFINITIONS
        </div>
        {status?.automations.length ? (
          <div className="astra-automation__definitions">
            {status.automations.map((automation) => {
              const busy =
                busyKey?.endsWith(":" + automation.id) ?? false;
              return (
                <article
                  className="astra-automation__definition"
                  key={automation.id}
                >
                  <div className="astra-automation__definition-head">
                    <div>
                      <strong>{automation.title}</strong>
                      <span>{automation.id}</span>
                    </div>
                    <span className={statusClass(automation.status)}>
                      {automation.status.toUpperCase()}
                    </span>
                  </div>
                  <p>{automation.goal}</p>
                  <div className="astra-automation__meta">
                    <span>LEVEL {automation.requiredPermissionLevel}</span>
                    <span>{scheduleText(automation)}</span>
                    <span>
                      LAST · {displayTime(automation.lastRunAt)}
                    </span>
                    {dueIds.has(automation.id) ? <span>DUE</span> : null}
                  </div>
                  <div className="astra-automation__actions">
                    {automation.status === "enabled" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void changeStatus(automation, "paused")
                        }
                      >
                        PAUSE
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void changeStatus(automation, "enabled")
                        }
                      >
                        ENABLE
                      </button>
                    )}
                    {automation.status !== "disabled" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void changeStatus(automation, "disabled")
                        }
                      >
                        DISABLE
                      </button>
                    ) : null}
                    {automation.status === "paused" ? (
                      <button
                        type="button"
                        onClick={() => openEdit(automation)}
                      >
                        EDIT
                      </button>
                    ) : null}
                    {automation.status !== "enabled" ? (
                      <button
                        type="button"
                        className="astra-automation__danger"
                        disabled={busy}
                        onClick={() => void removeDefinition(automation)}
                      >
                        DELETE
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="astra-automation__empty">
            No automation definitions yet.
          </div>
        )}
      </section>

      {formOpen ? (
        <form
          className="astra-automation__form"
          onSubmit={submitDefinition}
        >
          <div className="astra-automation__section-title">
            {editingId ? "EDIT PAUSED DEFINITION" : "NEW · SAVES AS PAUSED"}
          </div>
          <input
            required
            value={form.id}
            disabled={Boolean(editingId)}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                id: event.target.value,
              }))
            }
            placeholder="id e.g. daily-project-summary"
            maxLength={120}
          />
          <input
            required
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            placeholder="Title"
            maxLength={160}
          />
          <textarea
            required
            value={form.goal}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                goal: event.target.value,
              }))
            }
            placeholder="Scheduled goal"
            maxLength={4000}
            rows={3}
          />
          <input
            value={form.projectId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                projectId: event.target.value,
              }))
            }
            placeholder="Project ID (optional)"
            maxLength={120}
          />
          <div className="astra-automation__form-grid">
            <select
              value={form.scheduleKind}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  scheduleKind: event.target.value as FormState["scheduleKind"],
                }))
              }
            >
              <option value="interval">INTERVAL</option>
              <option value="once">ONCE</option>
            </select>
            <input
              required
              type="datetime-local"
              value={form.scheduleAt}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  scheduleAt: event.target.value,
                }))
              }
            />
            {form.scheduleKind === "interval" ? (
              <input
                required
                type="number"
                min={60}
                max={43200}
                step={1}
                value={form.everyMinutes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    everyMinutes: event.target.value,
                  }))
                }
                aria-label="Interval minutes"
                title="Interval minutes (minimum 60)"
              />
            ) : (
              <div className="astra-automation__form-placeholder">
                ONE TIME
              </div>
            )}
            <select
              value={form.permissionLevel}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  permissionLevel:
                    event.target.value as FormState["permissionLevel"],
                }))
              }
              aria-label="Permission level"
            >
              <option value="1">LEVEL 1 · READ</option>
              <option value="2">LEVEL 2 · SAFE LOCAL</option>
              <option value="3">LEVEL 3 · EXTERNAL</option>
            </select>
            <input
              required
              type="number"
              min={1}
              max={1800}
              value={form.runtimeSeconds}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  runtimeSeconds: event.target.value,
                }))
              }
              aria-label="Maximum runtime seconds"
              title="Maximum runtime seconds"
            />
          </div>
          <div className="astra-automation__form-actions">
            <button type="submit" disabled={busyKey === "form"}>
              {busyKey === "form" ? "SAVING" : "SAVE PAUSED"}
            </button>
            <button type="button" onClick={resetForm}>
              CANCEL
            </button>
          </div>
        </form>
      ) : null}
    </aside>
  );
}
