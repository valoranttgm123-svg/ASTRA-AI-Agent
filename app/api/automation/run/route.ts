import { astraBrain } from "@/lib/brain/adapter";
import {
  errorResponse,
  guardRequest,
  readJson,
  RequestError,
} from "@/lib/brain/http";
import { executeApprovedAutomationOccurrence } from "@/lib/automation/approval";
import { parseAutomationRunRequest } from "@/lib/automation/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    guardRequest(request, true);

    let parsed: ReturnType<typeof parseAutomationRunRequest>;
    try {
      parsed = parseAutomationRunRequest(await readJson(request));
    } catch (error) {
      throw new RequestError(
        error instanceof Error
          ? error.message
          : "Automation run request is invalid.",
        400,
      );
    }

    try {
      const result = await executeApprovedAutomationOccurrence({
        request: parsed,
        brain: astraBrain,
        signal: request.signal,
      });
      return Response.json({ ok: true, ...result });
    } catch (error) {
      throw new RequestError(
        error instanceof Error
          ? error.message
          : "Automation occurrence could not be executed.",
        400,
      );
    }
  } catch (error) {
    return errorResponse(error);
  }
}
