import assert from "node:assert/strict";
import { test } from "node:test";

import type { AstraBrain } from "../lib/brain/types";
import { resolveExecutionPermission } from "../lib/brain/execution-permissions";
import type { AstraAutomationDefinition } from "../lib/automation/contracts";
import { executeReadOnlyAutomationWithBrain } from "../lib/automation/read-only";

function automation(
  level: 0 | 1 | 2,
): AstraAutomationDefinition {
  return {
    id: "readonly-" + level,
    title: "Read-only " + level,
    goal: "Inspect registered project status and summarize it.",
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

function completedResult(permissionLevel: 0 | 1 | 2) {
  return {
    ok: true,
    agent: "chief_of_staff" as const,
    agentName: "Chief of Staff",
    state: "completed" as const,
    message: "fixture complete",
    requiresApproval: false,
    brain: {
      provider: "ollama" as const,
      execution: "executed" as const,
      requestedMode: "execute" as const,
      route: ["chief_of_staff" as const],
      visualNodes: ["chief_of_staff"],
      events: [],
      plan: {
        id: "readonly-plan",
        goal: "fixture",
        projectId: "astra",
        createdAt: "2026-09-20T10:00:00.000Z",
        status: "completed" as const,
        steps: [
          {
            id: "inspect",
            title: "Inspect",
            kind: "inspect" as const,
            agent: "chief_of_staff" as const,
            permissionLevel,
            dependsOn: [],
            timeoutMs: 10_000,
            maxRetries: 0,
            status: "completed" as const,
          },
        ],
      },
    },
  };
}

test("Phase 14E1 permission resolver allows only planned hard-ceiling unattended reads", () => {
  const level1 = resolveExecutionPermission({
    requireApproval: true,
    approved: false,
    requirePlan: true,
    permissionCeiling: 1,
    hasApprovalToken: false,
  });
  assert.equal(level1.unattendedReadOnly, true);
  assert.equal(level1.approvedPermissionLevel, 1);

  const level0 = resolveExecutionPermission({
    requireApproval: false,
    approved: true,
    requirePlan: true,
    permissionCeiling: 0,
    hasApprovalToken: false,
  });
  assert.equal(level0.unattendedReadOnly, true);
  assert.equal(level0.approvedPermissionLevel, 0);

  const normal = resolveExecutionPermission({
    requireApproval: true,
    approved: false,
    requirePlan: false,
    hasApprovalToken: false,
  });
  assert.equal(normal.unattendedReadOnly, false);
  assert.equal(normal.approvedPermissionLevel, 1);

  const approved = resolveExecutionPermission({
    requireApproval: true,
    approved: true,
    requirePlan: false,
    hasApprovalToken: false,
  });
  assert.equal(approved.unattendedReadOnly, false);
  assert.equal(approved.approvedPermissionLevel, 2);

  const token = resolveExecutionPermission({
    requireApproval: true,
    approved: true,
    requirePlan: true,
    permissionCeiling: 1,
    hasApprovalToken: true,
  });
  assert.equal(token.unattendedReadOnly, false);
  assert.equal(token.approvedPermissionLevel, 1);
});

test("Phase 14E1 read-only executor passes a local bounded hard ceiling to Brain", async () => {
  const calls: Array<{
    approved: boolean | undefined;
    provider: string | undefined;
    requirePlan: boolean | undefined;
    ceiling: number | undefined;
    input: string;
  }> = [];

  const brain: Pick<AstraBrain, "execute"> = {
    async execute(task, options) {
      calls.push({
        approved: task.approved,
        provider: options?.provider,
        requirePlan: options?.requirePlan,
        ceiling: options?.permissionCeiling,
        input: task.input,
      });
      return completedResult(1);
    },
  };

  const result = await executeReadOnlyAutomationWithBrain(
    automation(1),
    {
      scheduledFor: "2026-09-20T10:00:00.000Z",
      signal: new AbortController().signal,
    },
    brain,
  );

  assert.equal(result.status, "completed");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].approved, false);
  assert.equal(calls[0].provider, "ollama");
  assert.equal(calls[0].requirePlan, true);
  assert.equal(calls[0].ceiling, 1);
  assert.match(calls[0].input, /automation id: readonly-1/i);
  assert.match(calls[0].input, /permission ceiling: Level-1/i);
});

test("Phase 14E1 read-only executor never accepts Level 2 definitions", async () => {
  let called = false;
  const brain: Pick<AstraBrain, "execute"> = {
    async execute() {
      called = true;
      return completedResult(1);
    },
  };

  const result = await executeReadOnlyAutomationWithBrain(
    automation(2),
    {
      scheduledFor: "2026-09-20T10:00:00.000Z",
      signal: new AbortController().signal,
    },
    brain,
  );

  assert.equal(result.status, "failed");
  assert.match(result.detail, /above Permission Level 1/i);
  assert.equal(called, false);
});

test("Phase 14E1 read-only executor rejects any returned plan above its ceiling", async () => {
  const brain: Pick<AstraBrain, "execute"> = {
    async execute() {
      return completedResult(2);
    },
  };

  const result = await executeReadOnlyAutomationWithBrain(
    automation(1),
    {
      scheduledFor: "2026-09-20T10:00:00.000Z",
      signal: new AbortController().signal,
    },
    brain,
  );

  assert.equal(result.status, "failed");
  assert.match(result.detail, /above the automation permission ceiling/i);
});
