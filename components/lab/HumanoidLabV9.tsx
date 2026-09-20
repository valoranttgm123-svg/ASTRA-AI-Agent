"use client";

import { Canvas } from "@react-three/fiber";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useAstraRuntime } from "@/components/AstraRuntime";
import type { AstraAvatarState } from "@/lib/avatar/types";
import type { AstraBrainEvent, AstraBrainProvider } from "@/lib/brain/types";
import AstraGpuParticles from "./AstraGpuParticles";
import { useFingerTracking, type FingerTrackingTarget } from "./useFingerTracking";

const ARTWORK = "/assets/astra-humanoid/astra-idle-v1.webp";
const SAMPLE_W = 320;
const SAMPLE_H = 194;
const STEP = 2;
const WORLD_W = 7.2;
const WORLD_H = WORLD_W * (SAMPLE_H / SAMPLE_W);
const BASE_POINT_SIZE_HIGH = 2.80;
const BASE_POINT_SIZE_LOW = 1.62;
const GLOW_POINT_SIZE_HIGH = 3.65;
const GLOW_POINT_SIZE_LOW = 2.28;
const ASSEMBLY_DURATION_SECONDS = 2.6;
const ASSEMBLY_WINDOW = 0.34;
const SHOCKWAVE_DURATION_SECONDS = 2.35;

const STATES: AstraAvatarState[] = ["idle", "listening", "thinking", "speaking"];

type ViewMode = "reference" | "particles" | "compare";
type QualityMode = "auto" | "low" | "high";
type RenderQuality = "low" | "high";

type ParticleData = {
  count: number;
  positions: Float32Array;
  colors: Float32Array;
  head: Uint8Array;
  edge: Uint32Array;
  warm: Uint32Array;
  cyan: Uint32Array;
  voiceFace: Uint32Array;
  voiceCore: Uint32Array;
  assemblyPhase: Float32Array;
  assemblySource: Float32Array;
  zones: Uint32Array[];
  original: Float32Array;
};

function hash01(value: number) {
  const raw = Math.sin(value * 12.9898) * 43758.5453;
  return raw - Math.floor(raw);
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function buildParticleData(image: HTMLImageElement): ParticleData {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_W;
  canvas.height = SAMPLE_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D tidak tersedia.");

  ctx.clearRect(0, 0, SAMPLE_W, SAMPLE_H);
  ctx.drawImage(image, 0, 0, SAMPLE_W, SAMPLE_H);
  const pixels = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;

  const pos: number[] = [];
  const col: number[] = [];
  const mask: number[] = [];
  const edgeIndices: number[] = [];
  const warmIndices: number[] = [];
  const cyanIndices: number[] = [];
  const voiceFaceIndices: number[] = [];
  const voiceCoreIndices: number[] = [];
  const assemblyPhaseValues: number[] = [];
  const assemblySourceValues: number[] = [];
  const zoneBuckets: number[][] = Array.from({ length: 6 }, () => []);
  const color = new THREE.Color();

  const sampleBrightness = (sx: number, sy: number) => {
    if (sx < 0 || sy < 0 || sx >= SAMPLE_W || sy >= SAMPLE_H) return 0;
    const si = (sy * SAMPLE_W + sx) * 4;
    return Math.max(pixels[si], pixels[si + 1], pixels[si + 2]) / 255;
  };

  for (let y = 0; y < SAMPLE_H; y += STEP) {
    for (let x = 0; x < SAMPLE_W; x += STEP) {
      const i = (y * SAMPLE_W + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3] / 255;
      const brightness = Math.max(r, g, b) / 255;

      if (a < 0.12 || brightness < 0.045) continue;

      const nx = x / (SAMPLE_W - 1);
      const ny = y / (SAMPLE_H - 1);
      const wx = (nx - 0.5) * WORLD_W;
      const wy = (0.5 - ny) * WORLD_H;

      const hx = (nx - 0.5) / 0.17;
      const hy = (ny - 0.37) / 0.30;
      const rr = hx * hx + hy * hy;
      const isHead = rr <= 1;
      const depth = isHead ? Math.sqrt(Math.max(0, 1 - rr)) * 0.72 : 0;

      const particleIndex = mask.length;
      const isEdge = brightness > 0.1 && (
        sampleBrightness(x - STEP, y) < 0.035 ||
        sampleBrightness(x + STEP, y) < 0.035 ||
        sampleBrightness(x, y - STEP) < 0.035 ||
        sampleBrightness(x, y + STEP) < 0.035
      );
      const isWarm = r > 105 && r > b * 1.55 && g > b * 1.12;
      const isCyan = b > r * 1.12 && g > r * 1.08 && Math.max(g, b) > 75;
      const faceX = Math.abs(nx - 0.5);
      const isVoiceFace =
        isHead &&
        isWarm &&
        ny > 0.30 &&
        ny < 0.55 &&
        faceX < 0.085 &&
        brightness > 0.16;
      const isVoiceCore =
        isWarm &&
        ny > 0.49 &&
        ny < 0.67 &&
        faceX < 0.105 &&
        brightness > 0.12;

      // V12 assembles only the central humanoid. The surrounding approved
      // artwork remains stable while head -> neck -> shoulders -> core arrives
      // from one left-side particle stream.
      const isAssemblyHead = isHead && ny < 0.52;
      const isAssemblyNeck = ny >= 0.47 && ny < 0.65 && faceX < 0.12;
      const isAssemblyShoulders =
        ny >= 0.53 &&
        ny < 0.86 &&
        faceX >= 0.18 &&
        faceX < 0.43;
      const isAssemblyCore =
        ny >= 0.55 &&
        ny < 0.86 &&
        faceX < 0.20;

      const phaseNoise = hash01(particleIndex + 0.73);
      let assemblyPhase = -1;
      if (isAssemblyHead) {
        assemblyPhase = 0.02 + phaseNoise * 0.07;
      } else if (isAssemblyNeck) {
        assemblyPhase = 0.23 + phaseNoise * 0.07;
      } else if (isAssemblyShoulders) {
        assemblyPhase = 0.43 + phaseNoise * 0.09;
      } else if (isAssemblyCore) {
        assemblyPhase = 0.68 + phaseNoise * 0.04;
      }

      if (assemblyPhase >= 0) {
        assemblySourceValues.push(
          -4.45 + (hash01(particleIndex * 1.17 + 2.1) - 0.5) * 0.90,
          (hash01(particleIndex * 1.91 + 4.7) - 0.5) * WORLD_H * 1.22,
          (hash01(particleIndex * 2.37 + 8.3) - 0.5) * 1.45,
        );
      } else {
        assemblySourceValues.push(wx, wy, depth);
      }
      assemblyPhaseValues.push(assemblyPhase);

      const radialX = (nx - 0.5) / 0.52;
      const radialY = (ny - 0.39) / 0.72;
      const radial = Math.sqrt(radialX * radialX + radialY * radialY);
      const zoneIndex = Math.min(5, Math.max(0, Math.floor(radial * 5.4)));

      pos.push(wx, wy, depth);
      color.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
      col.push(color.r, color.g, color.b);
      mask.push(isHead ? 1 : 0);
      if (isEdge) edgeIndices.push(particleIndex);
      if (isWarm) warmIndices.push(particleIndex);
      if (isCyan) cyanIndices.push(particleIndex);
      if (isVoiceFace) voiceFaceIndices.push(particleIndex);
      if (isVoiceCore) voiceCoreIndices.push(particleIndex);
      if (radial <= 1.08) zoneBuckets[zoneIndex].push(particleIndex);
    }
  }

  const positions = new Float32Array(pos);
  return {
    count: positions.length / 3,
    positions,
    original: new Float32Array(positions),
    colors: new Float32Array(col),
    head: new Uint8Array(mask),
    edge: new Uint32Array(edgeIndices),
    warm: new Uint32Array(warmIndices),
    cyan: new Uint32Array(cyanIndices),
    voiceFace: new Uint32Array(voiceFaceIndices),
    voiceCore: new Uint32Array(voiceCoreIndices),
    assemblyPhase: new Float32Array(assemblyPhaseValues),
    assemblySource: new Float32Array(assemblySourceValues),
    zones: zoneBuckets.map((bucket) => new Uint32Array(bucket)),
  };
}

type GpuInfo = {
  renderer: string;
  vendor: string;
  software: boolean;
};

type BrainVisualSignal = {
  eventId: string | null;
  activity: number;
  tone: number;
};

function providerTone(provider: AstraBrainProvider | null): number {
  switch (provider) {
    case "hermes": return 0.36;
    case "ollama": return 0.08;
    case "codex": return 0.62;
    case "cloud": return 0.88;
    case "routing_only": return 0.94;
    default: return 0.05;
  }
}

function brainSignalFor(
  event: AstraBrainEvent | null,
  provider: AstraBrainProvider | null,
): BrainVisualSignal {
  if (!event) return { eventId: null, activity: 0, tone: providerTone(provider) };

  let activity = 0.45;
  let tone = providerTone(provider);
  switch (event.type) {
    case "request.received": activity = 0.52; tone = 0.05; break;
    case "router.selected": activity = 0.64; tone = 0.10; break;
    case "memory.loaded": activity = 0.58; tone = 0.34; break;
    case "skill.selected": activity = 0.64; tone = 0.58; break;
    case "policy.applied": activity = 0.36; tone = 0.48; break;
    case "provider.selected": activity = 0.78; tone = providerTone(provider); break;
    case "agent.started": activity = 0.92; tone = providerTone(provider); break;
    case "agent.completed": activity = 0.68; tone = 0.34; break;
    case "provider.unavailable":
    case "agent.blocked": activity = 0.98; tone = 1.0; break;
    case "response.ready": activity = 0.62; tone = 0.30; break;
  }
  return { eventId: event.id, activity, tone };
}

function ParticleScene({
  data,
  state,
  effects,
  reducedMotion,
  playbackGate,
  quality,
  trackingTarget,
  assemblyRun,
  assemblySkipped,
  brainEventId,
  brainActivity,
  brainTone,
  onAssemblyComplete,
  onShockwaveChange,
  onGpuInfo,
}: {
  data: ParticleData;
  state: AstraAvatarState;
  effects: boolean;
  reducedMotion: boolean;
  playbackGate: number;
  quality: RenderQuality;
  trackingTarget: { current: FingerTrackingTarget };
  assemblyRun: number;
  assemblySkipped: boolean;
  brainEventId: string | null;
  brainActivity: number;
  brainTone: number;
  onAssemblyComplete: () => void;
  onShockwaveChange: (active: boolean) => void;
  onGpuInfo: (info: GpuInfo) => void;
}) {
  return (
    <Canvas
      style={{ position: "absolute", inset: 0 }}
      camera={{ position: [0, 0, 7.2], fov: 38 }}
      dpr={quality === "high" ? 1.5 : 1}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.NoToneMapping;

        const context = gl.getContext();
        const debugInfo = context.getExtension("WEBGL_debug_renderer_info") as
          | { UNMASKED_RENDERER_WEBGL: number; UNMASKED_VENDOR_WEBGL: number }
          | null;
        const renderer = String(
          debugInfo
            ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
            : context.getParameter(context.RENDERER),
        );
        const vendor = String(
          debugInfo
            ? context.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
            : context.getParameter(context.VENDOR),
        );
        onGpuInfo({
          renderer,
          vendor,
          software: /swiftshader|llvmpipe|software/i.test(renderer),
        });
      }}
    >
      <AstraGpuParticles
        data={data}
        state={state}
        effects={effects}
        reducedMotion={reducedMotion}
        playbackGate={playbackGate}
        quality={quality}
        trackingTarget={trackingTarget}
        assemblyRun={assemblyRun}
        assemblySkipped={assemblySkipped}
        brainEventId={brainEventId}
        brainActivity={brainActivity}
        brainTone={brainTone}
        onAssemblyComplete={onAssemblyComplete}
        onShockwaveChange={onShockwaveChange}
      />
    </Canvas>
  );
}

export default function HumanoidLabV9({ onExit }: { onExit?: () => void }) {
  const runtime = useAstraRuntime();
  const reducedMotion = useReducedMotion();
  const [data, setData] = useState<ParticleData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sourceSize, setSourceSize] = useState<string>("loading");
  const [view, setView] = useState<ViewMode>("particles");
  const [effects, setEffects] = useState(true);
  const [technical, setTechnical] = useState(false);
  const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null);
  const [assemblyRun, setAssemblyRun] = useState(1);
  const [assemblySkipped, setAssemblySkipped] = useState(false);
  const [assemblyActive, setAssemblyActive] = useState(true);
  const [shockwaveActive, setShockwaveActive] = useState(false);
  const [gesturesEnabled, setGesturesEnabled] = useState(true);
  const [lastGestureAction, setLastGestureAction] = useState("NONE");
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [sfxReady, setSfxReady] = useState(false);
  const [sfxSupported, setSfxSupported] = useState(true);
  const [qualityMode, setQualityMode] = useState<QualityMode>("auto");
  const [autoLow, setAutoLow] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const fpsFrame = useRef({ frames: 0, started: 0 });
  const preCameraFpsRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sfxEnabledRef = useRef(true);
  const gestureHandledIdRef = useRef(0);

  useEffect(() => {
    sfxEnabledRef.current = sfxEnabled;
  }, [sfxEnabled]);

  const ensureSfxAudio = useCallback(async () => {
    const AudioContextCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) {
      setSfxSupported(false);
      setSfxReady(false);
      return null;
    }

    let context = audioContextRef.current;
    if (!context) {
      context = new AudioContextCtor();
      audioContextRef.current = context;
    }

    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        setSfxReady(false);
        return context;
      }
    }

    setSfxReady(context.state === "running");
    return context;
  }, []);

  const playShockwaveSfx = useCallback(() => {
    if (!sfxEnabledRef.current) return;

    const context = audioContextRef.current;
    if (!context || context.state !== "running") return;

    const now = context.currentTime;
    const master = context.createGain();
    const limiter = context.createDynamicsCompressor();
    const outputGain = context.createGain();

    limiter.threshold.setValueAtTime(-24, now);
    limiter.knee.setValueAtTime(16, now);
    limiter.ratio.setValueAtTime(12, now);
    limiter.attack.setValueAtTime(0.002, now);
    limiter.release.setValueAtTime(0.16, now);
    outputGain.gain.setValueAtTime(1.65, now);

    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(2.25, now + 0.025);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 2.20);
    master.connect(limiter).connect(outputGain).connect(context.destination);

    const coreGain = context.createGain();
    const core = context.createOscillator();
    core.type = "sine";
    core.frequency.setValueAtTime(74, now);
    core.frequency.exponentialRampToValueAtTime(39, now + 0.82);
    coreGain.gain.setValueAtTime(0.0001, now);
    coreGain.gain.exponentialRampToValueAtTime(0.52, now + 0.035);
    coreGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.92);
    core.connect(coreGain).connect(master);
    core.start(now);
    core.stop(now + 0.95);

    const riseGain = context.createGain();
    const rise = context.createOscillator();
    rise.type = "triangle";
    rise.frequency.setValueAtTime(145, now + 0.10);
    rise.frequency.exponentialRampToValueAtTime(680, now + 0.82);
    rise.frequency.exponentialRampToValueAtTime(250, now + 1.42);
    riseGain.gain.setValueAtTime(0.0001, now + 0.08);
    riseGain.gain.exponentialRampToValueAtTime(0.22, now + 0.36);
    riseGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.52);
    rise.connect(riseGain).connect(master);
    rise.start(now + 0.08);
    rise.stop(now + 1.56);

    const noiseDuration = 1.55;
    const noiseBuffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * noiseDuration),
      context.sampleRate,
    );
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) {
      const envelope = 1 - i / channel.length;
      channel[i] = (Math.random() * 2 - 1) * envelope;
    }

    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noise.buffer = noiseBuffer;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(760, now + 0.18);
    noiseFilter.frequency.exponentialRampToValueAtTime(185, now + 1.55);
    noiseFilter.Q.setValueAtTime(0.7, now);
    noiseGain.gain.setValueAtTime(0.0001, now + 0.15);
    noiseGain.gain.exponentialRampToValueAtTime(0.24, now + 0.36);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.70);
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start(now + 0.15);
    noise.stop(now + 1.72);

    const impact = context.createOscillator();
    const impactGain = context.createGain();
    impact.type = "sine";
    impact.frequency.setValueAtTime(118, now + 0.30);
    impact.frequency.exponentialRampToValueAtTime(52, now + 0.62);
    impactGain.gain.setValueAtTime(0.0001, now + 0.29);
    impactGain.gain.exponentialRampToValueAtTime(0.36, now + 0.32);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.69);
    impact.connect(impactGain).connect(master);
    impact.start(now + 0.29);
    impact.stop(now + 0.72);

    // Mid-frequency presence layer so the shockwave remains clearly audible
    // on laptop/monitor speakers that cannot reproduce deep bass efficiently.
    const presence = context.createOscillator();
    const presenceFilter = context.createBiquadFilter();
    const presenceGain = context.createGain();
    presence.type = "sawtooth";
    presence.frequency.setValueAtTime(260, now + 0.18);
    presence.frequency.exponentialRampToValueAtTime(920, now + 0.58);
    presence.frequency.exponentialRampToValueAtTime(360, now + 1.12);
    presenceFilter.type = "bandpass";
    presenceFilter.frequency.setValueAtTime(720, now);
    presenceFilter.Q.setValueAtTime(0.85, now);
    presenceGain.gain.setValueAtTime(0.0001, now + 0.16);
    presenceGain.gain.exponentialRampToValueAtTime(0.18, now + 0.30);
    presenceGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.20);
    presence.connect(presenceFilter).connect(presenceGain).connect(master);
    presence.start(now + 0.16);
    presence.stop(now + 1.24);
  }, []);

  const handleShockwaveChange = useCallback((active: boolean) => {
    setShockwaveActive(active);
    if (active) playShockwaveSfx();
  }, [playShockwaveSfx]);

  const testShockwaveSfx = useCallback(async () => {
    if (!sfxEnabledRef.current) {
      sfxEnabledRef.current = true;
      setSfxEnabled(true);
    }
    const context = await ensureSfxAudio();
    if (!context || context.state !== "running") return;
    playShockwaveSfx();
  }, [ensureSfxAudio, playShockwaveSfx]);

  useEffect(() => {
    const unlock = () => {
      if (sfxEnabledRef.current) void ensureSfxAudio();
    };
    window.addEventListener("pointerdown", unlock, { once: true, capture: true });
    window.addEventListener("keydown", unlock, { once: true, capture: true });

    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, [ensureSfxAudio]);

  useEffect(() => () => {
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") {
      void context.close();
    }
  }, []);

  useEffect(() => {
    const image = new Image();
    image.decoding = "async";
    image.src = `${ARTWORK}?v=9.2-safe-renderer`;
    image.onload = () => {
      try {
        setSourceSize(`${image.naturalWidth}×${image.naturalHeight}`);
        const next = buildParticleData(image);
        if (next.count < 500) {
          throw new Error(`Sampling menghasilkan terlalu sedikit partikel (${next.count}).`);
        }
        setData(next);
        setLoadError(null);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Gagal membaca artwork.");
      }
    };
    image.onerror = () => setLoadError("Artwork ASTRA tidak dapat dimuat.");
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = (time: number) => {
      if (!fpsFrame.current.started) fpsFrame.current.started = time;
      fpsFrame.current.frames += 1;
      const elapsed = time - fpsFrame.current.started;
      if (elapsed >= 1000) {
        setFps(Math.round((fpsFrame.current.frames * 1000) / elapsed));
        fpsFrame.current = { frames: 0, started: time };
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (qualityMode === "auto" && fps !== null && fps < 44) setAutoLow(true);
  }, [fps, qualityMode]);

  const state = runtime.avatarState;
  const runtimeBusy = busy || runtime.orbState === "thinking";
  const latestBrainEvent =
    runtime.brainEvents.length > 0
      ? runtime.brainEvents[runtime.brainEvents.length - 1]
      : null;
  const brainSignal = brainSignalFor(latestBrainEvent, runtime.brainProvider);
  const brainExecution = runtime.lastResponse?.brain.execution ?? "routing_only";
  const brainRequestedMode = runtime.lastResponse?.brain.requestedMode ?? "chat";
  const resolvedQuality: RenderQuality =
    qualityMode === "auto" ? (autoLow ? "low" : "high") : qualityMode;
  const tracking = useFingerTracking(resolvedQuality);
  const showReferenceOnly = view === "reference" || !effects;
  const showParticles = view !== "reference" && effects;
  const referenceOpacity = showReferenceOnly
    ? 1
    : view === "compare"
      ? 1
      : assemblyActive
        ? 0.006
        : 0.028;
  const energyOpacity =
    state === "speaking" ? 0.34 :
    state === "thinking" ? 0.27 :
    state === "listening" ? 0.2 :
    0.12;

  const cycleQuality = () => {
    setQualityMode((currentMode) =>
      currentMode === "auto" ? "high" : currentMode === "high" ? "low" : "auto"
    );
    setAutoLow(false);
  };

  const toggleCamera = () => {
    if (tracking.enabled) {
      tracking.stop();
      return;
    }
    preCameraFpsRef.current = fps;
    void tracking.start();
  };

  const toggleMic = () => {
    if (runtime.micActive) runtime.endListening();
    else runtime.beginListening();
  };

  const replayAssembly = () => {
    if (sfxEnabledRef.current) void ensureSfxAudio();
    setShockwaveActive(false);
    setAssemblySkipped(false);
    setAssemblyActive(!reducedMotion && effects);
    setAssemblyRun((currentRun) => currentRun + 1);
  };

  const skipAssembly = () => {
    setShockwaveActive(false);
    setAssemblySkipped(true);
    setAssemblyActive(false);
  };

  const toggleSfx = () => {
    const next = !sfxEnabledRef.current;
    sfxEnabledRef.current = next;
    setSfxEnabled(next);
    if (next) void ensureSfxAudio();
  };

  useEffect(() => {
    const event = tracking.gestureEvent;
    if (!event) return;

    // Consume events while gesture actions are disabled so an old gesture
    // cannot fire immediately when GESTURES is turned back on.
    if (!gesturesEnabled) {
      gestureHandledIdRef.current = event.id;
      return;
    }

    if (gestureHandledIdRef.current === event.id) return;
    gestureHandledIdRef.current = event.id;

    if (event.gesture === "pinch") {
      setLastGestureAction("PINCH → REPLAY ASSEMBLY");
      setShockwaveActive(false);
      setAssemblySkipped(false);
      setAssemblyActive(!reducedMotion && effects);
      setAssemblyRun((currentRun) => currentRun + 1);
      return;
    }

    if (event.gesture === "open_palm") {
      if (!runtime.micSupported) {
        setLastGestureAction("OPEN PALM → MIC N/A");
        return;
      }
      if (runtime.micActive) {
        setLastGestureAction("OPEN PALM → ALREADY LISTENING");
        return;
      }
      setLastGestureAction("OPEN PALM → LISTENING");
      runtime.beginListening();
      return;
    }

    if (event.gesture === "fist") {
      setLastGestureAction("FIST → STOP");
      runtime.stopInteraction();
    }
  }, [
    effects,
    gesturesEnabled,
    reducedMotion,
    runtime.beginListening,
    runtime.micActive,
    runtime.micSupported,
    runtime.stopInteraction,
    tracking.gestureEvent,
  ]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = message.trim();
    if (!value || runtimeBusy) return;
    setBusy(true);
    const started = performance.now();
    try {
      await runtime.send(value);
      setLatency(Math.round(performance.now() - started));
      setMessage("");
    } catch (error) {
      setLatency(Math.round(performance.now() - started));
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        // Runtime owns the visible error state; keep the lab responsive.
      }
    } finally {
      setBusy(false);
    }
  };

  const executeTask = async () => {
    const value = message.trim();
    if (!value || runtimeBusy) return;
    setBusy(true);
    const started = performance.now();
    try {
      await runtime.execute(value);
      setLatency(Math.round(performance.now() - started));
      setMessage("");
    } catch (error) {
      setLatency(Math.round(performance.now() - started));
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        // Runtime owns the visible error state; keep the lab responsive.
      }
    } finally {
      setBusy(false);
    }
  };

  const exit = () => {
    tracking.stop();
    if (onExit) onExit();
    else window.location.href = "/";
  };

  return (
    <main
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#000306",
        color: "#dffbff",
        fontFamily: "var(--font-mono)",
      }}
    >
      <img
        src={`${ARTWORK}?v=9.2-safe-renderer`}
        alt="Approved ASTRA idle artwork reference"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          opacity: referenceOpacity,
          transition: "opacity 180ms ease",
          pointerEvents: "none",
        }}
      />

      {showParticles && effects && (
        <>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "radial-gradient(circle at 50% 38%, rgba(255,132,35,.28) 0%, rgba(255,132,35,.08) 10%, transparent 27%), radial-gradient(ellipse at 50% 64%, rgba(45,225,255,.12) 0%, transparent 50%)",
              opacity: energyOpacity,
              transition: "opacity 220ms ease",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: resolvedQuality === "high" ? 0.055 : 0.025,
              background:
                "repeating-linear-gradient(180deg, rgba(90,235,255,.22) 0px, rgba(90,235,255,.22) 1px, transparent 1px, transparent 5px)",
            }}
          />
        </>
      )}

      {showParticles && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: view === "compare" ? "inset(0 0 0 50%)" : "none",
            pointerEvents: "auto",
          }}
        >
          {data ? (
            <ParticleScene
              data={data}
              state={state}
              effects
              reducedMotion={reducedMotion}
              playbackGate={runtime.speechLevel}
              quality={resolvedQuality}
              trackingTarget={tracking.targetRef}
              assemblyRun={assemblyRun}
              assemblySkipped={assemblySkipped}
              brainEventId={brainSignal.eventId}
              brainActivity={brainSignal.activity}
              brainTone={brainSignal.tone}
              onAssemblyComplete={() => setAssemblyActive(false)}
              onShockwaveChange={handleShockwaveChange}
              onGpuInfo={setGpuInfo}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                color: loadError ? "#ffb35f" : "#5cdcea",
                letterSpacing: ".16em",
                fontSize: 11,
                textAlign: "center",
                padding: 24,
              }}
            >
              {loadError ?? "SAMPLING APPROVED ARTWORK..."}
            </div>
          )}
        </div>
      )}

      {view === "compare" && effects && (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "50%",
            width: 1,
            background: "rgba(255,255,255,.42)",
            pointerEvents: "none",
          }}
        />
      )}

      <header style={{ position: "absolute", top: 18, left: 20, zIndex: 20, textShadow: "0 1px 12px #000" }}>
        <div style={{ fontSize: 11, letterSpacing: ".28em", color: "#61efff" }}>ASTRA MAX // HUMANOID V15</div>
        <div style={{ marginTop: 6, fontSize: 10, letterSpacing: ".18em", color: "rgba(223,251,255,.55)" }}>
          REAL-TIME BRAIN TELEMETRY // SSE
        </div>
      </header>

      <aside
        aria-label="ASTRA Brain link status"
        style={{
          position: "absolute",
          top: 16,
          right: 92,
          zIndex: 20,
          minWidth: 210,
          padding: "8px 10px",
          border: "1px solid rgba(87,231,248,.2)",
          borderRadius: 10,
          background: "rgba(0,7,11,.86)",
          textAlign: "right",
          pointerEvents: "none",
        }}
      >
        <div style={{ color: "#69edff", fontSize: 8.5, letterSpacing: ".17em" }}>
          {`BRAIN LINK // ${runtime.brainStreaming ? "LIVE" : "READY"} // ${(runtime.brainProvider ?? "standby").toUpperCase()}`}
        </div>
        <div style={{ marginTop: 4, color: "rgba(229,250,255,.72)", fontSize: 9 }}>
          {latestBrainEvent?.label ?? "No Brain event yet"}
        </div>
        <div style={{ marginTop: 2, color: "rgba(217,244,250,.42)", fontSize: 8 }}>
          {(latestBrainEvent?.agent ?? "chief_of_staff").replace(/_/g, " ")} · {brainRequestedMode.toUpperCase()} · {brainExecution.toUpperCase()}
        </div>
      </aside>

      <button onClick={exit} style={exitStyle}>EXIT</button>

      <section
        style={{
          position: "absolute",
          left: 18,
          right: 18,
          bottom: 18,
          zIndex: 25,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 18,
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "grid", gap: 9, pointerEvents: "auto" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {STATES.map((item) => (
              <button key={item} onClick={() => runtime.setAvatarState(item)} style={buttonStyle(state === item)}>
                {item.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {(["reference", "particles", "compare"] as ViewMode[]).map((item) => (
              <button key={item} onClick={() => setView(item)} style={buttonStyle(view === item)}>
                {item.toUpperCase()}
              </button>
            ))}
            <button onClick={() => setEffects((value) => !value)} style={buttonStyle(!effects)}>
              {effects ? "EFFECTS ON" : "EFFECTS OFF"}
            </button>
            <button onClick={cycleQuality} style={buttonStyle(qualityMode !== "auto")}>
              QUALITY {qualityMode.toUpperCase()}
            </button>
            <button onClick={replayAssembly} style={buttonStyle(assemblyActive)}>
              REPLAY ASSEMBLY
            </button>
            <button
              onClick={skipAssembly}
              disabled={!assemblyActive}
              style={{ ...buttonStyle(false), opacity: assemblyActive ? 1 : 0.45 }}
            >
              SKIP
            </button>
            <button onClick={toggleCamera} style={buttonStyle(tracking.enabled)}>
              {tracking.enabled ? "CAMERA OFF" : "CAMERA ON"}
            </button>
            <button
              onClick={() => setGesturesEnabled((value) => !value)}
              style={buttonStyle(gesturesEnabled)}
            >
              {gesturesEnabled ? "GESTURES ON" : "GESTURES OFF"}
            </button>
            <button
              onClick={toggleMic}
              disabled={!runtime.micSupported}
              style={{ ...buttonStyle(runtime.micActive), opacity: runtime.micSupported ? 1 : 0.45 }}
            >
              {runtime.micActive ? "STOP MIC" : runtime.micSupported ? "MIC" : "MIC N/A"}
            </button>
            <button
              onClick={() => runtime.setVoiceEnabled(!runtime.voiceEnabled)}
              style={buttonStyle(runtime.voiceEnabled)}
            >
              {runtime.voiceEnabled ? "VOICE ON" : "VOICE OFF"}
            </button>
            <button
              onClick={toggleSfx}
              disabled={!sfxSupported}
              style={{
                ...buttonStyle(sfxEnabled && sfxReady),
                opacity: sfxSupported ? 1 : 0.45,
              }}
            >
              {!sfxSupported
                ? "SFX N/A"
                : !sfxEnabled
                  ? "SFX OFF"
                  : sfxReady
                    ? "SFX ON"
                    : "SFX ARM"}
            </button>
            <button
              onClick={() => void testShockwaveSfx()}
              disabled={!sfxSupported}
              style={{ ...buttonStyle(false), opacity: sfxSupported ? 1 : 0.45 }}
            >
              TEST SFX
            </button>
            <span
              style={{
                alignSelf: "center",
                padding: "0 4px",
                color: tracking.error ? "#ffb35f" : tracking.handFound ? "#83ffbc" : tracking.enabled ? "#68ebff" : "rgba(128,234,247,.48)",
                fontSize: 9,
                letterSpacing: ".12em",
                textShadow: "0 0 12px currentColor",
              }}
            >
              ● {tracking.handFound ? "HAND FOUND" : tracking.status.toUpperCase()}
            </span>
            <span
              style={{
                alignSelf: "center",
                padding: "0 4px",
                color:
                  tracking.gesture === "pinch"
                    ? "#ffc364"
                    : tracking.gesture === "open_palm"
                      ? "#83ffbc"
                      : tracking.gesture === "fist"
                        ? "#ff8f78"
                        : "rgba(128,234,247,.48)",
                fontSize: 9,
                letterSpacing: ".12em",
                textShadow: "0 0 12px currentColor",
              }}
            >
              ● GESTURE {gesturesEnabled ? tracking.gesture.toUpperCase().replace("_", " ") : "OFF"}
            </span>
            <span
              style={{
                alignSelf: "center",
                padding: "0 4px",
                color: assemblyActive
                  ? "#ffc364"
                  : shockwaveActive
                    ? "#66efff"
                    : "rgba(128,234,247,.48)",
                fontSize: 9,
                letterSpacing: ".12em",
                textShadow: "0 0 12px currentColor",
              }}
            >
              ● {assemblyActive ? "ASSEMBLING" : shockwaveActive ? "CORE SHOCKWAVE" : "ASSEMBLY READY"}
            </span>
            <button onClick={() => setTechnical((value) => !value)} style={buttonStyle(technical)}>
              TECHNICAL
            </button>
          </div>
          {tracking.error && (
            <div style={{ maxWidth: 430, color: "#ffb35f", fontSize: 9, lineHeight: 1.45, letterSpacing: ".04em" }}>
              CAMERA: {tracking.error}
            </div>
          )}
          {runtime.micError && (
            <div style={{ maxWidth: 430, color: "#ffb35f", fontSize: 9, lineHeight: 1.45, letterSpacing: ".04em" }}>
              MIC: {runtime.micError}
            </div>
          )}
        </div>

        <div style={consoleStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 9, letterSpacing: ".18em", color: "#65eafb" }}>
            <span>{runtime.activeAgent ?? "ASTRA CORE"}</span>
            <span>
              {(runtime.brainProvider ?? "standby").toUpperCase()} · {
                runtime.lastResponse?.brain.requestedMode === "execute"
                  ? runtime.lastResponse.brain.execution.toUpperCase()
                  : state.toUpperCase()
              }
            </span>
          </div>
          <div style={{ marginTop: 5, color: "rgba(198,240,247,.42)", fontSize: 8.5, letterSpacing: ".05em" }}>
            BRAIN EVENT: {latestBrainEvent ? latestBrainEvent.type + " · " + latestBrainEvent.label : "standby"}
          </div>
          <div style={{ minHeight: 42, marginTop: 10, color: "rgba(225,250,255,.72)", fontSize: 11, lineHeight: 1.5 }}>
            {runtime.micActive
              ? (runtime.micTranscript || "Silakan bicara...")
              : runtime.lastResponse?.message ?? "Approved artwork is driving the humanoid particle field."}
          </div>
          <form onSubmit={submit} style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ketik perintah ASTRA..."
              style={inputStyle}
            />
            <button
              disabled={runtimeBusy || !message.trim()}
              type="button"
              onClick={() => void executeTask()}
              style={{ ...buttonStyle(true), opacity: runtimeBusy ? 0.55 : 1 }}
              title="Approve and execute this task with permitted local tools"
            >
              {runtimeBusy ? "RUN" : "EXECUTE"}
            </button>
            <button
              disabled={runtimeBusy || !message.trim()}
              type="submit"
              style={{ ...buttonStyle(false), opacity: runtimeBusy ? 0.55 : 1 }}
            >
              {runtimeBusy ? "RUN" : "SEND"}
            </button>
          </form>
        </div>
      </section>

      {technical && (
        <aside style={technicalStyle}>
          <div style={{ color: "#5eeaff", letterSpacing: ".18em", marginBottom: 8 }}>TECHNICAL DETAILS</div>
          <div>Artwork: astra-idle-v1.webp</div>
          <div>Source: {sourceSize}</div>
          <div>Sampler: {SAMPLE_W}×{SAMPLE_H}, step {STEP}px</div>
          <div>Particles: {data?.count ?? "loading"}</div>
          <div>Quality: {qualityMode.toUpperCase()} → {resolvedQuality.toUpperCase()}</div>
          <div>Base point: {resolvedQuality === "high" ? BASE_POINT_SIZE_HIGH : BASE_POINT_SIZE_LOW}px</div>
          <div>Glow point: {resolvedQuality === "high" ? GLOW_POINT_SIZE_HIGH : GLOW_POINT_SIZE_LOW}px</div>
          <div>Edge samples: {data?.edge.length ?? "loading"}</div>
          <div>Warm/core samples: {data?.warm.length ?? "loading"}</div>
          <div>Cyan samples: {data?.cyan.length ?? "loading"}</div>
          <div>Voice face samples: {data?.voiceFace.length ?? "loading"}</div>
          <div>Voice core samples: {data?.voiceCore.length ?? "loading"}</div>
          <div>State radial zones: {data?.zones.length ?? "loading"}</div>
          <div>State transition: 680 ms radial face-out</div>
          <div>Brain provider: {(runtime.brainProvider ?? "standby").toUpperCase()}</div>
          <div>Brain transport: SSE / {runtime.brainStreaming ? "LIVE" : "IDLE"}</div>
          <div>Brain mode: {brainRequestedMode.toUpperCase()} / {brainExecution.toUpperCase()}</div>
          <div>Brain event count: {runtime.brainEvents.length}</div>
          <div>Brain latest event: {latestBrainEvent ? latestBrainEvent.type + " / " + latestBrainEvent.label : "NONE"}</div>
          <div>Brain latest agent: {latestBrainEvent?.agent ?? "—"}</div>
          <div>Brain visual pulse: truthful runtime/backend events only</div>
          <div>Brain tool telemetry: not fabricated when provider does not expose it</div>
          <div>Brain context memory: {runtime.lastResponse?.brain.context?.memoryEntries ?? 0} entries</div>
          <div>Brain context skills: {runtime.lastResponse?.brain.context?.skills.join(", ") || "—"}</div>
          <div>Assembly duration: {ASSEMBLY_DURATION_SECONDS.toFixed(1)} s</div>
          <div>Assembly order: head → neck → shoulders → core</div>
          <div>Assembly source: single left-side particle stream</div>
          <div>Assembly state: {assemblyActive ? "RUNNING" : assemblySkipped ? "SKIPPED" : "READY"}</div>
          <div>Final shockwave: {shockwaveActive ? "RUNNING" : "IDLE"}</div>
          <div>Shockwave duration: {SHOCKWAVE_DURATION_SECONDS.toFixed(2)} s</div>
          <div>Shockwave path: warm core lock → cyan/orange radial ring → fade</div>
          <div>Shockwave renderer: existing 2-pass GPU shader / no extra mesh</div>
          <div>Shockwave SFX: {!sfxSupported ? "UNSUPPORTED" : !sfxEnabled ? "OFF" : sfxReady ? "READY" : "WAITING FOR USER GESTURE"}</div>
          <div>SFX engine: Web Audio API / synthesized / no external audio asset</div>
          <div>SFX output: high-gain master → compressor limiter → +4.3 dB output stage</div>
          <div>SFX layers: boosted core + rise + filtered noise + impact + mid presence</div>
          <div>SFX test: TEST SFX button plays immediately after browser audio unlock</div>
          <div>Playback active: {runtime.playbackActive ? "YES" : "NO"}</div>
          <div>Playback gate: {runtime.speechLevel.toFixed(0)} (event-driven, not loudness)</div>
          <div>Voice face driver: smoothed playback envelope + visual cadence</div>
          <div>Pause behavior: reactive face/core fades while playback gate is 0</div>
          <div>Mic support: {runtime.micSupported ? "YES" : "NO"}</div>
          <div>Mic active: {runtime.micActive ? "YES" : "NO"}</div>
          <div>Mic transcript: {runtime.micTranscript || "—"}</div>
          <div>Base blend: Normal</div>
          <div>Energy layers: Additive</div>
          <div>DPR: {resolvedQuality === "high" ? "1.5" : "1.0"}</div>
          <div>MSAA: OFF (shader-smoothed round particles)</div>
          <div>GPU renderer: {gpuInfo?.renderer ?? "detecting..."}</div>
          <div>GPU vendor: {gpuInfo?.vendor ?? "detecting..."}</div>
          <div>Software renderer: {gpuInfo ? (gpuInfo.software ? "YES — performance warning" : "NO") : "detecting..."}</div>
          <div>Particle profile: crisp core + brighter midtones + soft rim</div>
          <div>Luminance remap: gamma 0.72 / capped highlight normalization</div>
          <div>Particle sprite: GPU gl_PointCoord round mask</div>
          <div>Assembly easing: quintic smootherstep / deterministic curve</div>
          <div>FPS: {fps ?? "..."}</div>
          <div>Pre-camera FPS: {preCameraFpsRef.current ?? "not measured"}</div>
          <div>Camera: {tracking.enabled ? "ON" : "OFF"} / {tracking.status.toUpperCase()}</div>
          <div>Hand: {tracking.handFound ? "FOUND" : "NOT FOUND"}</div>
          <div>Hand delegate: {tracking.delegate ?? "not loaded"}</div>
          <div>Gesture control: {gesturesEnabled ? "ON" : "OFF"}</div>
          <div>Gesture stable: {tracking.gesture.toUpperCase().replace("_", " ")}</div>
          <div>Gesture action: {lastGestureAction}</div>
          <div>Gesture mapping: PINCH → replay / OPEN PALM → mic / FIST → stop</div>
          <div>Gesture debounce: 3 stable frames + mandatory neutral release + 900 ms cooldown</div>
          <div>Pinch ratio: {tracking.pinchRatio === null ? "..." : tracking.pinchRatio.toFixed(2)}</div>
          <div>Extended fingers: {tracking.extendedFingers ?? "..."}</div>
          <div>Tracking FPS: {tracking.trackingFps ?? "..."}</div>
          <div>Inference: {tracking.processingMs === null ? "..." : `${tracking.processingMs} ms`}</div>
          <div>Tracking privacy: frames processed locally; no recording/upload by ASTRA.</div>
          <div>Last request latency: {latency === null ? "not measured" : `${latency} ms`}</div>
          <div>Brain request mode: {runtime.lastResponse?.brain.requestedMode?.toUpperCase() ?? "CHAT"}</div>
          <div>Brain execution: {runtime.lastResponse?.brain.execution.toUpperCase() ?? "STANDBY"}</div>
          <div>Brain provider: {(runtime.brainProvider ?? "standby").toUpperCase()}</div>
          <div>
            Brain event: {runtime.brainEvents.length
              ? runtime.brainEvents[runtime.brainEvents.length - 1].label
              : "none"}
          </div>
          <div>Reduced motion: {reducedMotion ? "ON" : "OFF"}</div>
          <div>Effects: {effects ? "ON" : "OFF"}</div>
          <div>Renderer: Three.js via React Three Fiber</div>
          <div>Particle motion: GPU vertex shader</div>
          <div>Particle shape/color: GPU fragment shader</div>
          <div>Draw passes: 2 (base + glow), no per-frame geometry sync</div>
          <div>Color: sRGB input/output, NoToneMapping</div>
          {loadError && <div style={{ marginTop: 8, color: "#ffb35f" }}>Load error: {loadError}</div>}
          <div style={{ marginTop: 9, color: "rgba(255,190,90,.8)" }}>
            V15 upgrades the shared Brain Event Bus to real-time SSE delivery. Humanoid and Command Center now receive request, route, context, provider, fallback, agent, blocked, and response lifecycle events as the backend reaches those stages. GPU Brain pulses still use the same two draw passes, and tool-level telemetry is still not fabricated when a provider does not expose it.
          </div>
        </aside>
      )}
    </main>
  );
}

const exitStyle: React.CSSProperties = {
  position: "absolute",
  top: 16,
  right: 18,
  zIndex: 30,
  border: "1px solid rgba(97,239,255,.55)",
  background: "rgba(0,8,12,.78)",
  color: "#aaf8ff",
  borderRadius: 18,
  padding: "8px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: ".16em",
  cursor: "pointer",
};

const consoleStyle: React.CSSProperties = {
  width: "min(440px, 44vw)",
  minWidth: 280,
  pointerEvents: "auto",
  border: "1px solid rgba(54,228,247,.28)",
  background: "rgba(0,7,11,.94)",
  borderRadius: 14,
  padding: 12,
  boxShadow: "0 16px 60px rgba(0,0,0,.34)",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "1px solid rgba(98,221,239,.22)",
  borderRadius: 8,
  background: "rgba(3,16,22,.9)",
  color: "#e8fdff",
  padding: "10px 11px",
  fontFamily: "inherit",
  outline: "none",
};

const technicalStyle: React.CSSProperties = {
  position: "absolute",
  top: 64,
  right: 18,
  width: 300,
  zIndex: 24,
  border: "1px solid rgba(79,220,239,.25)",
  background: "rgba(0,7,11,.96)",
  borderRadius: 12,
  padding: 14,
  fontSize: 10,
  lineHeight: 1.75,
  color: "rgba(220,248,252,.68)",
};

function buttonStyle(active: boolean): React.CSSProperties {
  return {
    border: `1px solid ${active ? "rgba(255,177,49,.85)" : "rgba(81,221,241,.3)"}`,
    background: active ? "rgba(255,157,28,.13)" : "rgba(0,10,15,.76)",
    color: active ? "#ffc364" : "#80eaf7",
    borderRadius: 7,
    padding: "8px 10px",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: ".13em",
    cursor: "pointer",
  };
}
