import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  type ManualGateId,
  type ManualGateStatus,
  type ManualReleaseEvidence,
} from "../../lib/release/core-report";
import {
  isManualGateId,
  upsertManualGate,
} from "../../lib/release/manual-evidence";
import {
  assertExistingPrivateAstraEvidenceFile,
  assertPrivateAstraEvidencePath,
  releaseEvidenceRoot,
} from "../../lib/release/private-output";
import { safeErrorDetail } from "../../lib/security/redaction";

type Options = {
  gate: ManualGateId;
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
    gate: gate as ManualGateId,
    status,
    evidence,
    note,
  };
}

function currentCommit() {
  const commit = execFileSync(
    "git",
    ["rev-parse", "HEAD"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  ).trim();

  if (!/^[0-9a-f]{40}$/i.test(commit)) {
    throw new Error(
      "Cannot record release evidence without a valid Git HEAD commit.",
    );
  }

  return commit.toLowerCase();
}

async function evidenceIntegrity(
  evidencePath: string,
) {
  const bytes = await readFile(evidencePath);
  if (bytes.byteLength <= 0) {
    throw new Error(
      "Release evidence file must not be empty.",
    );
  }

  return {
    evidenceBytes: bytes.byteLength,
    evidenceSha256: createHash("sha256")
      .update(bytes)
      .digest("hex"),
  };
}

async function main() {
  const options = parseArgs(
    process.argv.slice(2),
  );

  let evidencePath: string | undefined;
  if (options.evidence) {
    const candidate =
      assertPrivateAstraEvidencePath(
        options.evidence,
      );
    if (!existsSync(candidate)) {
      throw new Error(
        `Evidence file does not exist: ${options.evidence}`,
      );
    }
    evidencePath =
      assertExistingPrivateAstraEvidenceFile(
        candidate,
      );
  }


  let integrity:
    | Awaited<
        ReturnType<typeof evidenceIntegrity>
      >
    | undefined;
  let commit: string | undefined;

  if (options.status === "PASS") {
    if (!evidencePath) {
      throw new Error(
        "PASS requires --evidence pointing to an existing private file.",
      );
    }
    integrity = await evidenceIntegrity(
      evidencePath,
    );
    commit = currentCommit();
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
      evidenceSha256:
        options.status === "PASS"
          ? integrity?.evidenceSha256
          : undefined,
      evidenceBytes:
        options.status === "PASS"
          ? integrity?.evidenceBytes
          : undefined,
      commit:
        options.status === "PASS"
          ? commit
          : undefined,
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
        evidenceSha256:
          integrity?.evidenceSha256 ?? null,
        evidenceBytes:
          integrity?.evidenceBytes ?? null,
        commit: commit ?? null,
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
