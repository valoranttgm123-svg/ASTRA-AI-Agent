import type { AstraIncomingEvent } from "./contracts";
import { publishIncomingEvent } from "./management";
import { loadEventStore } from "./store";
import {
  isRecordPayload,
  readBoundedProviderJson,
} from "../brain/provider-safety";
import { safeErrorDetail } from "../security/redaction";

const GITHUB_API_ROOT = "https://api.github.com";
const GITHUB_API_VERSION = "2026-03-10";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type GitHubWorkflowRunSnapshot = {
  id: number;
  name: string;
  runNumber: number;
  runAttempt: number;
  status: string;
  conclusion: string | null;
  event: string;
  headBranch: string | null;
  headSha: string;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
};

export type GitHubActionsEventStatus = {
  enabled: boolean;
  available: boolean;
  repository: string | null;
  authenticated: boolean;
  detail: string;
  runCount: number;
  latestRun?: GitHubWorkflowRunSnapshot;
};

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "off", "no"].includes(value);
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback;
  }
  return parsed;
}

function repositoryName(value: string) {
  const cleaned = value.trim();
  if (
    !/^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$/.test(cleaned) ||
    cleaned.includes("..")
  ) {
    throw new Error(
      "ASTRA GitHub event repository must use owner/repository form.",
    );
  }
  return cleaned;
}

export function getGitHubActionsEventConfig() {
  const configuredRepository =
    process.env.ASTRA_GITHUB_EVENTS_REPOSITORY?.trim() || "";

  return {
    enabled: envFlag("ASTRA_GITHUB_EVENTS_ENABLED", false),
    repository: configuredRepository,
    token: process.env.GITHUB_TOKEN?.trim() || "",
    timeoutMs: boundedInteger(
      process.env.ASTRA_GITHUB_EVENTS_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
      500,
      30_000,
    ),
    perPage: boundedInteger(
      process.env.ASTRA_GITHUB_EVENTS_PER_PAGE,
      DEFAULT_PER_PAGE,
      1,
      MAX_PER_PAGE,
    ),
  };
}

function stringField(
  value: unknown,
  field: string,
  max = 300,
) {
  if (typeof value !== "string") {
    throw new Error("GitHub Actions " + field + " is invalid.");
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) {
    throw new Error("GitHub Actions " + field + " is invalid.");
  }
  return cleaned;
}

function optionalStringField(
  value: unknown,
  field: string,
  max = 300,
) {
  if (value === null || value === undefined) return null;
  return stringField(value, field, max);
}

function integerField(value: unknown, field: string) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw new Error("GitHub Actions " + field + " is invalid.");
  }
  return value;
}

function isoField(value: unknown, field: string) {
  const raw = stringField(value, field, 80);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error("GitHub Actions " + field + " is invalid.");
  }
  return new Date(parsed).toISOString();
}

export function parseGitHubWorkflowRuns(
  payload: unknown,
  limit = DEFAULT_PER_PAGE,
): GitHubWorkflowRunSnapshot[] {
  if (!isRecordPayload(payload) || !Array.isArray(payload.workflow_runs)) {
    throw new Error("GitHub Actions workflow runs payload is malformed.");
  }

  if (payload.workflow_runs.length > 100) {
    throw new Error("GitHub Actions workflow runs payload is too large.");
  }

  return payload.workflow_runs.slice(0, Math.max(1, limit)).map((raw) => {
    if (!isRecordPayload(raw)) {
      throw new Error("GitHub Actions workflow run entry is malformed.");
    }

    const htmlUrl = stringField(raw.html_url, "html_url", 500);
    let url: URL;
    try {
      url = new URL(htmlUrl);
    } catch {
      throw new Error("GitHub Actions html_url is invalid.");
    }
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== "github.com"
    ) {
      throw new Error("GitHub Actions html_url must use github.com HTTPS.");
    }

    return {
      id: integerField(raw.id, "id"),
      name: stringField(raw.name, "name", 200),
      runNumber: integerField(raw.run_number, "run_number"),
      runAttempt:
        raw.run_attempt === undefined
          ? 1
          : integerField(raw.run_attempt, "run_attempt"),
      status: stringField(raw.status, "status", 80),
      conclusion: optionalStringField(
        raw.conclusion,
        "conclusion",
        80,
      ),
      event: stringField(raw.event, "event", 80),
      headBranch: optionalStringField(
        raw.head_branch,
        "head_branch",
        200,
      ),
      headSha: stringField(raw.head_sha, "head_sha", 80),
      createdAt: isoField(raw.created_at, "created_at"),
      updatedAt: isoField(raw.updated_at, "updated_at"),
      htmlUrl: url.toString(),
    };
  });
}

function withTimeout<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
  externalSignal?: AbortSignal,
) {
  const controller = new AbortController();
  const abort = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abort();
  else externalSignal?.addEventListener("abort", abort, { once: true });

  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException(
          "GitHub Actions event request timed out.",
          "TimeoutError",
        ),
      ),
    timeoutMs,
  );

  return run(controller.signal).finally(() => {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abort);
  });
}

function actionsUrl(repository: string, perPage: number) {
  const [owner, name] = repositoryName(repository).split("/");
  return (
    GITHUB_API_ROOT +
    "/repos/" +
    encodeURIComponent(owner) +
    "/" +
    encodeURIComponent(name) +
    "/actions/runs?per_page=" +
    perPage
  );
}

async function fetchWorkflowRuns({
  signal,
  fetchImpl = fetch,
}: {
  signal?: AbortSignal;
  fetchImpl?: FetchLike;
}) {
  const config = getGitHubActionsEventConfig();
  if (!config.enabled) {
    throw new Error("GitHub Actions event adapter is disabled.");
  }
  const repository = repositoryName(config.repository);
  const url = actionsUrl(repository, config.perPage);

  const response = await withTimeout(
    config.timeoutMs,
    (requestSignal) =>
      fetchImpl(url, {
        method: "GET",
        cache: "no-store",
        signal: requestSignal,
        redirect: "error",
        headers: {
          accept: "application/vnd.github+json",
          "x-github-api-version": GITHUB_API_VERSION,
          "user-agent": "ASTRA-AI-Agent",
          ...(config.token
            ? { authorization: "Bearer " + config.token }
            : {}),
        },
      }),
    signal,
  );

  if (!response.ok) {
    throw new Error(
      "GitHub Actions workflow runs returned HTTP " +
        response.status +
        ".",
    );
  }

  const payload = await readBoundedProviderJson(
    response,
    "GitHub Actions workflow runs",
    1_500_000,
  );

  return {
    repository,
    authenticated: Boolean(config.token),
    runs: parseGitHubWorkflowRuns(payload, config.perPage),
  };
}

function severityForRun(run: GitHubWorkflowRunSnapshot) {
  const conclusion = run.conclusion?.toLowerCase() || "";
  if (
    conclusion === "failure" ||
    conclusion === "timed_out" ||
    conclusion === "action_required"
  ) {
    return "error" as const;
  }
  if (conclusion === "cancelled" || conclusion === "stale") {
    return "warning" as const;
  }
  return "info" as const;
}

export function githubWorkflowRunToEvent(
  repository: string,
  run: GitHubWorkflowRunSnapshot,
): AstraIncomingEvent {
  const state = run.conclusion || run.status;
  return {
    source: "github",
    topic: "actions.workflow_run",
    key:
      "workflow-run:" +
      run.id +
      ":attempt:" +
      run.runAttempt +
      ":" +
      run.status +
      ":" +
      (run.conclusion || "none"),
    title: run.name + " · " + state,
    detail:
      "GitHub Actions run #" +
      run.runNumber +
      " on " +
      (run.headBranch || "unknown branch") +
      " triggered by " +
      run.event +
      ".",
    severity: severityForRun(run),
    occurredAt: run.updatedAt,
    metadata: {
      repository,
      runId: String(run.id),
      runNumber: String(run.runNumber),
      runAttempt: String(run.runAttempt),
      status: run.status,
      conclusion: run.conclusion || "",
      event: run.event,
      branch: run.headBranch || "",
      headSha: run.headSha,
      url: run.htmlUrl,
    },
  };
}

function eventSignature(event: AstraIncomingEvent) {
  return [
    event.source,
    event.topic,
    event.key,
    event.occurredAt,
    event.projectId || "",
  ].join("\n");
}

export async function getGitHubActionsEventStatus({
  signal,
  fetchImpl,
}: {
  signal?: AbortSignal;
  fetchImpl?: FetchLike;
} = {}): Promise<GitHubActionsEventStatus> {
  const config = getGitHubActionsEventConfig();

  if (!config.enabled) {
    return {
      enabled: false,
      available: false,
      repository: config.repository || null,
      authenticated: Boolean(config.token),
      detail:
        "GitHub Actions event adapter is disabled by ASTRA_GITHUB_EVENTS_ENABLED.",
      runCount: 0,
    };
  }

  try {
    const result = await fetchWorkflowRuns({ signal, fetchImpl });
    return {
      enabled: true,
      available: true,
      repository: result.repository,
      authenticated: result.authenticated,
      detail:
        "GitHub Actions event source is reachable; " +
        result.runs.length +
        " workflow run(s) were read.",
      runCount: result.runs.length,
      ...(result.runs[0] ? { latestRun: result.runs[0] } : {}),
    };
  } catch (error) {
    return {
      enabled: true,
      available: false,
      repository: config.repository || null,
      authenticated: Boolean(config.token),
      detail:
        "GitHub Actions event source is unavailable: " +
        safeErrorDetail(error, "unavailable", 500),
      runCount: 0,
    };
  }
}

export async function syncGitHubActionsEvents({
  signal,
  fetchImpl,
  now = new Date(),
}: {
  signal?: AbortSignal;
  fetchImpl?: FetchLike;
  now?: Date;
} = {}) {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid GitHub Actions event sync time.");
  }

  const result = await fetchWorkflowRuns({ signal, fetchImpl });
  const loaded = await loadEventStore();
  if (!loaded.available) {
    throw new Error(loaded.detail);
  }

  const seen = new Set(
    loaded.store.events.map((event) =>
      [
        event.source,
        event.topic,
        event.key,
        event.occurredAt,
        event.projectId || "",
      ].join("\n"),
    ),
  );

  let skippedSeen = 0;
  let matchedSubscriptions = 0;
  let records = 0;
  let deliverable = 0;

  const runs = [...result.runs].sort(
    (left, right) =>
      Date.parse(left.updatedAt) - Date.parse(right.updatedAt),
  );

  for (const run of runs) {
    if (signal?.aborted) {
      throw signal.reason instanceof Error
        ? signal.reason
        : new DOMException("GitHub Actions sync aborted.", "AbortError");
    }

    const event = githubWorkflowRunToEvent(result.repository, run);
    const signature = eventSignature(event);
    if (seen.has(signature)) {
      skippedSeen += 1;
      continue;
    }

    const published = await publishIncomingEvent(event, now);
    matchedSubscriptions += published.matchedSubscriptions;
    records += published.records.length;
    deliverable += published.deliverable.length;

    if (published.records.length > 0) {
      seen.add(signature);
    }
  }

  return {
    repository: result.repository,
    authenticated: result.authenticated,
    fetchedRuns: runs.length,
    skippedSeen,
    matchedSubscriptions,
    records,
    deliverable,
  };
}
