export type NvidiaVoiceState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking";

export type NvidiaVoiceEvent =
  | { type: "voice.listening"; at: number }
  | { type: "voice.transcript.partial"; at: number; text: string }
  | { type: "voice.transcript.final"; at: number; text: string }
  | { type: "voice.thinking"; at: number }
  | { type: "voice.speaking"; at: number }
  | { type: "voice.interrupted"; at: number }
  | { type: "voice.stopped"; at: number }
  | { type: "voice.error"; at: number; detail: string };

export interface NvidiaVoiceTransport {
  readonly provider: string;
  status(input: {
    signal: AbortSignal;
  }): Promise<{
    configured: boolean;
    available: boolean;
    local: boolean;
    detail: string;
  }>;
}

const ALLOWED: Record<NvidiaVoiceState, NvidiaVoiceState[]> = {
  idle: ["listening"],
  listening: ["thinking", "idle"],
  thinking: ["speaking", "idle"],
  speaking: ["listening", "idle"],
};

export function canTransitionNvidiaVoiceState(
  from: NvidiaVoiceState,
  to: NvidiaVoiceState,
) {
  return from === to || ALLOWED[from].includes(to);
}

export function nextNvidiaVoiceState(
  current: NvidiaVoiceState,
  event: NvidiaVoiceEvent,
): NvidiaVoiceState {
  if (
    event.type === "voice.stopped" ||
    event.type === "voice.interrupted" ||
    event.type === "voice.error"
  ) {
    return "idle";
  }

  const target: NvidiaVoiceState =
    event.type === "voice.listening"
      ? "listening"
      : event.type === "voice.thinking"
        ? "thinking"
        : event.type === "voice.speaking"
          ? "speaking"
          : current;

  if (!canTransitionNvidiaVoiceState(current, target)) {
    throw new Error(
      "Invalid NVIDIA voice transition: " + current + " -> " + target + ".",
    );
  }

  return target;
}
