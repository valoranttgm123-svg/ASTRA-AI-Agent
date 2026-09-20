import type {
  AgentRequest,
  AstraInputContext,
  AstraInputModality,
  AstraInputSource,
  AstraInputTrigger,
  AstraProviderChoice,
} from "@/lib/agent/types";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const PROVIDERS = new Set<AstraProviderChoice>(["auto", "ollama", "codex"]);
const INPUT_SOURCES = new Set<AstraInputSource>(["text", "voice"]);
const INPUT_TRIGGERS = new Set<AstraInputTrigger>([
  "keyboard",
  "microphone",
  "gesture_open_palm",
  "api",
  "automation",
]);
const INPUT_MODALITIES = new Set<AstraInputModality>([
  "text",
  "voice",
  "gesture",
  "camera",
  "image",
  "screen",
]);
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

function parseInputContext(value: unknown): AstraInputContext | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestError("Input context tidak valid.");
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.source !== "string" ||
    !INPUT_SOURCES.has(record.source as AstraInputSource)
  ) {
    throw new RequestError("Input source tidak valid.");
  }
  if (
    typeof record.trigger !== "string" ||
    !INPUT_TRIGGERS.has(record.trigger as AstraInputTrigger)
  ) {
    throw new RequestError("Input trigger tidak valid.");
  }
  if (
    !Array.isArray(record.modalities) ||
    record.modalities.length < 1 ||
    record.modalities.length > 6 ||
    record.modalities.some(
      (item) =>
        typeof item !== "string" ||
        !INPUT_MODALITIES.has(item as AstraInputModality),
    )
  ) {
    throw new RequestError("Input modalities tidak valid.");
  }

  const consent = record.consent;
  if (!consent || typeof consent !== "object" || Array.isArray(consent)) {
    throw new RequestError("Input consent tidak valid.");
  }
  const consentRecord = consent as Record<string, unknown>;
  for (const key of ["microphone", "camera", "image", "screen"] as const) {
    if (typeof consentRecord[key] !== "boolean") {
      throw new RequestError("Input consent tidak valid.");
    }
  }

  if (record.visualContentProvided !== false) {
    throw new RequestError(
      "Phase 12 belum menerima payload visual. visualContentProvided harus false.",
    );
  }

  const modalities = [
    ...new Set(record.modalities as AstraInputModality[]),
  ];

  if (record.source === "text" && !modalities.includes("text")) {
    throw new RequestError("Input text harus menyertakan modality text.");
  }
  if (record.source === "voice" && !modalities.includes("voice")) {
    throw new RequestError("Input voice harus menyertakan modality voice.");
  }
  if (modalities.includes("image") || modalities.includes("screen")) {
    throw new RequestError(
      "Image/screen input belum dikonfigurasi pada Phase 12.",
    );
  }
  if (record.source === "voice" && consentRecord.microphone !== true) {
    throw new RequestError("Voice input memerlukan consent mikrofon.");
  }
  if (record.trigger === "gesture_open_palm") {
    if (
      record.source !== "voice" ||
      !modalities.includes("gesture") ||
      !modalities.includes("camera") ||
      consentRecord.camera !== true
    ) {
      throw new RequestError(
        "Gesture voice input memerlukan modality gesture/camera dan consent kamera.",
      );
    }
  }

  return {
    source: record.source as AstraInputSource,
    trigger: record.trigger as AstraInputTrigger,
    modalities,
    consent: {
      microphone: consentRecord.microphone as boolean,
      camera: consentRecord.camera as boolean,
      image: consentRecord.image as boolean,
      screen: consentRecord.screen as boolean,
    },
    visualContentProvided: false,
  };
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
  if (
    body.approvalToken !== undefined &&
    (typeof body.approvalToken !== "string" ||
      body.approvalToken.trim().length < 8 ||
      body.approvalToken.trim().length > 160)
  ) {
    throw new RequestError("Approval token tidak valid.");
  }

  const provider = (body.provider ?? "auto") as AstraProviderChoice;
  if (!PROVIDERS.has(provider)) {
    throw new RequestError("Provider tidak valid.");
  }

  const approvalToken =
    typeof body.approvalToken === "string"
      ? body.approvalToken.trim()
      : undefined;
  const inputContext = parseInputContext(body.inputContext);

  return {
    message: body.message.trim(),
    mode: body.mode === "execute" ? "execute" : "chat",
    approved: Boolean(body.approved),
    ...(approvalToken ? { approvalToken } : {}),
    provider,
    ...(inputContext ? { inputContext } : {}),
  };
}

export function errorResponse(error: unknown) {
  const status = error instanceof RequestError ? error.status : 400;
  const message =
    error instanceof RequestError ? error.message : "Permintaan tidak valid.";
  return Response.json({ ok: false, error: message }, { status });
}
