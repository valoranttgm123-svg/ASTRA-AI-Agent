import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  isManualObservationGateId,
  REQUIRED_MANUAL_OBSERVATION_CHECKS,
  type ManualObservationCheckStatus,
  type ManualObservationGateId,
  validateManualGateObservation,
} from "../../lib/release/manual-observation";
import {
  prepareValidationEvidencePath,
  validationEvidenceRoot,
} from "../../lib/validation/private-output";
import {
  assertSameCleanRepositorySnapshot,
  cleanRepositorySnapshot,
} from "../../lib/release/repository-state";
import { safeErrorDetail } from "../../lib/security/redaction";

type Options = {
  gate: ManualObservationGateId;
  checks: Map<string, ManualObservationCheckStatus>;
  output?: string;
};

function parseCheck(
  raw: string,
) {
  const separator = raw.lastIndexOf("=");
  if (separator <= 0) {
    throw new Error(
      "--check must use <check-id>=<PASS|FAIL>.",
    );
  }

  const id = raw.slice(0, separator).trim();
  const status = raw
    .slice(separator + 1)
    .trim()
    .toUpperCase();

  if (
    !id ||
    (status !== "PASS" && status !== "FAIL")
  ) {
    throw new Error(
      "--check must use <check-id>=<PASS|FAIL>.",
    );
  }

  return {
    id,
    status:
      status as ManualObservationCheckStatus,
  };
}

function parseArgs(
  argv: readonly string[],
): Options {
  let gate = "";
  let output: string | undefined;
  const checks = new Map<
    string,
    ManualObservationCheckStatus
  >();

  for (
    let index = 0;
    index < argv.length;
    index += 1
  ) {
    const arg = argv[index];

    if (arg === "--help") {
      console.log([
        "ASTRA manual gate observation recorder",
        "",
        "Usage:",
        "  npm run release:record-observation -- --gate <id> --check <check-id>=<PASS|FAIL> [--check ...] [--output <path>]",
        "",
        "This records operator-observed results only.",
        "It never marks a manual gate PASS and never selects release readiness.",
      ].join("\n"));
      process.exit(0);
    }

    const value = argv[++index];
    if (!value) {
      throw new Error(
        `Missing value for ${arg}.`,
      );
    }

    if (arg === "--gate") {
      gate = value;
    } else if (arg === "--check") {
      const parsed = parseCheck(value);
      if (checks.has(parsed.id)) {
        throw new Error(
          `Duplicate --check id: ${parsed.id}`,
        );
      }
      checks.set(
        parsed.id,
        parsed.status,
      );
    } else if (arg === "--output") {
      output = value;
    } else {
      throw new Error(
        `Unknown argument: ${arg}`,
      );
    }
  }

  if (
    !gate ||
    !isManualObservationGateId(gate)
  ) {
    throw new Error(
      "--gate must be one of the five structured manual observation gates.",
    );
  }

  const required =
    REQUIRED_MANUAL_OBSERVATION_CHECKS[gate];

  if (
    checks.size !== required.length ||
    !required.every((id) => checks.has(id))
  ) {
    throw new Error(
      [
        `Gate ${gate} requires exactly these checks:`,
        ...required.map(
          (id) => `  --check ${id}=PASS|FAIL`,
        ),
      ].join("\n"),
    );
  }

  return {
    gate,
    checks,
    output,
  };
}

async function main() {
  const options = parseArgs(
    process.argv.slice(2),
  );
  const repository = cleanRepositorySnapshot();
  const observedAt = new Date().toISOString();
  const timestamp = observedAt
    .replace(/[:.]/g, "-");

  const outputPath =
    prepareValidationEvidencePath(
      options.output ??
        path.join(
          validationEvidenceRoot(),
          `manual-${options.gate}-${timestamp}.json`,
        ),
    );

  const document = {
    schemaVersion: 1 as const,
    kind:
      "astra-manual-gate-observation" as const,
    gate: options.gate,
    observedAt,
    commit: repository.commit,
    workingTreeClean: true as const,
    releaseVerdict:
      "NOT_EVALUATED" as const,
    checks:
      REQUIRED_MANUAL_OBSERVATION_CHECKS[
        options.gate
      ].map((id) => ({
        id,
        status:
          options.checks.get(id) ??
          "FAIL",
      })),
  };

  validateManualGateObservation(
    document,
    options.gate,
    repository.commit,
    {
      requireAllPass: false,
    },
  );

  assertSameCleanRepositorySnapshot(
    repository,
  );

  await writeFile(
    outputPath,
    JSON.stringify(
      document,
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        gate: options.gate,
        observedAt,
        outputPath,
        allChecksPass:
          document.checks.every(
            (check) =>
              check.status === "PASS",
          ),
        finalReleaseStatus:
          "NOT_EVALUATED",
        note:
          "Observation recorded only. Run release:record-gate separately after review.",
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(
    safeErrorDetail(
      error,
      "ASTRA manual observation recording failed.",
      1000,
    ),
  );
  process.exitCode = 1;
});
