"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TrackingQuality = "low" | "high";

export type FingerTrackingTarget = {
  enabled: boolean;
  active: boolean;
  x: number;
  y: number;
};

export type FingerTrackingStatus =
  | "off"
  | "requesting"
  | "loading"
  | "active"
  | "error"
  | "unsupported";

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "Izin kamera ditolak.";
    if (error.name === "NotFoundError") return "Kamera tidak ditemukan.";
    if (error.name === "NotReadableError") return "Kamera sedang dipakai aplikasi lain.";
  }
  return error instanceof Error ? error.message : "Kamera tidak dapat dimulai.";
}

export function useFingerTracking(quality: TrackingQuality) {
  const targetRef = useRef<FingerTrackingTarget>({
    enabled: false,
    active: false,
    x: 0,
    y: 0,
  });
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workerBusyRef = useRef(false);
  const qualityRef = useRef<TrackingQuality>(quality);
  const resultCounterRef = useRef({ count: 0, started: 0 });
  const runningRef = useRef(false);

  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<FingerTrackingStatus>("off");
  const [handFound, setHandFound] = useState(false);
  const [delegate, setDelegate] = useState<"GPU" | "CPU" | null>(null);
  const [processingMs, setProcessingMs] = useState<number | null>(null);
  const [trackingFps, setTrackingFps] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    qualityRef.current = quality;
  }, [quality]);

  const clearResources = useCallback((updateState: boolean) => {
    runningRef.current = false;
    workerBusyRef.current = false;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const worker = workerRef.current;
    workerRef.current = null;
    if (worker) {
      try {
        worker.postMessage({ type: "stop" });
      } catch {
        // Worker may already be shutting down.
      }
      worker.terminate();
    }

    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());

    const video = videoRef.current;
    videoRef.current = null;
    if (video) {
      video.pause();
      video.srcObject = null;
    }

    targetRef.current.enabled = false;
    targetRef.current.active = false;
    targetRef.current.x = 0;
    targetRef.current.y = 0;

    if (updateState) {
      setEnabled(false);
      setHandFound(false);
      setDelegate(null);
      setProcessingMs(null);
      setTrackingFps(null);
      setStatus("off");
    }
  }, []);

  const stop = useCallback(() => {
    clearResources(true);
    setError(null);
  }, [clearResources]);

  const start = useCallback(async () => {
    if (runningRef.current) return;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof Worker === "undefined" ||
      typeof createImageBitmap === "undefined"
    ) {
      setStatus("unsupported");
      setError("Browser ini tidak mendukung pipeline kamera/worker yang dibutuhkan.");
      return;
    }

    setError(null);
    setStatus("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 320, max: 640 },
          height: { ideal: 240, max: 480 },
          frameRate: { ideal: 20, max: 24 },
          facingMode: "user",
        },
      });

      streamRef.current = stream;
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.srcObject = stream;
      videoRef.current = video;
      await video.play();

      runningRef.current = true;
      targetRef.current.enabled = true;
      setEnabled(true);
      setStatus("loading");

      const worker = new Worker(new URL("./handTracker.worker.ts", import.meta.url), {
        type: "module",
      });
      workerRef.current = worker;

      const scheduleNext = () => {
        if (!runningRef.current) return;
        const interval = qualityRef.current === "high" ? 66 : 100;
        timerRef.current = setTimeout(captureFrame, interval);
      };

      const captureFrame = async () => {
        if (!runningRef.current) return;
        const currentWorker = workerRef.current;
        const currentVideo = videoRef.current;

        if (
          !currentWorker ||
          !currentVideo ||
          currentVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
          workerBusyRef.current
        ) {
          scheduleNext();
          return;
        }

        workerBusyRef.current = true;
        try {
          const bitmap = await createImageBitmap(currentVideo);
          if (!runningRef.current || !workerRef.current) {
            bitmap.close();
            return;
          }
          workerRef.current.postMessage(
            { type: "frame", bitmap, timestamp: performance.now() },
            [bitmap],
          );
        } catch {
          workerBusyRef.current = false;
        } finally {
          scheduleNext();
        }
      };

      worker.onmessage = (event: MessageEvent) => {
        const message = event.data as {
          type: string;
          delegate?: "GPU" | "CPU";
          found?: boolean;
          x?: number;
          y?: number;
          processingMs?: number;
          message?: string;
        };

        if (message.type === "ready") {
          setDelegate(message.delegate ?? "CPU");
          setStatus("active");
          scheduleNext();
          return;
        }

        if (message.type === "result") {
          workerBusyRef.current = false;
          const found = Boolean(message.found);
          setHandFound(found);
          setProcessingMs(
            typeof message.processingMs === "number"
              ? Math.round(message.processingMs * 10) / 10
              : null,
          );

          const now = performance.now();
          if (!resultCounterRef.current.started) resultCounterRef.current.started = now;
          resultCounterRef.current.count += 1;
          const elapsed = now - resultCounterRef.current.started;
          if (elapsed >= 1000) {
            setTrackingFps(
              Math.round((resultCounterRef.current.count * 1000) / elapsed),
            );
            resultCounterRef.current = { count: 0, started: now };
          }

          if (found && typeof message.x === "number" && typeof message.y === "number") {
            // Mirror X for a natural "mirror" interaction.
            const nextX = (1 - message.x) * 2 - 1;
            const nextY = 1 - message.y * 2;
            const current = targetRef.current;
            current.x += (nextX - current.x) * 0.34;
            current.y += (nextY - current.y) * 0.34;
            current.active = true;
          } else {
            targetRef.current.active = false;
          }
          return;
        }

        if (message.type === "error") {
          workerBusyRef.current = false;
          setError(message.message ?? "Hand tracking gagal.");
          setStatus("error");
          targetRef.current.active = false;
        }
      };

      worker.onerror = (event) => {
        workerBusyRef.current = false;
        setError(event.message || "Worker hand tracking gagal.");
        setStatus("error");
        targetRef.current.active = false;
      };

      worker.postMessage({ type: "init" });
    } catch (startError) {
      clearResources(false);
      setEnabled(false);
      setHandFound(false);
      setStatus("error");
      setError(cameraErrorMessage(startError));
    }
  }, [clearResources]);

  useEffect(() => {
    return () => clearResources(false);
  }, [clearResources]);

  return {
    targetRef,
    enabled,
    status,
    handFound,
    delegate,
    processingMs,
    trackingFps,
    error,
    start,
    stop,
  };
}
