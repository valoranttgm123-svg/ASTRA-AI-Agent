import { randomUUID } from "node:crypto";
import { astraBrain } from "@/lib/brain/adapter";
import { guardRequest, readJson, parseBrainRequest, RequestError } from "@/lib/brain/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const globals = globalThis as typeof globalThis & { astraRequests?: Map<string, AbortController> };
const active = globals.astraRequests ??= new Map<string, AbortController>();
const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
function errorResponse(error: unknown) {
  return Response.json({ ok: false, error: error instanceof RequestError ? error.message : "Permintaan gagal diproses." }, { status: error instanceof RequestError ? error.status : 500, headers });
}
export async function GET(request: Request) {
  try { guardRequest(request); return Response.json(await astraBrain.status(), { headers }); }
  catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request) {
  try {
    guardRequest(request, true); const body = await readJson(request);
    if (typeof body.requestId !== "string") throw new RequestError("requestId diperlukan.");
    const controller = active.get(body.requestId);
    controller?.abort(); return Response.json({ ok: true, cancelled: Boolean(controller) }, { headers });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    guardRequest(request, true);
    const body = await readJson(request);
    const input = parseBrainRequest(body);
    const id = typeof body.requestId === "string" && /^[0-9a-f-]{36}$/.test(body.requestId) ? body.requestId : randomUUID();
    if (active.has(id)) throw new RequestError("Permintaan duplikat.", 409);
    if (active.size >= 4) throw new RequestError("ASTRA sibuk; coba lagi setelah tugas aktif selesai.", 429);
    const controller = new AbortController(); active.set(id, controller);
    const abort = () => controller.abort(); request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) controller.abort();
    const cleanup = () => { active.delete(id); request.signal.removeEventListener("abort", abort); };
    if (!request.headers.get("accept")?.includes("application/x-ndjson")) {
      try { return Response.json(await astraBrain.chat(input, { signal: controller.signal, requestId: id }), { headers }); }
      finally { cleanup(); }
    }
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(streamController) {
        const send = (value: unknown) => {
          if (controller.signal.aborted) return;
          try { streamController.enqueue(encoder.encode(JSON.stringify(value) + "\n")); } catch { controller.abort(); }
        };
        void astraBrain.chat(input, { requestId: id, signal: controller.signal, emit: event => send({ type: "event", event }) })
          .then(result => send({ type: "result", result }))
          .catch(() => { if (!controller.signal.aborted) send({ type: "error", error: "Eksekusi gagal." }); })
          .finally(() => { cleanup(); try { streamController.close(); } catch { /* disconnected */ } });
      },
      cancel() { controller.abort(); },
    });
    return new Response(stream, { headers: { ...headers, "content-type": "application/x-ndjson", "x-accel-buffering": "no" } });
  } catch (error) { return errorResponse(error); }
}
