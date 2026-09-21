import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  type ManualGateStatus,
  type ManualReleaseEvidence,
} from "../../lib/release/core-report";
import {
  isManualGateId,
  upsertManualGate,
} from "../../lib/release/manual-evidence";
import {
  assertPrivateAstraEvidencePath,
  releaseEvidenceRoot,
} from "../../lib/release/private-output";
import { safeErrorDetail } from "../../lib/security/redaction";

type Options = {
  gate: string;
  status: ManualGateStatus;
  evidence?: string;
  note?: string;
};

function parseArgs(
  argv: readonly string[],
): Options {
  let gate = "";
  let status: ManualGateStatus | "" = "";
  let evidence: string | undefined;
  let note: string | undefined;

  for (
    let index = 0;
    index < argv.length;
    index += 1
  ) {
    const arg = argv[index];

    if (arg === "--help") {
      console.log([
        "ASTRA manual release gate recorder",
        "",
        "Usage:",
        "  npm run release:record-gate -- --gate <id> --status <PASS|FAIL|NOT_RUN> [--evidence <path>] [--note <text>]",
        "",
        "PASS requires an existing evidence file under .astra/.",
        "The command never selects the final release status.",
      ].join("\n"));
      process.exit(0);
    }

    const value = argv[++index];
    if (!value) {
      throw new Error(
        `Missing value for ${arg}.`,
      );
    }

    if (arg === "--gate") gate = value;
    else if (arg === "--status") {
      if (
        value !== "PASS" &&
        value !== "FAIL" &&
        value !== "NOT_RUN"
      ) {
        throw new Error(
          "--status must be PASS, FAIL, or NOT_RUN.",
        );
      }
      status = value;
    } else if (arg === "--evidence") {
      evidence = value;
    } else if (arg === "--note") {
      note = value;
    } else {
      throw new Error(
        `Unknown argument: ${arg}`,
      );
    }
  }

  if (!gate || !isManualGateId(gate)) {
    throw new Error(
      "A valid --gate id is required.",
    );
  }
  if (!status) {
    throw new Error(
      "--status is required.",
    );
  }

  return {
    gate,
    status,
    evidence,
    note,
  };
}

async function main() {
  const options = parseArgs(
    process.argv.slice(2),
  );

  let evidencePath: string | undefined;
  if (options.evidence) {
    evidencePath =
      assertPrivateAstraEvidencePath(
        options.evidence,
      );
    if (!existsSync(evidencePath)) {
      throw new Error(
        `Evidence file does not exist: ${options.evidence}`,
      );
    }
  }

  if (
    options.status === "PASS" &&
    !evidencePath
  ) {
    throw new Error(
      "PASS requires --evidence pointing to an existing private file.",
    );
  }

  const outputPath = path.join(
    releaseEvidenceRoot(),
    "manual-gates.json",
  );

  let current:
    | ManualReleaseEvidence
    | null = null;
  if (existsSync(outputPath)) {
    current = JSON.parse(
      await readFile(
        outputPath,
        "utf8",
      ),
    ) as ManualReleaseEvidence;
  }

  const observedAt =
    options.status === "NOT_RUN"
      ? undefined
      : new Date().toISOString();

  const next = upsertManualGate(
    current,
    {
      gate: options.gate,
      status: options.status,
      observedAt,
      evidencePath:
        options.status === "NOT_RUN"
          ? undefined
          : evidencePath,
      note: options.note,
    },
  );

  await mkdir(
    path.dirname(outputPath),
    { recursive: true },
  );
  await writeFile(
    outputPath,
    JSON.stringify(next, null, 2) + "\n",
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        gate: options.gate,
        status: options.status,
        evidencePath:
          evidencePath ?? null,
        manualManifest:
          outputPath,
        finalReleaseStatus:
          "NOT_EVALUATED",
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
      "ASTRA manual release gate update failed.",
      1000,
    ),
  );
  process.exitCode = 1;
});
