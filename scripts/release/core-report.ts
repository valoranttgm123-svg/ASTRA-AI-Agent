import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  evaluateCoreRelease,
  renderCoreReleaseMarkdown,
  type CoreReleaseEvidence,
  type ManualReleaseEvidence,
} from "../../lib/release/core-report";
import {
  assertExistingPrivateAstraEvidenceFile,
  assertPrivateAstraEvidencePath,
  resolveReleaseEvidencePath,
} from "../../lib/release/private-output";
import { safeErrorDetail } from "../../lib/security/redaction";

type Options = {
  repositoryGate?: string;
  targetPc?: string;
  performance?: string;
  validation?: string;
  manual?: string;
  outputJson?: string;
  outputMd?: string;
};

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") {
      console.log([
        "ASTRA Phase 20 core release report generator",
        "",
        "Usage:",
        "  npm run release:core-report -- [options]",
        "",
        "Options:",
        "  --repository-gate <path>  Repository gate evidence JSON",
        "  --target-pc <path>         Target-PC evidence JSON",
        "  --performance <path>       Runtime performance JSON",
        "  --validation <path>        Phase 17 chat-preflight JSON",
        "  --manual <path>            Manual gate manifest JSON",
        "  --output-json <path>       Output JSON inside .astra/release/",
        "  --output-md <path>         Output Markdown inside .astra/release/",
        "",
        "When an input is omitted, the latest matching private artifact is used when available.",
        "Missing or incomplete evidence produces RELEASE STATUS = BLOCKED.",
      ].join("\n"));
      process.exit(0);
    }

    const value = argv[++index];
    if (!value) throw new Error(`Missing value for ${arg}.`);

    if (arg === "--repository-gate") options.repositoryGate = value;
    else if (arg === "--target-pc") options.targetPc = value;
    else if (arg === "--performance") options.performance = value;
    else if (arg === "--validation") options.validation = value;
    else if (arg === "--manual") options.manual = value;
    else if (arg === "--output-json") options.outputJson = value;
    else if (arg === "--output-md") options.outputMd = value;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function latestMatching(
  dir: string,
  prefix: string,
) {
  try {
    const names = (await readdir(dir))
      .filter(
        (name) =>
          name.startsWith(prefix) &&
          name.endsWith(".json"),
      )
      .sort();
    const latest = names.at(-1);
    return latest ? path.join(dir, latest) : undefined;
  } catch {
    return undefined;
  }
}

async function readJson<T>(rawPath?: string): Promise<T | null> {
  if (!rawPath) return null;
  const candidate =
    assertPrivateAstraEvidencePath(rawPath);
  if (!existsSync(candidate)) return null;

  const filePath =
    assertExistingPrivateAstraEvidenceFile(
      candidate,
    );
  return JSON.parse(
    await readFile(filePath, "utf8"),
  ) as T;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const repositoryGatePath =
    options.repositoryGate ??
    await latestMatching(
      path.resolve(".astra", "release"),
      "repository-gate-",
    );
  const targetPcPath =
    options.targetPc ??
    await latestMatching(
      path.resolve(".astra", "readiness"),
      "target-pc-evidence-",
    );
  const performancePath =
    options.performance ??
    await latestMatching(
      path.resolve(".astra", "performance"),
      "runtime-",
    );
  const validationPath =
    options.validation ??
    await latestMatching(
      path.resolve(".astra", "validation"),
      "",
    );
  const manualPath =
    options.manual ??
    path.resolve(
      ".astra",
      "release",
      "manual-gates.json",
    );

  const manual =
    await readJson<ManualReleaseEvidence>(
      manualPath,
    );

  for (const gate of manual?.gates ?? []) {
    if (gate.status !== "PASS") continue;
    if (!gate.evidencePath) {
      throw new Error(
        `PASS manual gate ${gate.id} is missing evidencePath.`,
      );
    }
    const referencedCandidate =
      assertPrivateAstraEvidencePath(
        gate.evidencePath,
      );
    if (!existsSync(referencedCandidate)) {
      throw new Error(
        `PASS manual gate ${gate.id} references missing evidence: ${gate.evidencePath}`,
      );
    }
    assertExistingPrivateAstraEvidenceFile(
      referencedCandidate,
    );
  }

  const evidence: CoreReleaseEvidence = {
    repositoryGate:
      await readJson(repositoryGatePath),
    targetPc:
      await readJson(targetPcPath),
    performance:
      await readJson(performancePath),
    validation:
      await readJson(validationPath),
    manual,
  };

  const report = evaluateCoreRelease(evidence);
  const jsonPath = resolveReleaseEvidencePath(
    options.outputJson,
    "core-release-report",
    "json",
  );
  const mdPath = resolveReleaseEvidencePath(
    options.outputMd,
    "core-release-report",
    "md",
  );

  await mkdir(path.dirname(jsonPath), {
    recursive: true,
  });
  await writeFile(
    jsonPath,
    JSON.stringify(report, null, 2) + "\n",
    "utf8",
  );
  await writeFile(
    mdPath,
    renderCoreReleaseMarkdown(report),
    "utf8",
  );

  console.log(JSON.stringify({
    ok: true,
    releaseStatus:
      report.sections.RELEASE_STATUS,
    outputJson: jsonPath,
    outputMarkdown: mdPath,
    evidence: {
      repositoryGate: repositoryGatePath ?? null,
      targetPc: targetPcPath ?? null,
      performance: performancePath ?? null,
      validation: validationPath ?? null,
      manual:
        evidence.manual ? manualPath : null,
    },
  }, null, 2));

  if (
    report.sections.RELEASE_STATUS === "BLOCKED"
  ) {
    process.exitCode = 2;
  }
}

void main().catch((error) => {
  console.error(
    safeErrorDetail(
      error,
      "ASTRA core release report generation failed.",
      1000,
    ),
  );
  process.exitCode = 1;
});
