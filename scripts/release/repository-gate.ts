import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import {
  REPOSITORY_GATE_STEPS,
  repositoryGateExecutable,
} from "../../lib/release/repository-gate";
import {
  prepareReleaseEvidencePath,
} from "../../lib/release/private-output";

function workingTreeStatus() {
  return execFileSync(
    "git",
    [
      "status",
      "--porcelain",
      "--untracked-files=normal",
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  ).trim();
}

function assertCleanWorkingTree(stage: string) {
  if (workingTreeStatus()) {
    throw new Error(
      `Repository gate requires a clean Git working tree ${stage}. Commit, stash, or remove untracked repository files before collecting release evidence.`,
    );
  }
}

function main() {
  assertCleanWorkingTree("before validation");

  for (const step of REPOSITORY_GATE_STEPS) {
    const executable = repositoryGateExecutable(
      step.executable,
    );

    console.log(
      "\n[ASTRA RC] " +
        step.label +
        " (" +
        step.id +
        ")",
    );

    const result = spawnSync(
      executable,
      [...step.args],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: "inherit",
        windowsHide: true,
        shell: false,
      },
    );

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      throw new Error(
        `Repository gate failed at ${step.id} with exit code ${result.status ?? "unknown"}.`,
      );
    }
  }

  assertCleanWorkingTree("after validation");

  const outputPath =
    prepareReleaseEvidencePath(
      undefined,
      "repository-gate",
      "json",
    );

  let commit = "unknown";
  try {
    commit = execFileSync(
      "git",
      ["rev-parse", "HEAD"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
  } catch {
    commit = "unknown";
  }

  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        capturedAt: new Date().toISOString(),
        commit,
        passed: true,
        workingTreeClean: true,
        steps: REPOSITORY_GATE_STEPS.map(
          (step) => step.id,
        ),
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(
    "\nASTRA repository RC gate: PASS. Program/local release gates are evaluated separately.",
  );
  console.log("Evidence: " + outputPath);
}

try {
  main();
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "ASTRA repository RC gate failed.",
  );
  process.exitCode = 1;
}
