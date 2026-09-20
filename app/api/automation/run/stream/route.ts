import { astraBrain } from "@/lib/brain/adapter";
import {
  errorResponse,
  guardRequest,
  readJson,
  RequestError,
} from "@/lib/brain/http";
import {
  executeApprovedAutomationOccurrence,
  type AstraAutomationOccurrenceResult,
} from "@/lib/automation/approval";
import { parseAutomationRunRequest } from "@/lib/automation/http";
import type { AstraBrainEvent } from "@/lib/brain/types";
import { safeErrorDetail } from "@/lib/security/redaction";

export const dynamic = "force-dynamic";

function encodeSse(
  encoder: TextEncoder,
  event: "brain" | "result" | "error",
  payload:
    | AstraBrainEvent
    | AstraAutomationOccurrenceResult
    | { message: string },
) {
  return encoder.encode(
    `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`,
  );
}

export async function POST(request: Request) {
  let parsed: ReturnType<typeof parseAutomationRunRequest>;

  try {
    guardRequest(request, true);
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
  } catch (error) {
    return errorResponse(error);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (
        event: "brain" | "result" | "error",
        payload:
          | AstraBrainEvent
          | AstraAutomationOccurrenceResult
          | { message: string },
      ) => {
        if (closed) return;
        try {
          controller.enqueue(encodeSse(encoder, event, payload));
        } catch {
          closed = true;
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Client may have already closed the stream.
        }
      };

      const abort = () => close();
      request.signal.addEventListener("abort", abort, { once: true });

      void (async () => {
        try {
          const result = await executeApprovedAutomationOccurrence({
            request: parsed,
            brain: astraBrain,
            signal: request.signal,
            onEvent: (event) => send("brain", event),
          });

          if (!request.signal.aborted) {
            send("result", result);
          }
        } catch (error) {
          if (!request.signal.aborted) {
            send("error", {
              message: safeErrorDetail(
                error,
                "Automation streaming failed.",
                700,
              ),
            });
          }
        } finally {
          request.signal.removeEventListener("abort", abort);
          close();
        }
      })();
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
