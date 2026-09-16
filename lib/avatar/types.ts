export type AstraAvatarState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "executing"
  | "success"
  | "error";

export type AstraAvatarSignal = {
  state: AstraAvatarState;
  speechLevel: number;
  updatedAt: number;
};

export const AVATAR_STATE_LABEL: Record<AstraAvatarState, string> = {
  idle: "IDLE",
  listening: "LISTENING",
  thinking: "THINKING",
  speaking: "SPEAKING",
  executing: "EXECUTING",
  success: "SUCCESS",
  error: "ERROR",
};
