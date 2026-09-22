import {
  acknowledgeEvent,
  deleteEventSubscription,
  publishIncomingEvent,
  setEventSubscriptionStatus,
  upsertEventSubscription,
} from "@/lib/events/management";
import { parseEventMutation } from "@/lib/events/http";
import { loadEventStore } from "@/lib/events/store";
import {
  errorResponse,
  guardRequest,
  readJson,
  RequestError,
} from "@/lib/brain/http";

export const dynamic = "force-dynamic";

function mutationError(error: unknown): never {
  throw new RequestError(
    error instanceof Error ? error.message : "Event Engine mutation failed.",
    400,
  );
}

export async function GET(request: Request) {
  try {
    guardRequest(request);
    const loaded = await loadEventStore();
    return Response.json({
      ok: loaded.available,
      available: loaded.available,
      detail: loaded.detail,
      subscriptions: loaded.store.subscriptions,
      events: loaded.store.events,
      unacknowledged: loaded.store.events.filter(
        (event) =>
          event.disposition === "delivered" && !event.acknowledgedAt,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    guardRequest(request, true);
    let mutation: ReturnType<typeof parseEventMutation>;
    try {
      mutation = parseEventMutation(await readJson(request));
    } catch (error) {
      mutationError(error);
    }

    try {
      if (mutation.action === "upsert") {
        const result = await upsertEventSubscription(
          mutation.subscription,
        );
        return Response.json({ ok: true, action: mutation.action, ...result });
      }
      if (mutation.action === "status") {
        const result = await setEventSubscriptionStatus(
          mutation.id,
          mutation.status,
        );
        return Response.json({ ok: true, action: mutation.action, ...result });
      }
      if (mutation.action === "delete") {
        const result = await deleteEventSubscription(mutation.id);
        return Response.json({ ok: true, action: mutation.action, ...result });
      }
      if (mutation.action === "publish") {
        const result = await publishIncomingEvent(mutation.event);
        return Response.json({ ok: true, action: mutation.action, ...result });
      }

      const result = await acknowledgeEvent(mutation.id);
      return Response.json({ ok: true, action: mutation.action, ...result });
    } catch (error) {
      mutationError(error);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
