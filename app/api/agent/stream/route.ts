import { astraBrain } from "@/lib/brain/adapter";
import {
  errorResponse,
  guardRequest,
  parseAgentRequest,
  readJson,
} from "@/lib/brain/http";
import { safeErrorDetail } from "@/lib/security/redaction";
import type {
  AstraBrainChatResult,
  AstraBrainEvent,
  AstraBrainRunOptions,
} from "@/lib/brain/types";

export const dynamic = "force-dynamic";

function encodeSse(
  encoder: TextEncoder,
  event: "brain" | "token" | "result" | "error",
  payload:
    | AstraBrainEvent
    | AstraBrainChatResult
    | { text: string }
    | { message: string },
) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export async function POST(request: Request) {
  let body;
  try {
    guardRequest(request, true);
    body = parseAgentRequest(await readJson(request));
  } catch (error) {
    return errorResponse(error);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (
        event: "brain" | "token" | "result" | "error",
        payload:
          | AstraBrainEvent
          | AstraBrainChatResult
          | { text: string }
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
          // The browser may already have closed the stream.
        }
      };
      const abort = () => close();
      request.signal.addEventListener("abort", abort, { once: true });

      const options: AstraBrainRunOptions = {
        provider: body.provider,
        inputContext: body.inputContext,
        signal: request.signal,
        onEvent: (event) => send("brain", event),
        onToken: (token) => send("token", { text: token }),
      };

      void (async () => {
        try {
          const result =
            body.mode === "execute"
              ? await astraBrain.execute(
                  {
                    input: body.message,
                    approved: body.approved,
                    approvalToken: body.approvalToken,
                  },
                  options,
                )
              : await astraBrain.chat(body.message, options);

          if (!request.signal.aborted) send("result", result);
        } catch (error) {
          if (!request.signal.aborted) {
            send("error", {
              message: safeErrorDetail(
                error,
                "ASTRA Brain streaming failed.",
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
