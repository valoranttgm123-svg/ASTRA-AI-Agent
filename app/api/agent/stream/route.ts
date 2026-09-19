import { astraBrain } from "@/lib/brain/adapter";
import { withBrainEventSink } from "@/lib/brain/telemetry";
import type { AgentRequest } from "@/lib/agent/types";
import type { AstraBrainEvent } from "@/lib/brain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StreamPacket =
  | { kind: "brain.event"; event: AstraBrainEvent }
  | { kind: "result"; result: unknown }
  | { kind: "error"; error: string };

function encodePacket(encoder: TextEncoder, packet: StreamPacket) {
  return encoder.encode(JSON.stringify(packet) + "\n");
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
  const approved = Boolean(body.approved);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const push = (packet: StreamPacket) => {
        if (closed || request.signal.aborted) return;
        try {
          controller.enqueue(encodePacket(encoder, packet));
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
          // Client may already have disconnected.
        }
      };

      const onAbort = () => close();
      request.signal.addEventListener("abort", onAbort, { once: true });

      void withBrainEventSink(
        (event) => push({ kind: "brain.event", event }),
        async () => {
          try {
            const result =
              mode === "execute"
                ? await astraBrain.execute({
                    input: message,
                    approved,
                  })
                : await astraBrain.chat(message);

            push({ kind: "result", result });
          } catch {
            push({
              kind: "error",
              error: "ASTRA Brain streaming request failed.",
            });
          } finally {
            request.signal.removeEventListener("abort", onAbort);
            close();
          }
        },
      );
    },
    cancel() {
      // Request AbortSignal handles client disconnect cleanup.
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-content-type-options": "nosniff",
    },
  });
}
