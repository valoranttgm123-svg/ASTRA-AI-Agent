import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  REPOSITORY_GATE_STEPS,
  repositoryGateExecutable,
} from "../lib/release/repository-gate";

test("Phase 18A repository gate contains every required RC repository command", () => {
  assert.deepEqual(
    REPOSITORY_GATE_STEPS.map((step) => step.id),
    [
      "test",
      "typecheck",
      "lint",
      "build",
      "audit",
      "diff-check",
    ],
  );

  assert.deepEqual(
    REPOSITORY_GATE_STEPS.find(
      (step) => step.id === "audit",
    )?.args,
    ["audit", "--audit-level=high"],
  );

  assert.deepEqual(
    REPOSITORY_GATE_STEPS.find(
      (step) => step.id === "diff-check",
    )?.args,
    ["diff", "--check"],
  );
});

test("Phase 18A repository gate uses platform-safe npm executable and no destructive Git command", () => {
  assert.equal(
    repositoryGateExecutable("npm", "win32"),
    "npm.cmd",
  );
  assert.equal(
    repositoryGateExecutable("npm", "linux"),
    "npm",
  );
  assert.equal(
    repositoryGateExecutable("git", "win32"),
    "git",
  );

  const serialized = JSON.stringify(
    REPOSITORY_GATE_STEPS,
  );
  assert.doesNotMatch(
    serialized,
    /reset|clean|checkout|rebase|push|merge|commit/i,
  );
});

test("Phase 18A GitHub CI enforces full history and PR/push diff checks", () => {
  const workflow = readFileSync(
    path.resolve(".github", "workflows", "ci.yml"),
    "utf8",
  );

  assert.match(workflow, /fetch-depth:\s*0/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm run lint/);
  assert.match(
    workflow,
    /npm audit --audit-level=high/,
  );
  assert.match(
    workflow,
    /git diff --check/,
  );
  assert.match(
    workflow,
    /github\.event\.pull_request\.base\.sha/,
  );
  assert.match(
    workflow,
    /github\.event\.before/,
  );
});
