import type { BrainRequest, ProviderChoice, ToolCall } from "./types";
export class RequestError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function guardRequest(request: Request, mutation = false) {
  const host = request.headers.get("host") || new URL(request.url).host;
  let url: URL;
  try { url = new URL("http://" + host); } catch { throw new RequestError("Host tidak valid.", 403); }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new RequestError("ASTRA Brain hanya menerima akses lokal. Jangan publikasikan server ini.", 403);
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== host) throw new RequestError("Origin tidak diizinkan.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new RequestError("Permintaan lintas situs ditolak.", 403);
  if (mutation && (request.headers.get("x-astra-client") !== "1" || !request.headers.get("content-type")?.startsWith("application/json"))) throw new RequestError("Header ASTRA diperlukan.", 403);
}
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader(); if (!reader) throw new RequestError("Body kosong.");
  const parts: Uint8Array[] = []; let length = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 16000) { await reader.cancel(); throw new RequestError("Permintaan terlalu besar.", 413); } parts.push(value); }
    const data = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(); return data;
  } catch (error) { if (error instanceof RequestError) throw error; throw new RequestError("JSON tidak valid."); }
}
export function parseBrainRequest(body: Record<string, unknown>): BrainRequest {
  if (typeof body.message !== "string" || !body.message.trim()) throw new RequestError("message diperlukan.");
  if (body.message.length > 4000) throw new RequestError("Pesan terlalu panjang.", 413);
  const projectId = body.projectId ?? "astra", provider = body.provider ?? "auto";
  if (typeof projectId !== "string" || !/^[a-z0-9-]{1,60}$/.test(projectId) || !["auto","ollama","hermes","codex"].includes(String(provider))) throw new RequestError("Proyek/provider tidak valid.");
  if (body.model !== undefined && (typeof body.model !== "string" || body.model.length > 150)) throw new RequestError("Model tidak valid.");
  if (body.codexMode !== undefined && !["read-only","workspace-write"].includes(String(body.codexMode))) throw new RequestError("Mode Codex tidak valid.");
  if (body.approvalId !== undefined && (typeof body.approvalId !== "string" || !/^[0-9a-f-]{36}$/.test(body.approvalId))) throw new RequestError("Persetujuan tidak valid.");
  let tool: ToolCall | undefined;
  if (body.tool !== undefined) {
    const t = body.tool as Partial<ToolCall>;
    if (!t || typeof t.name !== "string" || t.name.length > 150 || !t.arguments || typeof t.arguments !== "object" || Array.isArray(t.arguments)) throw new RequestError("Tool tidak valid.");
    tool = { name: t.name, arguments: t.arguments };
  }
  return { message: body.message.trim(), projectId, provider: provider as ProviderChoice,
    ...(body.model ? { model: body.model as string } : {}),
    ...(body.codexMode ? { codexMode: body.codexMode as "read-only" | "workspace-write" } : {}),
    ...(tool ? { tool } : {}), ...(body.approvalId ? { approvalId: body.approvalId as string } : {}) };
}
