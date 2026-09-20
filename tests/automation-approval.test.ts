import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import type { AstraApprovalRequest } from "../lib/agent/types";
import type { AstraBrain, AstraBrainChatResult } from "../lib/brain/types";
import {
  automationOccurrenceBrainInput,
  executeApprovedAutomationOccurrence,
} from "../lib/automation/approval";
import type { AstraAutomationDefinition } from "../lib/automation/contracts";
import { parseAutomationRunRequest } from "../lib/automation/http";
import {
  loadAutomationStore,
  saveAutomationStore,
} from "../lib/automation/store";
import { shouldGeneratePlan } from "../lib/planner/generator";

async function withStore(run: () => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-approval-"));
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

function automation(
  id: string,
  level: 2 | 3,
): AstraAutomationDefinition {
  return {
    id,
    title: id,
    goal: "Update the registered ASTRA project safely.",
    projectId: "astra",
    createdAt: "2026-09-20T08:00:00.000Z",
    updatedAt: "2026-09-20T08:00:00.000Z",
    status: "enabled",
    schedule: {
      kind: "interval",
      anchorAt: "2026-09-20T09:00:00.000Z",
      everyMinutes: 60,
    },
    requiredPermissionLevel: level,
    maxRuntimeMs: 60_000,
  };
}

function brainResult(
  permissionLevel: 1 | 2 | 3,
  options: {
    ok?: boolean;
    state?: "completed" | "blocked" | "error";
    requiresApproval?: boolean;
    approvalRequest?: AstraApprovalRequest;
  } = {},
): AstraBrainChatResult {
  return {
    ok: options.ok ?? true,
    agent: "chief_of_staff",
    agentName: "Chief of Staff",
    state: options.state ?? "completed",
    message: options.requiresApproval ? "Approval required." : "Done.",
    requiresApproval: options.requiresApproval ?? false,
    approvalRequest: options.approvalRequest,
    brain: {
      provider: "routing_only",
      execution:
        options.ok === false || options.state === "blocked"
          ? "blocked"
          : "executed",
      requestedMode: "execute",
      route: ["chief_of_staff"],
      visualNodes: ["chief_of_staff"],
      events: [],
      plan: {
        id: "fixture-plan",
        goal: "fixture",
        createdAt: "2026-09-20T10:00:00.000Z",
        status: options.ok === false ? "planned" : "completed",
        steps: [
          {
            id: "fixture-step",
            title: "Fixture step",
            kind: "tool",
            permissionLevel,
            dependsOn: [],
            timeoutMs: 60_000,
            maxRetries: 0,
            status: options.ok === false ? "pending" : "completed",
            ...(permissionLevel === 3 ? { toolId: "email.send" } : {}),
          },
        ],
      },
    },
  };
}

test("Phase 14D2 canonical occurrence input always requests bounded planning", () => {
  const definition = automation("plan-bound", 2);
  const input = automationOccurrenceBrainInput(
    definition,
    "2026-09-20T10:00:00.000Z",
  );

  assert.match(input, /automation id: plan-bound/i);
  assert.match(input, /scheduled for: 2026-09-20T10:00:00.000Z/i);
  assert.match(input, /permission ceiling: Level-2/i);
  assert.equal(shouldGeneratePlan(input), true);
});

test("Phase 14D2 parser bounds occurrence approval requests", () => {
  const parsed = parseAutomationRunRequest({
    automationId: "safe-local",
    scheduledFor: "2026-09-20T10:00:00.000Z",
    approved: true,
    provider: "auto",
  });

  assert.equal(parsed.automationId, "safe-local");
  assert.equal(parsed.approved, true);
  assert.equal(parsed.provider, "auto");

  assert.throws(
    () =>
      parseAutomationRunRequest({
        automationId: "bad-token",
        scheduledFor: "2026-09-20T10:00:00.000Z",
        approvalToken: "short",
      }),
    /approvalToken/i,
  );
});

test("Phase 14D2 Level 2 occurrence cannot run without explicit per-run approval", async () => {
  await withStore(async () => {
    await saveAutomationStore([automation("level2", 2)]);
    let calls = 0;

    const brain: Pick<AstraBrain, "execute"> = {
      async execute() {
        calls += 1;
        return brainResult(2);
      },
    };

    const result = await executeApprovedAutomationOccurrence({
      request: {
        automationId: "level2",
        scheduledFor: "2026-09-20T10:00:00.000Z",
      },
      brain,
      now: new Date("2026-09-20T10:30:00.000Z"),
    });

    assert.equal(result.status, "waiting_occurrence_approval");
    assert.equal(calls, 0);

    const store = await loadAutomationStore();
    assert.equal(store.automations[0].lastRunAt, undefined);
  });
});

test("Phase 14D2 approved Level 2 occurrence is claimed and requires a plan", async () => {
  await withStore(async () => {
    await saveAutomationStore([automation("level2-run", 2)]);
    const calls: Array<{
      input: string;
      requirePlan: boolean | undefined;
      approved: boolean | undefined;
    }> = [];

    const brain: Pick<AstraBrain, "execute"> = {
      async execute(task, options) {
        calls.push({
          input: task.input,
          requirePlan: options?.requirePlan,
          approved: task.approved,
        });
        return brainResult(2);
      },
    };

    const result = await executeApprovedAutomationOccurrence({
      request: {
        automationId: "level2-run",
        scheduledFor: "2026-09-20T10:00:00.000Z",
        approved: true,
      },
      brain,
      now: new Date("2026-09-20T10:30:00.000Z"),
    });

    assert.equal(result.status, "completed");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].requirePlan, true);
    assert.equal(calls[0].approved, true);
    assert.match(calls[0].input, /level2-run/i);

    const store = await loadAutomationStore();
    assert.equal(
      store.automations[0].lastRunAt,
      "2026-09-20T10:00:00.000Z",
    );
  });
});

test("Phase 14D2 plan cannot escalate above automation permission ceiling", async () => {
  await withStore(async () => {
    await saveAutomationStore([automation("ceiling", 2)]);

    const approvalRequest: AstraApprovalRequest = {
      token: "fixture-level3-token",
      level: 3,
      planId: "fixture-plan",
      stepId: "fixture-step",
      title: "Send email",
      toolId: "email.send",
      projectId: "astra",
      scope: {},
      expiresAt: "2026-09-20T10:40:00.000Z",
    };

    const brain: Pick<AstraBrain, "execute"> = {
      async execute() {
        return brainResult(3, {
          ok: false,
          state: "blocked",
          requiresApproval: true,
          approvalRequest,
        });
      },
    };

    const result = await executeApprovedAutomationOccurrence({
      request: {
        automationId: "ceiling",
        scheduledFor: "2026-09-20T10:00:00.000Z",
        approved: true,
      },
      brain,
      now: new Date("2026-09-20T10:30:00.000Z"),
    });

    assert.equal(result.status, "blocked");
    assert.match(result.detail, /above.*Level-2 ceiling/i);
    assert.equal(result.brain?.approvalRequest, undefined);
    assert.equal(result.brain?.requiresApproval, false);
  });
});

test("Phase 14D2 Level 3 resumes with the existing token and identical occurrence input", async () => {
  await withStore(async () => {
    await saveAutomationStore([automation("level3", 3)]);

    const approvalRequest: AstraApprovalRequest = {
      token: "fixture-level3-token",
      level: 3,
      planId: "fixture-plan",
      stepId: "fixture-step",
      title: "Send email",
      toolId: "email.send",
      projectId: "astra",
      scope: { title: "fixture" },
      expiresAt: "2026-09-20T10:40:00.000Z",
    };

    const inputs: string[] = [];
    const tokens: Array<string | undefined> = [];
    const brain: Pick<AstraBrain, "execute"> = {
      async execute(task) {
        inputs.push(task.input);
        tokens.push(task.approvalToken);
        if (!task.approvalToken) {
          return brainResult(3, {
            ok: false,
            state: "blocked",
            requiresApproval: true,
            approvalRequest,
          });
        }
        return brainResult(3);
      },
    };

    const first = await executeApprovedAutomationOccurrence({
      request: {
        automationId: "level3",
        scheduledFor: "2026-09-20T10:00:00.000Z",
        approved: true,
      },
      brain,
      now: new Date("2026-09-20T10:30:00.000Z"),
    });

    assert.equal(first.status, "waiting_level3_approval");
    assert.equal(first.brain?.approvalRequest?.token, "fixture-level3-token");

    const second = await executeApprovedAutomationOccurrence({
      request: {
        automationId: "level3",
        scheduledFor: "2026-09-20T10:00:00.000Z",
        approvalToken: "fixture-level3-token",
      },
      brain,
      now: new Date("2026-09-20T10:31:00.000Z"),
    });

    assert.equal(second.status, "completed");
    assert.equal(inputs.length, 2);
    assert.equal(inputs[0], inputs[1]);
    assert.deepEqual(tokens, [undefined, "fixture-level3-token"]);
  });
});

test("Phase 14D2 token resume is rejected unless that occurrence was already claimed", async () => {
  await withStore(async () => {
    await saveAutomationStore([automation("unclaimed", 3)]);

    const brain: Pick<AstraBrain, "execute"> = {
      async execute() {
        return brainResult(3);
      },
    };

    await assert.rejects(
      () =>
        executeApprovedAutomationOccurrence({
          request: {
            automationId: "unclaimed",
            scheduledFor: "2026-09-20T10:00:00.000Z",
            approvalToken: "fixture-level3-token",
          },
          brain,
          now: new Date("2026-09-20T10:30:00.000Z"),
        }),
      /claimed state/i,
    );
  });
});
