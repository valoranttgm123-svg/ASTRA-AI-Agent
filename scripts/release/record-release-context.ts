import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type {
  ManualReleaseEvidence,
} from "../../lib/release/core-report";
import {
  updateReleaseContext,
} from "../../lib/release/release-context";
import {
  releaseEvidenceRoot,
} from "../../lib/release/private-output";
import { safeErrorDetail } from "../../lib/security/redaction";

type Options = {
  connected?: string[];
  requiresUserLogin?: string[];
  notImplemented?: string[];
  externalConfigurationRequired?: boolean;
};

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(
  value: string,
  label: string,
) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(
    `${label} must be true or false.`,
  );
}

function parseArgs(
  argv: readonly string[],
): Options {
  const options: Options = {};

  for (
    let index = 0;
    index < argv.length;
    index += 1
  ) {
    const arg = argv[index];

    if (arg === "--help") {
      console.log([
        "ASTRA Phase 20 release context recorder",
        "",
        "Usage:",
        "  npm run release:record-context -- [options]",
        "",
        "Options:",
        "  --connected <csv>",
        "  --requires-login <csv>",
        "  --not-implemented <csv>",
        "  --external-config-required <true|false>",
        "",
        "Values are labels only; secret-like content is redacted.",
        "The command does not set the final release status.",
      ].join("\n"));
      process.exit(0);
    }

    const value = argv[++index];
    if (value === undefined) {
      throw new Error(
        `Missing value for ${arg}.`,
      );
    }

    if (arg === "--connected") {
      options.connected = parseList(value);
    } else if (arg === "--requires-login") {
      options.requiresUserLogin =
        parseList(value);
    } else if (
      arg === "--not-implemented"
    ) {
      options.notImplemented =
        parseList(value);
    } else if (
      arg === "--external-config-required"
    ) {
      options.externalConfigurationRequired =
        parseBoolean(
          value,
          arg,
        );
    } else {
      throw new Error(
        `Unknown argument: ${arg}`,
      );
    }
  }

  if (
    options.connected === undefined &&
    options.requiresUserLogin ===
      undefined &&
    options.notImplemented === undefined &&
    options.externalConfigurationRequired ===
      undefined
  ) {
    throw new Error(
      "At least one release context option is required.",
    );
  }

  return options;
}

async function main() {
  const options = parseArgs(
    process.argv.slice(2),
  );

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

  const next = updateReleaseContext(
    current,
    options,
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
        manualManifest: outputPath,
        connected:
          next.connected ?? [],
        requiresUserLogin:
          next.requiresUserLogin ?? [],
        notImplemented:
          next.notImplemented ?? [],
        externalConfigurationRequired:
          next.externalConfigurationRequired ??
          true,
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
      "ASTRA release context update failed.",
      1000,
    ),
  );
  process.exitCode = 1;
});
