import assert from "node:assert/strict";
import { test } from "node:test";

import { extractValidationEvidence } from "../lib/validation/evidence";

test("Phase 17A validation evidence keeps routing project memory and plan metadata", () => {
  const evidence = extractValidationEvidence(
    {
      ok: true,
      agent: "chief_of_staff",
      state: "blocked",
      message: "PRIVATE RESPONSE TEXT",
      requiresApproval: true,
      approvalRequest: {
        token: "super-secret-approval-token",
        level: 3,
        planId: "plan-1",
        stepId: "step-2",
        toolId: "github.pull-request.open",
        projectId: "astra",
        scope: {
          repository: "private/repo",
        },
        expiresAt: "2026-09-21T00:00:00.000Z",
      },
      brain: {
        provider: "codex",
        execution: "blocked",
        requestedMode: "chat",
        route: ["chief_of_staff", "developer"],
        visualNodes: ["chief_of_staff", "developer"],
        events: [
          {
            type: "project.selected",
            detail: "sensitive detail",
          },
          {
            type: "approval.requested",
            detail: "token=do-not-copy",
          },
        ],
        context: {
          memoryEntries: 3,
          memorySources: ["local", "project"],
          skills: ["engineering"],
          project: {
            id: "astra",
            name: "ASTRA",
            reason: "recent",
          },
        },
        permissions: {
          requireApproval: true,
          allowShell: false,
          allowFileWrite: false,
          allowExternalActions: false,
          allowPaidCloud: false,
        },
        plan: {
          id: "plan-1",
          status: "planned",
          projectId: "astra",
          goal: "private goal text",
          steps: [
            {
              id: "step-1",
              title: "private title",
              kind: "inspect",
              permissionLevel: 1,
              status: "completed",
              toolInput: {
                secret: "do-not-copy",
              },
            },
            {
              id: "step-2",
              title: "private title 2",
              kind: "tool",
              permissionLevel: 3,
              status: "waiting_approval",
              toolId: "github.pull-request.open",
              toolInput: {
                body: "private",
              },
            },
          ],
        },
      },
    },
    ["request.received", "approval.requested"],
  );

  assert.equal(evidence.provider, "codex");
  assert.equal(evidence.execution, "blocked");
  assert.deepEqual(evidence.route, [
    "chief_of_staff",
    "developer",
  ]);
  assert.deepEqual(evidence.project, {
    id: "astra",
    name: "ASTRA",
    reason: "recent",
  });
  assert.equal(evidence.memoryEntries, 3);
  assert.equal(evidence.plan?.stepCount, 2);
  assert.equal(evidence.plan?.maxPermissionLevel, 3);
  assert.deepEqual(evidence.plan?.toolIds, [
    "github.pull-request.open",
  ]);
  assert.equal(evidence.plan?.waitingApprovalSteps, 1);
  assert.equal(evidence.approval?.level, 3);
  assert.equal(evidence.approval?.toolId, "github.pull-request.open");
});

test("Phase 17A validation evidence never persists response text approval token scope titles inputs or event detail", () => {
  const evidence = extractValidationEvidence({
    message: "PRIVATE RESPONSE TEXT",
    approvalRequest: {
      token: "super-secret-approval-token",
      scope: {
        secret: "private-scope",
      },
      level: 3,
    },
    brain: {
      events: [
        {
          type: "response.ready",
          detail: "private-event-detail",
        },
      ],
      plan: {
        goal: "private-goal",
        steps: [
          {
            title: "private-step-title",
            kind: "tool",
            permissionLevel: 3,
            toolId: "email.send",
            toolInput: {
              body: "private-email-body",
            },
          },
        ],
      },
    },
  });

  const serialized = JSON.stringify(evidence);
  for (const forbidden of [
    "PRIVATE RESPONSE TEXT",
    "super-secret-approval-token",
    "private-scope",
    "private-event-detail",
    "private-goal",
    "private-step-title",
    "private-email-body",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }

  assert.equal(serialized.includes("email.send"), true);
});
