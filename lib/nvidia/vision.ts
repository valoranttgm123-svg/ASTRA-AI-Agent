export const NVIDIA_VISION_MAX_FRAMES_PER_REQUEST = 120;
export const NVIDIA_VISION_MAX_PAYLOAD_BYTES = 64 * 1024 * 1024;

export type NvidiaVisualSource = "camera" | "screen" | "image" | "video";

export type NvidiaVisualPayloadDescriptor = {
  source: NvidiaVisualSource;
  consent: boolean;
  frameCount: number;
  payloadBytes: number;
  capturedAt: string;
  reference: string;
};

export type NvidiaVisionObservation = {
  id: string;
  kind: "object" | "track" | "summary" | "answer";
  text: string;
  reference: string;
  frameStart?: number;
  frameEnd?: number;
  untrusted: true;
};

export interface NvidiaVisionProvider {
  readonly provider: string;
  status(input: {
    signal: AbortSignal;
  }): Promise<{
    configured: boolean;
    available: boolean;
    detail: string;
  }>;
}

export function validateNvidiaVisualPayload(
  payload: NvidiaVisualPayloadDescriptor,
) {
  if (!payload.consent) {
    throw new Error("Visual payload requires explicit consent.");
  }
  if (
    !Number.isInteger(payload.frameCount) ||
    payload.frameCount <= 0 ||
    payload.frameCount > NVIDIA_VISION_MAX_FRAMES_PER_REQUEST
  ) {
    throw new Error("Visual frame count is outside the ASTRA bound.");
  }
  if (
    !Number.isInteger(payload.payloadBytes) ||
    payload.payloadBytes <= 0 ||
    payload.payloadBytes > NVIDIA_VISION_MAX_PAYLOAD_BYTES
  ) {
    throw new Error("Visual payload bytes are outside the ASTRA bound.");
  }
  if (!Number.isFinite(Date.parse(payload.capturedAt))) {
    throw new Error("Visual payload capturedAt is invalid.");
  }
  if (!payload.reference.trim()) {
    throw new Error("Visual payload reference is required.");
  }

  return {
    ...payload,
    reference: payload.reference.trim().slice(0, 500),
    visualContentProvided: true as const,
  };
}
