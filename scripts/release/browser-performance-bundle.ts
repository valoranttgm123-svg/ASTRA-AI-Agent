import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  createBrowserReleaseBundle,
  parseStoredBrowserReleaseCapture,
  REQUIRED_BROWSER_RELEASE_SCENARIOS,
  type BrowserReleaseCaptureSource,
  type BrowserReleaseScenario,
} from "../../lib/performance/browser-release";
import {
  browserPerformanceRoot,
} from "../../lib/performance/private-output";
import {
  assertExistingPrivateAstraEvidenceFile,
} from "../../lib/release/private-output";
import { safeErrorDetail } from "../../lib/security/redaction";

function repositoryState() {
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
      "Browser release bundle requires a valid Git HEAD commit.",
    );
  }

  const status = execFileSync(
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

  if (status) {
    throw new Error(
      "Browser release bundle requires a clean Git working tree.",
    );
  }

  return commit.toLowerCase();
}

async function sourceForScenario(
  scenario: BrowserReleaseScenario,
  commit: string,
): Promise<BrowserReleaseCaptureSource> {
  const root = browserPerformanceRoot();
  const names = (await readdir(root))
    .filter(
      (name) =>
        name.startsWith(
          `browser-${scenario}-`,
        ) &&
        name.endsWith(".json"),
    )
    .sort()
    .reverse();

  const rejected: string[] = [];

  for (const name of names) {
    const candidate =
      assertExistingPrivateAstraEvidenceFile(
        path.join(root, name),
      );
    const bytes = await readFile(candidate);

    try {
      const raw = JSON.parse(
        bytes.toString("utf8"),
      ) as unknown;
      const evidence =
        parseStoredBrowserReleaseCapture(
          raw,
          scenario,
          commit,
        );

      return {
        path: path
          .relative(process.cwd(), candidate)
          .replace(/\\/g, "/"),
        sha256: createHash("sha256")
          .update(bytes)
          .digest("hex"),
        bytes: bytes.byteLength,
        evidence,
      };
    } catch {
      rejected.push(name);
    }
  }

  throw new Error(
    `No valid current-commit HIGH browser capture found for ${scenario}. Rejected/available candidates: ${rejected.length > 0 ? rejected.join(", ") : "none"}.`,
  );
}

async function main() {
  const commit = repositoryState();
  const entries = await Promise.all(
    REQUIRED_BROWSER_RELEASE_SCENARIOS.map(
      async (scenario) =>
        [
          scenario,
          await sourceForScenario(
            scenario,
            commit,
          ),
        ] as const,
    ),
  );

  const sources = Object.fromEntries(
    entries,
  ) as Record<
    BrowserReleaseScenario,
    BrowserReleaseCaptureSource
  >;

  const bundle =
    createBrowserReleaseBundle(
      sources,
      commit,
    );

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");
  const outputPath = path.join(
    browserPerformanceRoot(),
    `browser-release-bundle-${timestamp}.json`,
  );

  await mkdir(path.dirname(outputPath), {
    recursive: true,
  });
  await writeFile(
    outputPath,
    JSON.stringify(bundle, null, 2) + "\n",
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        commit,
        outputPath,
        scenarios:
          REQUIRED_BROWSER_RELEASE_SCENARIOS,
        releaseVerdict: "NOT_EVALUATED",
        note:
          "Bundle completeness/provenance verified. Manual performance review is still required before recording the browser-humanoid-performance gate PASS.",
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
      "ASTRA browser release bundle generation failed.",
      1000,
    ),
  );
  process.exitCode = 1;
});
