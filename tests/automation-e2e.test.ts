import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import type { AstraBrain } from "../lib/brain/types";
import type { AstraAutomationDefinition } from "../lib/automation/contracts";
import { createReadOnlyAutomationExecutor } from "../lib/automation/read-only";
import { runAutomationTickFromStore } from "../lib/automation/runner";
import { AstraAutomationService } from "../lib/automation/service";
import {
  loadAutomationStore,
  saveAutomationStore,
} from "../lib/automation/store";

function definition(
  id: string,
  level: 1 | 2,
): AstraAutomationDefinition {
  return {
    id,
    title: id,
    goal: "Inspect the registered ASTRA project and summarize status.",
    projectId: "astra",
    createdAt: "2026-09-20T08:00:00.000Z",
    updatedAt: "2026-09-20T08:00:00.000Z",
    status: "enabled",
    schedule: {
      kind: "once",
      runAt: "2026-09-20T10:00:00.000Z",
    },
    requiredPermissionLevel: level,
    maxRuntimeMs: 60_000,
  };
}

async function withStore(run: () => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-auto-e2e-"));
  const previousFile = process.env.ASTRA_AUTOMATION_FILE;
  const previousEnabled = process.env.ASTRA_AUTOMATION_ENABLED;

  process.env.ASTRA_AUTOMATION_FILE = path.join(
    root,
    ".astra",
    "automations.json",
  );
  process.env.ASTRA_AUTOMATION_ENABLED = "true";

  try {
    await run();
  } finally {
    if (previousFile === undefined) delete process.env.ASTRA_AUTOMATION_FILE;
    else process.env.ASTRA_AUTOMATION_FILE = previousFile;

    if (previousEnabled === undefined) {
      delete process.env.ASTRA_AUTOMATION_ENABLED;
    } else {
      process.env.ASTRA_AUTOMATION_ENABLED = previousEnabled;
    }

    await rm(root, { recursive: true, force: true });
  }
}

test("Phase 14E3 end-to-end service executes Level 1 once and keeps Level 2 approval-gated", async () => {
  await withStore(async () => {
    await saveAutomationStore([
      definition("read-status", 1),
      definition("safe-local-write", 2),
    ]);

    const brainCalls: Array<{
      input: string;
      approved: boolean | undefined;
      provider: string | undefined;
      requirePlan: boolean | undefined;
      ceiling: number | undefined;
    }> = [];

    const brain: Pick<AstraBrain, "execute"> = {
      async execute(task, options) {
        brainCalls.push({
          input: task.input,
          approved: task.approved,
          provider: options?.provider,
          requirePlan: options?.requirePlan,
          ceiling: options?.permissionCeiling,
        });

        return {
          ok: true,
          agent: "chief_of_staff",
          agentName: "Chief of Staff",
          state: "completed",
          message: "ASTRA project status inspected.",
          requiresApproval: false,
          brain: {
            provider: "ollama",
            execution: "executed",
            requestedMode: "execute",
            route: ["chief_of_staff"],
            visualNodes: ["chief_of_staff"],
            events: [],
            plan: {
              id: "e2e-read-plan",
              goal: task.input,
              projectId: "astra",
              createdAt: "2026-09-20T10:30:00.000Z",
              status: "completed",
              steps: [
                {
                  id: "inspect",
                  title: "Inspect project status",
                  kind: "inspect",
                  agent: "chief_of_staff",
                  permissionLevel: 1,
                  dependsOn: [],
                  timeoutMs: 10_000,
                  maxRetries: 0,
                  status: "completed",
                },
              ],
            },
          },
        };
      },
    };

    const execute = createReadOnlyAutomationExecutor(brain);
    let tickNumber = 0;
    const service = new AstraAutomationService({
      enabled: true,
      pollIntervalMs: 60_000,
      tick: ({ signal, onEvent }) => {
        tickNumber += 1;
        return runAutomationTickFromStore({
          execute,
          signal,
          onEvent,
          now: new Date(
            tickNumber === 1
              ? "2026-09-20T10:30:00.000Z"
              : "2026-09-20T10:31:00.000Z",
          ),
        });
      },
    });

    const first = await service.tickNow();
    assert.ok(first);
    assert.equal(first?.runs.length, 1);
    assert.equal(first?.runs[0].automationId, "read-status");
    assert.equal(first?.runs[0].status, "completed");
    assert.deepEqual(
      first?.waitingApproval.map((item) => item.automationId),
      ["safe-local-write"],
    );

    assert.equal(brainCalls.length, 1);
    assert.equal(brainCalls[0].approved, false);
    assert.equal(brainCalls[0].provider, "ollama");
    assert.equal(brainCalls[0].requirePlan, true);
    assert.equal(brainCalls[0].ceiling, 1);
    assert.match(brainCalls[0].input, /automation id: read-status/i);

    const storedAfterFirst = await loadAutomationStore();
    const read = storedAfterFirst.automations.find(
      (automation) => automation.id === "read-status",
    );
    const write = storedAfterFirst.automations.find(
      (automation) => automation.id === "safe-local-write",
    );
    assert.equal(read?.lastRunAt, "2026-09-20T10:00:00.000Z");
    assert.equal(write?.lastRunAt, undefined);

    const eventTypes = service
      .getStatus()
      .recentEvents.map((event) => event.type);
    assert.ok(eventTypes.includes("automation.waiting_approval"));
    assert.ok(eventTypes.includes("automation.completed"));

    const second = await service.tickNow();
    assert.ok(second);
    assert.equal(second?.runs.length, 0);
    assert.deepEqual(
      second?.waitingApproval.map((item) => item.automationId),
      ["safe-local-write"],
    );
    assert.equal(brainCalls.length, 1);
  });
});


test("Automation STOP suppresses late success from an executor that ignores AbortSignal", async () => {
  await withStore(async () => {
    await saveAutomationStore([
      definition("late-success", 1),
    ]);

    let releaseExecutor:
      | ((outcome: {
          status: "completed";
          detail: string;
        }) => void)
      | undefined;
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });

    const events: string[] = [];
    const controller = new AbortController();

    const tick = runAutomationTickFromStore({
      now: new Date(
        "2026-09-20T10:30:00.000Z",
      ),
      signal: controller.signal,
      onEvent: (event) => {
        events.push(event.type);
      },
      execute: async () =>
        new Promise((resolve) => {
          releaseExecutor = resolve;
          markStarted?.();
        }),
    });

    await started;
    controller.abort(
      new DOMException(
        "Emergency STOP",
        "AbortError",
      ),
    );

    releaseExecutor?.({
      status: "completed",
      detail:
        "Executor ignored cancellation and returned late success.",
    });

    const result = await tick;

    assert.equal(result.stopped, true);
    assert.equal(result.runs.length, 1);
    assert.equal(
      result.runs[0].status,
      "cancelled",
    );
    assert.ok(
      events.includes("automation.cancelled"),
    );
    assert.equal(
      events.includes("automation.completed"),
      false,
    );
  });
});
