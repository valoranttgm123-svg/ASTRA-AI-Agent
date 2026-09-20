import {
  deleteAutomationDefinition,
  setAutomationDefinitionStatus,
  upsertAutomationDefinition,
} from "@/lib/automation/management";
import { parseAutomationMutation } from "@/lib/automation/http";
import { planAutomationTick } from "@/lib/automation/queue";
import { loadAutomationStore } from "@/lib/automation/store";
import {
  errorResponse,
  guardRequest,
  readJson,
  RequestError,
} from "@/lib/brain/http";

export const dynamic = "force-dynamic";

function mutationError(error: unknown): never {
  throw new RequestError(
    error instanceof Error ? error.message : "Automation mutation failed.",
    400,
  );
}

export async function GET(request: Request) {
  try {
    guardRequest(request);
    const store = await loadAutomationStore();

    if (!store.enabled || !store.available) {
      return Response.json({
        ok: store.available,
        enabled: store.enabled,
        available: store.available,
        detail: store.detail,
        automations: [],
        queue: null,
      });
    }

    const queue = planAutomationTick(store.automations);
    return Response.json({
      ok: true,
      enabled: true,
      available: true,
      detail: store.detail,
      automations: store.automations,
      queue,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    guardRequest(request, true);
    let mutation;
    try {
      mutation = parseAutomationMutation(await readJson(request));
    } catch (error) {
      mutationError(error);
    }

    try {
      if (mutation.action === "upsert") {
        const result = await upsertAutomationDefinition(
          mutation.definition,
        );
        return Response.json({ ok: true, action: mutation.action, ...result });
      }

      if (mutation.action === "status") {
        const result = await setAutomationDefinitionStatus(
          mutation.id,
          mutation.status,
        );
        return Response.json({ ok: true, action: mutation.action, ...result });
      }

      const result = await deleteAutomationDefinition(mutation.id);
      return Response.json({ ok: true, action: mutation.action, ...result });
    } catch (error) {
      mutationError(error);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
