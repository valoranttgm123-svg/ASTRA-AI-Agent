import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";

import {
  errorResponse,
  guardRequest,
  readJson,
  RequestError,
} from "@/lib/brain/http";
import { parseUiPerformanceEvidence } from "@/lib/performance/ui-evidence";
import { prepareUiPerformancePath } from "@/lib/performance/private-output";
import { runtimeBuildIdentity } from "@/lib/release/runtime-build-identity";

export const dynamic = "force-dynamic";

function repositorySnapshot() {
  try {
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const status = execFileSync(
      "git",
      ["status", "--porcelain", "--untracked-files=normal"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();

    return {
      commit: /^[0-9a-f]{40}$/i.test(commit)
        ? commit.toLowerCase()
        : "unknown",
      workingTreeClean: status.length === 0,
    };
  } catch {
    return {
      commit: "unknown",
      workingTreeClean: false,
    };
  }
}

export async function POST(request: Request) {
  try {
    guardRequest(request, true);

    let evidence;
    try {
      evidence = parseUiPerformanceEvidence(await readJson(request));
    } catch (error) {
      throw new RequestError(
        error instanceof Error
          ? error.message
          : "UI performance evidence invalid.",
        400,
      );
    }

    const repository = repositorySnapshot();
    const runtime = runtimeBuildIdentity();
    if (
      repository.commit === "unknown" ||
      repository.workingTreeClean !== true ||
      runtime.commit === "unknown" ||
      runtime.workingTreeClean !== true ||
      runtime.commit !== repository.commit ||
      evidence.runtime.commit !== runtime.commit ||
      evidence.runtime.workingTreeClean !== true ||
      evidence.runtime.verifiedAtStart !== true ||
      evidence.runtime.verifiedAtCompletion !== true
    ) {
      throw new RequestError(
        "UI evidence runtime does not match the clean running ASTRA build.",
        409,
      );
    }

    const outputPath = prepareUiPerformancePath(evidence.scenario);
    const storedEvidence = {
      ...evidence,
      repository,
    };

    await writeFile(
      outputPath,
      JSON.stringify(storedEvidence, null, 2) + "\n",
      "utf8",
    );

    return Response.json({
      ok: true,
      evidencePath: outputPath,
      scenario: evidence.scenario,
      releaseVerdict: "NOT_EVALUATED",
      repository,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
