import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import {
  getGitHubActionsEventConfig,
  getGitHubActionsEventStatus,
  githubWorkflowRunToEvent,
  parseGitHubWorkflowRuns,
  syncGitHubActionsEvents,
} from "../lib/events/github-actions";
import {
  acknowledgeEvent,
  upsertEventSubscription,
} from "../lib/events/management";
import { loadEventStore } from "../lib/events/store";

const ENV_KEYS = [
  "ASTRA_GITHUB_EVENTS_ENABLED",
  "ASTRA_GITHUB_EVENTS_REPOSITORY",
  "ASTRA_GITHUB_EVENTS_TIMEOUT_MS",
  "ASTRA_GITHUB_EVENTS_PER_PAGE",
  "GITHUB_TOKEN",
  "ASTRA_EVENT_FILE",
] as const;

const ORIGINAL = new Map(
  ENV_KEYS.map((key) => [key, process.env[key]] as const),
);

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function payload() {
  return {
    total_count: 1,
    workflow_runs: [
      {
        id: 42,
        name: "ASTRA CI",
        run_number: 486,
        run_attempt: 1,
        status: "completed",
        conclusion: "failure",
        event: "push",
        head_branch: "main",
        head_sha: "a".repeat(40),
        created_at: "2026-09-22T10:00:00Z",
        updated_at: "2026-09-22T10:05:00Z",
        html_url:
          "https://github.com/valoranttgm123-svg/ASTRA-AI-Agent/actions/runs/42",
      },
    ],
  };
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

test("GitHub Actions event adapter is opt-in and never requires a token for config", () => {
  delete process.env.ASTRA_GITHUB_EVENTS_ENABLED;
  delete process.env.GITHUB_TOKEN;
  process.env.ASTRA_GITHUB_EVENTS_REPOSITORY =
    "valoranttgm123-svg/ASTRA-AI-Agent";

  const config = getGitHubActionsEventConfig();
  assert.equal(config.enabled, false);
  assert.equal(config.token, "");
  assert.equal(config.perPage, 20);
});

test("GitHub workflow parser rejects malformed payloads and non-GitHub URLs", () => {
  assert.throws(
    () => parseGitHubWorkflowRuns({ workflow_runs: "bad" }),
    /malformed/i,
  );

  const bad = payload();
  bad.workflow_runs[0].html_url = "https://example.com/run/42";
  assert.throws(
    () => parseGitHubWorkflowRuns(bad),
    /github\.com HTTPS/i,
  );
});

test("GitHub workflow run maps to a source-linked Event Engine event", () => {
  const run = parseGitHubWorkflowRuns(payload())[0];
  const event = githubWorkflowRunToEvent(
    "valoranttgm123-svg/ASTRA-AI-Agent",
    run,
  );

  assert.equal(event.source, "github");
  assert.equal(event.topic, "actions.workflow_run");
  assert.equal(event.severity, "error");
  assert.match(event.key, /workflow-run:42/);
  assert.equal(
    event.metadata?.repository,
    "valoranttgm123-svg/ASTRA-AI-Agent",
  );
  assert.equal(event.metadata?.status, "completed");
  assert.equal(event.metadata?.conclusion, "failure");
});

test("GitHub adapter uses exact read-only Actions endpoint and current API version", async () => {
  process.env.ASTRA_GITHUB_EVENTS_ENABLED = "true";
  process.env.ASTRA_GITHUB_EVENTS_REPOSITORY =
    "valoranttgm123-svg/ASTRA-AI-Agent";
  process.env.GITHUB_TOKEN = "github_pat_test_secret";

  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const status = await getGitHubActionsEventStatus({
    fetchImpl: async (input, init) => {
      requestedUrl = String(input);
      requestedInit = init;
      return jsonResponse(payload());
    },
  });

  assert.equal(status.available, true);
  assert.equal(status.authenticated, true);
  assert.equal(
    requestedUrl,
    "https://api.github.com/repos/valoranttgm123-svg/ASTRA-AI-Agent/actions/runs?per_page=20",
  );
  assert.equal(requestedInit?.method, "GET");
  const headers = requestedInit?.headers as Record<string, string>;
  assert.equal(headers["x-github-api-version"], "2026-03-10");
  assert.equal(headers.authorization, "Bearer github_pat_test_secret");
});

test("public GitHub adapter omits Authorization header", async () => {
  process.env.ASTRA_GITHUB_EVENTS_ENABLED = "true";
  process.env.ASTRA_GITHUB_EVENTS_REPOSITORY = "owner/public-repo";
  delete process.env.GITHUB_TOKEN;

  await getGitHubActionsEventStatus({
    fetchImpl: async (_input, init) => {
      const headers = init?.headers as Record<string, string>;
      assert.equal("authorization" in headers, false);
      return jsonResponse(payload());
    },
  });
});

test("GitHub sync feeds Event Engine once and preserves acknowledgement on repeated poll", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-github-events-"));
  process.env.ASTRA_EVENT_FILE = path.join(root, "events.json");
  process.env.ASTRA_GITHUB_EVENTS_ENABLED = "true";
  process.env.ASTRA_GITHUB_EVENTS_REPOSITORY =
    "valoranttgm123-svg/ASTRA-AI-Agent";

  await upsertEventSubscription(
    {
      id: "github-actions",
      source: "github",
      topic: "actions.workflow_run",
      status: "enabled",
      severityFloor: "info",
      deliveryPolicy: "notify",
      debounceMs: 0,
      dedupeWindowMs: 60_000,
      rateLimitPerHour: 20,
    },
    new Date("2026-09-22T09:00:00Z"),
  );

  const fetchImpl = async () => jsonResponse(payload());
  const first = await syncGitHubActionsEvents({
    fetchImpl,
    now: new Date("2026-09-22T10:06:00Z"),
  });

  assert.equal(first.fetchedRuns, 1);
  assert.equal(first.skippedSeen, 0);
  assert.equal(first.records, 1);
  assert.equal(first.deliverable, 1);

  let loaded = await loadEventStore();
  assert.equal(loaded.store.events.length, 1);
  const eventId = loaded.store.events[0].id;

  await acknowledgeEvent(
    eventId,
    new Date("2026-09-22T10:07:00Z"),
  );

  const second = await syncGitHubActionsEvents({
    fetchImpl,
    now: new Date("2026-09-22T10:08:00Z"),
  });
  assert.equal(second.skippedSeen, 1);
  assert.equal(second.records, 0);

  loaded = await loadEventStore();
  assert.equal(loaded.store.events.length, 1);
  assert.equal(
    loaded.store.events[0].acknowledgedAt,
    "2026-09-22T10:07:00.000Z",
  );
});

test("GitHub status fails safely without leaking token details", async () => {
  process.env.ASTRA_GITHUB_EVENTS_ENABLED = "true";
  process.env.ASTRA_GITHUB_EVENTS_REPOSITORY = "owner/repo";
  process.env.GITHUB_TOKEN = "github_pat_should_not_leak";

  const status = await getGitHubActionsEventStatus({
    fetchImpl: async () => {
      throw new Error(
        "Authorization: Bearer github_pat_should_not_leak failed",
      );
    },
  });

  assert.equal(status.available, false);
  assert.doesNotMatch(status.detail, /github_pat_should_not_leak/);
  assert.match(status.detail, /redacted/i);
});


test("same workflow state is skipped even when GitHub updated_at changes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-github-state-"));
  process.env.ASTRA_EVENT_FILE = path.join(root, "events.json");
  process.env.ASTRA_GITHUB_EVENTS_ENABLED = "true";
  process.env.ASTRA_GITHUB_EVENTS_REPOSITORY = "owner/repo";

  await upsertEventSubscription(
    {
      id: "github-actions-state",
      source: "github",
      topic: "actions.workflow_run",
      status: "enabled",
      severityFloor: "info",
      deliveryPolicy: "notify",
      debounceMs: 0,
      dedupeWindowMs: 60_000,
      rateLimitPerHour: 20,
    },
    new Date("2026-09-22T09:00:00Z"),
  );

  await syncGitHubActionsEvents({
    fetchImpl: async () => jsonResponse(payload()),
    now: new Date("2026-09-22T10:06:00Z"),
  });

  const changedTimestamp = payload();
  changedTimestamp.workflow_runs[0].updated_at =
    "2026-09-22T10:06:30Z";

  const second = await syncGitHubActionsEvents({
    fetchImpl: async () => jsonResponse(changedTimestamp),
    now: new Date("2026-09-22T10:07:00Z"),
  });

  assert.equal(second.skippedSeen, 1);
  assert.equal(second.records, 0);
  const loaded = await loadEventStore();
  assert.equal(loaded.store.events.length, 1);
});
