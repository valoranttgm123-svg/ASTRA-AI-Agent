/// <reference lib="webworker" />

import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let landmarker: HandLandmarker | null = null;
let delegate: "GPU" | "CPU" = "CPU";
let initialized = false;

type GestureName = "none" | "pinch" | "open_palm" | "fist";

type LandmarkLike = {
  x: number;
  y: number;
  z?: number;
};

function distance2D(a?: LandmarkLike, b?: LandmarkLike) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function classifyGesture(hand?: LandmarkLike[]): {
  gesture: GestureName;
  pinchRatio: number;
  extendedFingers: number;
} {
  if (!hand || hand.length < 21) {
    return { gesture: "none", pinchRatio: 99, extendedFingers: 0 };
  }

  const wrist = hand[0];
  const palmWidth = Math.max(distance2D(hand[5], hand[17]), 0.035);
  const pinchRatio = distance2D(hand[4], hand[8]) / palmWidth;

  const fingers = [
    { tip: 8, pip: 6 },
    { tip: 12, pip: 10 },
    { tip: 16, pip: 14 },
    { tip: 20, pip: 18 },
  ];

  let extendedFingers = 0;
  for (const finger of fingers) {
    const tipDistance = distance2D(wrist, hand[finger.tip]);
    const pipDistance = distance2D(wrist, hand[finger.pip]);
    if (tipDistance > pipDistance * 1.16) {
      extendedFingers += 1;
    }
  }

  if (pinchRatio < 0.42) {
    return { gesture: "pinch", pinchRatio, extendedFingers };
  }

  if (extendedFingers >= 4) {
    return { gesture: "open_palm", pinchRatio, extendedFingers };
  }

  const avgTipDistance =
    (distance2D(wrist, hand[8]) +
      distance2D(wrist, hand[12]) +
      distance2D(wrist, hand[16]) +
      distance2D(wrist, hand[20])) /
    4 /
    palmWidth;

  if (extendedFingers <= 1 && avgTipDistance < 2.45) {
    return { gesture: "fist", pinchRatio, extendedFingers };
  }

  return { gesture: "none", pinchRatio, extendedFingers };
}

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
    const hand = result.landmarks?.[0] as LandmarkLike[] | undefined;
    const tip = hand?.[8];
    const gesture = classifyGesture(hand);

    self.postMessage({
      type: "result",
      found: Boolean(tip),
      x: tip?.x ?? 0.5,
      y: tip?.y ?? 0.5,
      gesture: gesture.gesture,
      pinchRatio: gesture.pinchRatio,
      extendedFingers: gesture.extendedFingers,
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
