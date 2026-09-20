import { automationBrainRunner } from "@/lib/automation/brain-runner";
import {
  createAutomation,
  deleteAutomation,
  listAutomations,
  setAutomationEnabled,
} from "@/lib/automation/store";
import {
  ensureAutomationWorker,
  getAutomationSystemStatus,
} from "@/lib/automation/worker";
import {
  runAutomationNow,
  runDueAutomations,
} from "@/lib/automation/engine";
import {
  errorResponse,
  guardRequest,
  readJson,
  RequestError,
} from "@/lib/brain/http";

function idFrom(body: Record<string, unknown>) {
  if (typeof body.id !== "string" || !body.id.trim()) {
    throw new RequestError("Automation id diperlukan.");
  }
  return body.id.trim().slice(0, 120);
}

export async function GET(request: Request) {
  try {
    guardRequest(request);
    ensureAutomationWorker(automationBrainRunner);
    const [status, automations] = await Promise.all([
      getAutomationSystemStatus(),
      listAutomations(),
    ]);
    return Response.json({ status, automations });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    guardRequest(request, true);
    const body = await readJson(request);
    const action =
      typeof body.action === "string" ? body.action.trim() : "";

    if (action === "create") {
      const automation = await createAutomation(body.automation);
      ensureAutomationWorker(automationBrainRunner);
      return Response.json({ ok: true, automation });
    }

    if (action === "delete") {
      const deleted = await deleteAutomation(idFrom(body));
      if (!deleted) throw new RequestError("Automation tidak ditemukan.", 404);
      return Response.json({ ok: true, deleted: true });
    }

    if (action === "enable" || action === "disable") {
      const automation = await setAutomationEnabled(
        idFrom(body),
        action === "enable",
      );
      ensureAutomationWorker(automationBrainRunner);
      return Response.json({ ok: true, automation });
    }

    if (action === "run_now") {
      ensureAutomationWorker(automationBrainRunner);
      const run = await runAutomationNow({
        id: idFrom(body),
        runner: automationBrainRunner,
        signal: request.signal,
      });
      return Response.json({ ok: true, run });
    }

    if (action === "run_due") {
      ensureAutomationWorker(automationBrainRunner);
      const runs = await runDueAutomations({
        runner: automationBrainRunner,
        signal: request.signal,
      });
      return Response.json({ ok: true, ...runs });
    }

    throw new RequestError("Automation action tidak valid.");
  } catch (error) {
    return errorResponse(error);
  }
}
