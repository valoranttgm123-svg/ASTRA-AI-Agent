import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";

import {
  errorResponse,
  guardRequest,
  readJson,
  RequestError,
} from "@/lib/brain/http";
import {
  parseBrowserPerformanceEvidence,
} from "@/lib/performance/browser-evidence";
import {
  prepareBrowserPerformancePath,
} from "@/lib/performance/private-output";

export const dynamic = "force-dynamic";

function repositorySnapshot() {
  try {
    const commit = execFileSync(
      "git",
      ["rev-parse", "HEAD"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();

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

    return {
      commit:
        /^[0-9a-f]{40}$/i.test(commit)
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
      evidence =
        parseBrowserPerformanceEvidence(
          await readJson(request),
        );
    } catch (error) {
      throw new RequestError(
        error instanceof Error
          ? error.message
          : "Browser performance evidence invalid.",
        400,
      );
    }

    const outputPath =
      prepareBrowserPerformancePath(
        evidence.scenario,
      );
    const storedEvidence = {
      ...evidence,
      repository: repositorySnapshot(),
    };

    await writeFile(
      outputPath,
      JSON.stringify(storedEvidence, null, 2) +
        "\n",
      "utf8",
    );

    return Response.json({
      ok: true,
      releaseVerdict: "NOT_EVALUATED",
      evidencePath: outputPath,
      scenario: evidence.scenario,
      quality: evidence.humanoid.quality,
      repository:
        storedEvidence.repository,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
