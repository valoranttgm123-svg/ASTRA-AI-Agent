import { getAutomationLifecycleEventBridgeStatus } from "@/lib/events/automation-lifecycle";
import {
  getAutomationService,
  getAutomationServiceStatus,
  runAutomationServiceTickNow,
  startAutomationServiceIfEnabled,
  stopAutomationService,
  stopAutomationServiceActiveTick,
} from "@/lib/automation/service";
import {
  errorResponse,
  guardRequest,
  readJson,
  RequestError,
} from "@/lib/brain/http";

export const dynamic = "force-dynamic";

function parseAction(body: Record<string, unknown>) {
  if (
    body.action === "start" ||
    body.action === "stop" ||
    body.action === "stop-active" ||
    body.action === "tick"
  ) {
    return body.action;
  }
  throw new RequestError("Automation service action is invalid.", 400);
}

export async function GET(request: Request) {
  try {
    guardRequest(request);
    return Response.json({
      ok: true,
      service: getAutomationServiceStatus(),
      eventBridge: getAutomationLifecycleEventBridgeStatus(
        getAutomationService(),
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    guardRequest(request, true);
    const action = parseAction(await readJson(request));

    if (action === "start") {
      const started = startAutomationServiceIfEnabled();
      return Response.json({
        ok: started,
        action,
        service: getAutomationServiceStatus(),
        eventBridge: getAutomationLifecycleEventBridgeStatus(
          getAutomationService(),
        ),
      }, { status: started ? 200 : 409 });
    }

    if (action === "stop") {
      stopAutomationService();
      return Response.json({
        ok: true,
        action,
        service: getAutomationServiceStatus(),
        eventBridge: getAutomationLifecycleEventBridgeStatus(
          getAutomationService(),
        ),
      });
    }

    if (action === "stop-active") {
      const stopped = stopAutomationServiceActiveTick();
      return Response.json({
        ok: true,
        action,
        stopped,
        service: getAutomationServiceStatus(),
        eventBridge: getAutomationLifecycleEventBridgeStatus(
          getAutomationService(),
        ),
      });
    }

    const result = await runAutomationServiceTickNow();
    const service = getAutomationServiceStatus();
    return Response.json(
      {
        ok: Boolean(result),
        action,
        result,
        service,
        eventBridge: getAutomationLifecycleEventBridgeStatus(
          getAutomationService(),
        ),
      },
      { status: result ? 200 : 409 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
