import type { AstraBrainEvent } from "@/lib/brain/types";
import {
  getAutomationService,
  getAutomationServiceStatus,
  type AstraAutomationServiceStatus,
} from "@/lib/automation/service";
import {
  errorResponse,
  guardRequest,
  RequestError,
} from "@/lib/brain/http";

export const dynamic = "force-dynamic";

function encodeSse(
  encoder: TextEncoder,
  event: "brain" | "status" | "heartbeat",
  payload:
    | AstraBrainEvent
    | AstraAutomationServiceStatus
    | { at: string },
) {
  return encoder.encode(
    `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`,
  );
}

export async function GET(request: Request) {
  try {
    guardRequest(request);
    const initial = getAutomationServiceStatus();
    if (!initial.enabled) {
      throw new RequestError(
        "Automation service telemetry is disabled.",
        409,
      );
    }
  } catch (error) {
    return errorResponse(error);
  }

  const service = getAutomationService();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let unsubscribe: (() => void) | null = null;

      const send = (
        event: "brain" | "status" | "heartbeat",
        payload:
          | AstraBrainEvent
          | AstraAutomationServiceStatus
          | { at: string },
      ) => {
        if (closed) return;
        try {
          controller.enqueue(encodeSse(encoder, event, payload));
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
        unsubscribe?.();
        unsubscribe = null;
        request.signal.removeEventListener("abort", cleanup);
        try {
          controller.close();
        } catch {
          // Browser may already have closed the stream.
        }
      };

      const initial = service.getStatus();
      send("status", initial);
      for (const event of initial.recentEvents) {
        send("brain", event);
      }

      unsubscribe = service.subscribe((event) => {
        send("brain", event);
        send("status", service.getStatus());
      });

      heartbeat = setInterval(() => {
        send("heartbeat", { at: new Date().toISOString() });
        send("status", service.getStatus());
      }, 30_000);

      const timer = heartbeat as ReturnType<typeof setInterval> & {
        unref?: () => void;
      };
      timer.unref?.();

      request.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      // The request AbortSignal cleanup owns listener disposal.
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
