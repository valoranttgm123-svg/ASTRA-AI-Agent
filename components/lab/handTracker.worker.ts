/// <reference lib="webworker" />

import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let landmarker: HandLandmarker | null = null;
let delegate: "GPU" | "CPU" = "CPU";
let initialized = false;

async function createLandmarker(preferred: "GPU" | "CPU") {
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: preferred,
    },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

async function init() {
  if (initialized && landmarker) return;
  try {
    landmarker = await createLandmarker("GPU");
    delegate = "GPU";
  } catch {
    landmarker = await createLandmarker("CPU");
    delegate = "CPU";
  }
  initialized = true;
  self.postMessage({ type: "ready", delegate });
}

async function handleFrame(bitmap: ImageBitmap, timestamp: number) {
  if (!landmarker) {
    bitmap.close();
    return;
  }

  const started = performance.now();
  try {
    const result = landmarker.detectForVideo(bitmap, timestamp);
    const hand = result.landmarks?.[0];
    const tip = hand?.[8];

    self.postMessage({
      type: "result",
      found: Boolean(tip),
      x: tip?.x ?? 0.5,
      y: tip?.y ?? 0.5,
      processingMs: performance.now() - started,
      timestamp,
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Hand tracking failed.",
    });
  } finally {
    bitmap.close();
  }
}

self.onmessage = async (event: MessageEvent) => {
  const message = event.data as
    | { type: "init" }
    | { type: "frame"; bitmap: ImageBitmap; timestamp: number }
    | { type: "stop" };

  if (message.type === "init") {
    try {
      await init();
    } catch (error) {
      self.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : "MediaPipe initialization failed.",
      });
    }
    return;
  }

  if (message.type === "frame") {
    await handleFrame(message.bitmap, message.timestamp);
    return;
  }

  if (message.type === "stop") {
    landmarker?.close();
    landmarker = null;
    initialized = false;
    self.postMessage({ type: "stopped" });
  }
};

export {};
