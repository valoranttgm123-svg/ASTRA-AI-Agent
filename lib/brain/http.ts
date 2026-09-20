import type { AgentRequest, AstraProviderChoice } from "@/lib/agent/types";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const PROVIDERS = new Set<AstraProviderChoice>(["auto", "ollama", "codex"]);
const MAX_BODY_BYTES = 16_000;

export class RequestError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export function guardRequest(request: Request, mutation = false) {
  const host = request.headers.get("host") || new URL(request.url).host;
  let hostUrl: URL;

  try {
    hostUrl = new URL(`http://${host}`);
  } catch {
    throw new RequestError("Host tidak valid.", 403);
  }

  if (!LOCAL_HOSTS.has(hostUrl.hostname)) {
    throw new RequestError(
      "ASTRA Brain hanya menerima akses lokal. Jangan publikasikan server ini.",
      403,
    );
  }

  const origin = request.headers.get("origin");
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new RequestError("Origin tidak valid.", 403);
    }
    if (originHost !== host) {
      throw new RequestError("Origin tidak diizinkan.", 403);
    }
  }

  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new RequestError("Permintaan lintas situs ditolak.", 403);
  }

  if (
    mutation &&
    (request.headers.get("x-astra-client") !== "1" ||
      !request.headers.get("content-type")?.startsWith("application/json"))
  ) {
    throw new RequestError("Header ASTRA diperlukan.", 403);
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("Body kosong.");

  const chunks: Uint8Array[] = [];
  let length = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RequestError("Permintaan terlalu besar.", 413);
      }
      chunks.push(value);
    }

    const merged = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const data = JSON.parse(new TextDecoder().decode(merged)) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError("JSON tidak valid.");
  }
}

export function parseAgentRequest(body: Record<string, unknown>): AgentRequest {
  if (typeof body.message !== "string" || !body.message.trim()) {
    throw new RequestError("message diperlukan.");
  }
  if (body.message.length > 4000) {
    throw new RequestError("Pesan terlalu panjang.", 413);
  }
  if (body.mode !== undefined && body.mode !== "chat" && body.mode !== "execute") {
    throw new RequestError("Mode tidak valid.");
  }
  if (body.approved !== undefined && typeof body.approved !== "boolean") {
    throw new RequestError("Approval tidak valid.");
  }

  const provider = (body.provider ?? "auto") as AstraProviderChoice;
  if (!PROVIDERS.has(provider)) {
    throw new RequestError("Provider tidak valid.");
  }

  return {
    message: body.message.trim(),
    mode: body.mode === "execute" ? "execute" : "chat",
    approved: Boolean(body.approved),
    provider,
  };
}

export function errorResponse(error: unknown) {
  const status = error instanceof RequestError ? error.status : 400;
  const message =
    error instanceof RequestError ? error.message : "Permintaan tidak valid.";
  return Response.json({ ok: false, error: message }, { status });
}
