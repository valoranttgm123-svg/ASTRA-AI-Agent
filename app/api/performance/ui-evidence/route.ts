import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  errorResponse,
  guardRequest,
  readJson,
  RequestError,
} from "@/lib/brain/http";
import {
  parseUiPerformanceEvidence,
} from "@/lib/performance/ui-evidence";
import {
  resolveUiPerformancePath,
} from "@/lib/performance/private-output";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    guardRequest(request, true);

    let evidence;
    try {
      evidence =
        parseUiPerformanceEvidence(
          await readJson(request),
        );
    } catch (error) {
      throw new RequestError(
        error instanceof Error
          ? error.message
          : "UI performance evidence invalid.",
        400,
      );
    }

    const outputPath =
      resolveUiPerformancePath(
        evidence.scenario,
      );
    await mkdir(
      path.dirname(outputPath),
      { recursive: true },
    );
    await writeFile(
      outputPath,
      JSON.stringify(evidence, null, 2) +
        "\n",
      "utf8",
    );

    return Response.json({
      ok: true,
      evidencePath: outputPath,
      scenario: evidence.scenario,
      releaseVerdict: "NOT_EVALUATED",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
