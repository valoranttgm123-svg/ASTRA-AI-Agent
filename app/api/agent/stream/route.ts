import { astraBrain } from "@/lib/brain/adapter";
import type { AgentRequest } from "@/lib/agent/types";
import type {
  AstraBrainChatResult,
  AstraBrainEvent,
  AstraBrainRunOptions,
} from "@/lib/brain/types";

export const dynamic = "force-dynamic";

function encodeSse(
  encoder: TextEncoder,
  event: "brain" | "result" | "error",
  payload: AstraBrainEvent | AstraBrainChatResult | { message: string },
) {
  return encoder.encode(
    `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`,
  );
}

export async function POST(request: Request) {
  let body: Partial<AgentRequest>;

  try {
    body = (await request.json()) as Partial<AgentRequest>;
  } catch {
    return Response.json(
      { ok: false, error: "invalid request" },
      { status: 400 },
    );
  }

  const message = body.message?.trim();
  if (!message) {
    return Response.json(
      { ok: false, error: "message is required" },
      { status: 400 },
    );
  }

  if (message.length > 4000) {
    return Response.json(
      { ok: false, error: "message is too long" },
      { status: 413 },
    );
  }

  const mode = body.mode === "execute" ? "execute" : "chat";
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (
        event: "brain" | "result" | "error",
        payload: AstraBrainEvent | AstraBrainChatResult | { message: string },
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
          // Client may already have closed the stream.
        }
      };

      const abort = () => close();
      request.signal.addEventListener("abort", abort, { once: true });

      const options: AstraBrainRunOptions = {
        onEvent: (event) => send("brain", event),
      };

      void (async () => {
        try {
          const result =
            mode === "execute"
              ? await astraBrain.execute(
                  {
                    input: message,
                    approved: Boolean(body.approved),
                  },
                  options,
                )
              : await astraBrain.chat(message, options);

          if (!request.signal.aborted) {
            send("result", result);
          }
        } catch (error) {
          if (!request.signal.aborted) {
            send("error", {
              message:
                error instanceof Error
                  ? error.message
                  : "ASTRA Brain streaming failed.",
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
