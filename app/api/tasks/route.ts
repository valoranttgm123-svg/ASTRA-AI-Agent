import {
  cancelBackgroundTask,
  deleteBackgroundTask,
  pauseBackgroundTask,
  resumeBackgroundTask,
  upsertBackgroundTask,
} from "@/lib/tasks/management";
import { parseTaskMutation } from "@/lib/tasks/http";
import { planBackgroundTaskTick } from "@/lib/tasks/scheduler";
import { loadTaskStore } from "@/lib/tasks/store";
import {
  errorResponse,
  guardRequest,
  readJson,
  RequestError,
} from "@/lib/brain/http";

export const dynamic = "force-dynamic";

function mutationError(error: unknown): never {
  throw new RequestError(
    error instanceof Error ? error.message : "Background task mutation failed.",
    400,
  );
}

export async function GET(request: Request) {
  try {
    guardRequest(request);
    const loaded = await loadTaskStore();
    const plan = loaded.available
      ? planBackgroundTaskTick(loaded.store.tasks)
      : undefined;

    return Response.json({
      ok: loaded.available,
      available: loaded.available,
      detail: loaded.detail,
      tasks: loaded.store.tasks,
      plan,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    guardRequest(request, true);
    let mutation: ReturnType<typeof parseTaskMutation>;
    try {
      mutation = parseTaskMutation(await readJson(request));
    } catch (error) {
      mutationError(error);
    }

    try {
      if (mutation.action === "upsert") {
        const result = await upsertBackgroundTask(mutation.task);
        return Response.json({ ok: true, action: mutation.action, ...result });
      }
      if (mutation.action === "resume") {
        const result = await resumeBackgroundTask(mutation.id);
        return Response.json({ ok: true, action: mutation.action, ...result });
      }
      if (mutation.action === "pause") {
        const result = await pauseBackgroundTask(mutation.id);
        return Response.json({ ok: true, action: mutation.action, ...result });
      }
      if (mutation.action === "cancel") {
        const result = await cancelBackgroundTask(mutation.id);
        return Response.json({ ok: true, action: mutation.action, ...result });
      }

      const result = await deleteBackgroundTask(mutation.id);
      return Response.json({ ok: true, action: mutation.action, ...result });
    } catch (error) {
      mutationError(error);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
