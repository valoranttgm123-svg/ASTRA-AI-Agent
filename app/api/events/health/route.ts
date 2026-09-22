import {
  getServiceHealthEventStatus,
  syncServiceHealthEvents,
} from "@/lib/events/service-health";
import {
  errorResponse,
  guardRequest,
  readJson,
  RequestError,
} from "@/lib/brain/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    guardRequest(request);
    const status = await getServiceHealthEventStatus({
      signal: request.signal,
    });
    return Response.json({ ok: true, ...status });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    guardRequest(request, true);
    const body = await readJson(request);
    if (body.action !== "sync") {
      throw new RequestError(
        "Service-health event action must be sync.",
        400,
      );
    }

    const result = await syncServiceHealthEvents({
      signal: request.signal,
    });
    return Response.json({
      ok: true,
      action: "sync",
      ...result,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
