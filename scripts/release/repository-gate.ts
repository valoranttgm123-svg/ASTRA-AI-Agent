import { spawnSync } from "node:child_process";

import {
  REPOSITORY_GATE_STEPS,
  repositoryGateExecutable,
} from "../../lib/release/repository-gate";

function main() {
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

  console.log(
    "\nASTRA repository RC gate: PASS. Program/local release gates are evaluated separately.",
  );
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
