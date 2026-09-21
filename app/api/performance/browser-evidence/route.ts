import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

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
  resolveBrowserPerformancePath,
} from "@/lib/performance/private-output";

export const dynamic = "force-dynamic";

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
      resolveBrowserPerformancePath(
        evidence.scenario,
      );
    await mkdir(path.dirname(outputPath), {
      recursive: true,
    });
    await writeFile(
      outputPath,
      JSON.stringify(evidence, null, 2) + "\n",
      "utf8",
    );

    return Response.json({
      ok: true,
      releaseVerdict: "NOT_EVALUATED",
      evidencePath: outputPath,
      scenario: evidence.scenario,
      quality: evidence.humanoid.quality,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
