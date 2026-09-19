"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useAstraRuntime } from "@/components/AstraRuntime";
import type { AstraAvatarState } from "@/lib/avatar/types";
import { useFingerTracking, type FingerTrackingTarget } from "./useFingerTracking";

const ARTWORK = "/assets/astra-humanoid/astra-idle-v1.webp";
const SAMPLE_W = 320;
const SAMPLE_H = 194;
const STEP = 2;
const WORLD_W = 7.2;
const WORLD_H = WORLD_W * (SAMPLE_H / SAMPLE_W);
const HEAD_CENTER_Y = (0.5 - 0.37) * WORLD_H;
const BASE_POINT_SIZE_HIGH = 1.7;
const BASE_POINT_SIZE_LOW = 1.25;
const GLOW_POINT_SIZE_HIGH = 3.6;
const GLOW_POINT_SIZE_LOW = 2.5;

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
  zones: Uint32Array[];
  original: Float32Array;
};

type StateProfile = {
  cyan: number;
  warm: number;
  field: number;
  scan: number;
  zone: number;
  tone: number;
};

const STATE_PROFILES: Record<"idle" | "listening" | "thinking" | "speaking", StateProfile> = {
  idle: { cyan: 0.08, warm: 0.10, field: 0.08, scan: 0.03, zone: 0.05, tone: 0.30 },
  listening: { cyan: 0.40, warm: 0.10, field: 0.20, scan: 0.08, zone: 0.28, tone: 0.04 },
  thinking: { cyan: 0.16, warm: 0.42, field: 0.29, scan: 0.11, zone: 0.34, tone: 0.72 },
  speaking: { cyan: 0.22, warm: 0.50, field: 0.36, scan: 0.15, zone: 0.42, tone: 0.94 },
};

function profileForState(state: AstraAvatarState): StateProfile {
  if (state === "listening" || state === "thinking" || state === "speaking") {
    return STATE_PROFILES[state];
  }
  return STATE_PROFILES.idle;
}

function mixProfile(from: StateProfile, to: StateProfile, amount: number): StateProfile {
  return {
    cyan: THREE.MathUtils.lerp(from.cyan, to.cyan, amount),
    warm: THREE.MathUtils.lerp(from.warm, to.warm, amount),
    field: THREE.MathUtils.lerp(from.field, to.field, amount),
    scan: THREE.MathUtils.lerp(from.scan, to.scan, amount),
    zone: THREE.MathUtils.lerp(from.zone, to.zone, amount),
    tone: THREE.MathUtils.lerp(from.tone, to.tone, amount),
  };
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
        ny > 0.22 &&
        ny < 0.58 &&
        faceX < 0.115 &&
        brightness > 0.055;
      const isVoiceCore =
        ny > 0.46 &&
        ny < 0.73 &&
        faceX < 0.16 &&
        brightness > 0.05;
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
    zones: zoneBuckets.map((bucket) => new Uint32Array(bucket)),
  };
}

function createSubsetGeometry(indices: Uint32Array, source: Float32Array) {
  const positions = new Float32Array(indices.length * 3);
  for (let i = 0; i < indices.length; i += 1) {
    const src = indices[i] * 3;
    const dst = i * 3;
    positions[dst] = source[src];
    positions[dst + 1] = source[src + 1];
    positions[dst + 2] = source[src + 2];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function syncSubsetGeometry(geometry: THREE.BufferGeometry, indices: Uint32Array, source: Float32Array) {
  const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
  const target = attr.array as Float32Array;
  for (let i = 0; i < indices.length; i += 1) {
    const src = indices[i] * 3;
    const dst = i * 3;
    target[dst] = source[src];
    target[dst + 1] = source[src + 1];
    target[dst + 2] = source[src + 2];
  }
  attr.needsUpdate = true;
}

function ParticleArtwork({
  data,
  state,
  effects,
  reducedMotion,
  playbackGate,
  quality,
  trackingTarget,
}: {
  data: ParticleData;
  state: AstraAvatarState;
  effects: boolean;
  reducedMotion: boolean;
  playbackGate: number;
  quality: RenderQuality;
  trackingTarget: { current: FingerTrackingTarget };
}) {
  const basePoints = useRef<THREE.Points>(null);
  const glowPoints = useRef<THREE.Points>(null);
  const edgePoints = useRef<THREE.Points>(null);
  const warmPoints = useRef<THREE.Points>(null);
  const cyanPoints = useRef<THREE.Points>(null);
  const voiceFacePoints = useRef<THREE.Points>(null);
  const voiceCorePoints = useRef<THREE.Points>(null);
  const zonePoints = useRef<Array<THREE.Points<any, any> | null>>([]);
  const playbackEnvelope = useRef(0);
  const target = useRef({ yaw: 0, pitch: 0 });
  const current = useRef({ yaw: 0, pitch: 0 });
  const currentProfile = useRef<StateProfile>({ ...profileForState(state) });
  const transition = useRef({
    progress: 1,
    from: { ...profileForState(state) },
    to: { ...profileForState(state) },
  });

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(data.positions), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(data.colors), 3));
    g.computeBoundingSphere();
    return g;
  }, [data]);

  const edgeGeometry = useMemo(() => createSubsetGeometry(data.edge, data.positions), [data]);
  const warmGeometry = useMemo(() => createSubsetGeometry(data.warm, data.positions), [data]);
  const cyanGeometry = useMemo(() => createSubsetGeometry(data.cyan, data.positions), [data]);
  const voiceFaceGeometry = useMemo(() => createSubsetGeometry(data.voiceFace, data.positions), [data]);
  const voiceCoreGeometry = useMemo(() => createSubsetGeometry(data.voiceCore, data.positions), [data]);
  const zoneGeometries = useMemo(
    () => data.zones.map((indices) => createSubsetGeometry(indices, data.positions)),
    [data],
  );

  useEffect(() => {
    transition.current = {
      progress: reducedMotion ? 1 : 0,
      from: { ...currentProfile.current },
      to: { ...profileForState(state) },
    };
  }, [state, reducedMotion]);

  useEffect(() => () => {
    geometry.dispose();
    edgeGeometry.dispose();
    warmGeometry.dispose();
    cyanGeometry.dispose();
    voiceFaceGeometry.dispose();
    voiceCoreGeometry.dispose();
    zoneGeometries.forEach((zoneGeometry) => zoneGeometry.dispose());
  }, [
    geometry,
    edgeGeometry,
    warmGeometry,
    cyanGeometry,
    voiceFaceGeometry,
    voiceCoreGeometry,
    zoneGeometries,
  ]);

  useFrame(({ pointer, clock }, dt) => {
    if (!basePoints.current) return;

    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const base = data.original;
    const t = clock.elapsedTime;

    if (!effects || reducedMotion) {
      target.current.yaw = 0;
      target.current.pitch = 0;
    } else if (trackingTarget.current.enabled) {
      if (trackingTarget.current.active) {
        target.current.yaw = THREE.MathUtils.clamp(trackingTarget.current.x * 0.34, -0.38, 0.38);
        target.current.pitch = THREE.MathUtils.clamp(-trackingTarget.current.y * 0.13, -0.14, 0.14);
      } else {
        target.current.yaw = 0;
        target.current.pitch = 0;
      }
    } else if (state === "listening") {
      target.current.yaw = THREE.MathUtils.clamp(pointer.x * 0.34, -0.38, 0.38);
      target.current.pitch = THREE.MathUtils.clamp(-pointer.y * 0.13, -0.14, 0.14);
    } else if (state === "thinking") {
      target.current.yaw = 0.09 + Math.sin(t * 0.45) * 0.03;
      target.current.pitch = -0.02;
    } else if (state === "speaking") {
      target.current.yaw = Math.sin(t * 0.6) * 0.032;
      target.current.pitch = Math.sin(t * 1.4) * 0.015;
    } else {
      target.current.yaw = Math.sin(t * 0.22) * 0.01;
      target.current.pitch = Math.sin(t * 0.31) * 0.005;
    }

    const smoothing = 1 - Math.exp(-dt * 6.5);
    current.current.yaw = THREE.MathUtils.lerp(current.current.yaw, target.current.yaw, smoothing);
    current.current.pitch = THREE.MathUtils.lerp(current.current.pitch, target.current.pitch, smoothing);

    const cy = Math.cos(current.current.yaw);
    const sy = Math.sin(current.current.yaw);
    const cp = Math.cos(current.current.pitch);
    const sp = Math.sin(current.current.pitch);
    const chest = effects && !reducedMotion ? Math.sin(t * 0.78) * 0.012 : 0;

    for (let i = 0; i < data.count; i += 1) {
      const o = i * 3;
      const x0 = base[o];
      const y0 = base[o + 1];
      const z0 = base[o + 2];

      if (data.head[i]) {
        const yRel = y0 - HEAD_CENTER_Y;
        const x1 = x0 * cy + z0 * sy;
        const z1 = -x0 * sy + z0 * cy;
        const y1 = yRel * cp - z1 * sp;
        const z2 = yRel * sp + z1 * cp;
        arr[o] = x1;
        arr[o + 1] = y1 + HEAD_CENTER_Y;
        arr[o + 2] = z2;
      } else {
        const chestWeight = THREE.MathUtils.clamp((-y0 + 0.2) / 2.2, 0, 1);
        arr[o] = x0;
        arr[o + 1] = y0 + chest * chestWeight;
        arr[o + 2] = z0;
      }
    }

    attr.needsUpdate = true;
    syncSubsetGeometry(edgeGeometry, data.edge, arr);
    syncSubsetGeometry(warmGeometry, data.warm, arr);
    syncSubsetGeometry(cyanGeometry, data.cyan, arr);
    syncSubsetGeometry(voiceFaceGeometry, data.voiceFace, arr);
    syncSubsetGeometry(voiceCoreGeometry, data.voiceCore, arr);
    for (let zoneIndex = 0; zoneIndex < zoneGeometries.length; zoneIndex += 1) {
      syncSubsetGeometry(zoneGeometries[zoneIndex], data.zones[zoneIndex], arr);
    }

    const transitionSpeed = reducedMotion ? 10 : 1 / 0.68;
    transition.current.progress = Math.min(1, transition.current.progress + dt * transitionSpeed);
    const easedProgress = THREE.MathUtils.smoothstep(transition.current.progress, 0, 1);
    currentProfile.current = mixProfile(
      transition.current.from,
      transition.current.to,
      easedProgress,
    );
    const profile = currentProfile.current;

    const turn = Math.abs(current.current.yaw) / 0.38;
    const baseSize = quality === "high" ? BASE_POINT_SIZE_HIGH : BASE_POINT_SIZE_LOW;
    const glowSize = quality === "high" ? GLOW_POINT_SIZE_HIGH : GLOW_POINT_SIZE_LOW;

    // V11.2: playbackGate is binary and comes from real speechSynthesis events.
    // The rhythm below is only a visual cadence; it is never presented as measured loudness.
    const playbackTarget =
      effects && state === "speaking"
        ? THREE.MathUtils.clamp(playbackGate, 0, 1)
        : 0;
    const envelopeRate = playbackTarget > playbackEnvelope.current ? 12 : 6.5;
    const envelopeEase = 1 - Math.exp(-dt * envelopeRate);
    playbackEnvelope.current = THREE.MathUtils.lerp(
      playbackEnvelope.current,
      playbackTarget,
      envelopeEase,
    );

    const visualRhythm = reducedMotion
      ? 0.74
      : 0.70 +
        Math.pow((Math.sin(t * 5.7) + 1) * 0.5, 1.7) * 0.20 +
        Math.pow((Math.sin(t * 9.8 + 0.9) + 1) * 0.5, 2.2) * 0.10;
    const coreRhythm = reducedMotion
      ? 0.70
      : 0.76 + Math.sin(t * 3.15 + 0.45) * 0.12;
    const voiceReactive = playbackEnvelope.current * visualRhythm;
    const coreReactive = playbackEnvelope.current * coreRhythm;
    const speakingBoost = state === "speaking" ? 1 + voiceReactive * 0.08 : 1;

    const baseMaterial = basePoints.current.material as THREE.PointsMaterial;
    baseMaterial.opacity = state === "speaking" ? 0.97 : 0.92;
    baseMaterial.size = baseSize * speakingBoost;

    if (glowPoints.current) {
      const glowMaterial = glowPoints.current.material as THREE.PointsMaterial;
      glowMaterial.opacity = quality === "high"
        ? (state === "speaking" ? 0.055 + voiceReactive * 0.05 : state === "thinking" ? 0.055 : 0.032)
        : (state === "speaking" ? 0.014 + voiceReactive * 0.018 : 0.018);
      glowMaterial.size = glowSize * speakingBoost;
    }

    if (edgePoints.current) {
      const edgeMaterial = edgePoints.current.material as THREE.PointsMaterial;
      const edgeEnergy = profile.cyan + turn * 0.34;
      edgeMaterial.opacity = quality === "high"
        ? THREE.MathUtils.clamp(0.055 + edgeEnergy, 0.055, 0.5)
        : THREE.MathUtils.clamp(0.04 + edgeEnergy * 0.55, 0.04, 0.28);
      edgeMaterial.size = quality === "high" ? 2.5 + turn * 1.0 : 1.8 + turn * 0.5;
    }

    if (cyanPoints.current) {
      const cyanMaterial = cyanPoints.current.material as THREE.PointsMaterial;
      const listeningPulse = state === "listening" ? 0.04 + Math.sin(t * 2.4) * 0.025 : 0;
      cyanMaterial.opacity = quality === "high"
        ? THREE.MathUtils.clamp(profile.cyan * 0.72 + listeningPulse, 0.03, 0.38)
        : THREE.MathUtils.clamp(profile.cyan * 0.4, 0.02, 0.18);
      cyanMaterial.size = quality === "high" ? 2.15 : 1.55;
    }

    if (warmPoints.current) {
      const warmMaterial = warmPoints.current.material as THREE.PointsMaterial;
      const stateVoice = state === "speaking" ? voiceReactive * 0.27 : 0;
      const thinkingPulse = state === "thinking" ? (Math.sin(t * 1.7) + 1) * 0.025 : 0;
      const stateEnergy = profile.warm + stateVoice + thinkingPulse;
      warmMaterial.opacity = quality === "high"
        ? THREE.MathUtils.clamp(stateEnergy, 0.05, 0.72)
        : THREE.MathUtils.clamp(stateEnergy * 0.58, 0.035, 0.38);
      warmMaterial.size = quality === "high"
        ? 2.45 + voiceReactive * 0.62
        : 1.8 + voiceReactive * 0.28;
    }

    if (voiceFacePoints.current) {
      const faceMaterial = voiceFacePoints.current.material as THREE.PointsMaterial;
      faceMaterial.opacity = effects
        ? THREE.MathUtils.clamp(
            voiceReactive * (quality === "high" ? 0.50 : 0.27),
            0,
            quality === "high" ? 0.5 : 0.27,
          )
        : 0;
      faceMaterial.size = quality === "high"
        ? 2.35 + voiceReactive * 1.05
        : 1.65 + voiceReactive * 0.48;
    }

    if (voiceCorePoints.current) {
      const coreMaterial = voiceCorePoints.current.material as THREE.PointsMaterial;
      coreMaterial.opacity = effects
        ? THREE.MathUtils.clamp(
            coreReactive * (quality === "high" ? 0.34 : 0.18),
            0,
            quality === "high" ? 0.34 : 0.18,
          )
        : 0;
      coreMaterial.size = quality === "high"
        ? 3.0 + coreReactive * 1.0
        : 2.0 + coreReactive * 0.45;
    }

    const cyanStateColor = new THREE.Color("#5ef5ff");
    const warmStateColor = new THREE.Color("#ff9b32");
    const zoneColor = cyanStateColor.clone().lerp(warmStateColor, profile.tone);
    for (let zoneIndex = 0; zoneIndex < zonePoints.current.length; zoneIndex += 1) {
      const zonePoint = zonePoints.current[zoneIndex];
      if (!zonePoint) continue;
      const zoneMaterial = zonePoint.material as THREE.PointsMaterial;
      const zoneStart = zoneIndex * 0.105;
      const waveGate = transition.current.progress >= 1
        ? 1
        : THREE.MathUtils.smoothstep(transition.current.progress, zoneStart, zoneStart + 0.26);
      const faceBias = 1 - zoneIndex / Math.max(1, zonePoints.current.length - 1);
      const speakingFace = state === "speaking" ? voiceReactive * 0.14 * faceBias : 0;
      zoneMaterial.color.copy(zoneColor);
      zoneMaterial.opacity = effects
        ? THREE.MathUtils.clamp((profile.zone * (0.42 + faceBias * 0.58) + speakingFace) * waveGate, 0, 0.36)
        : 0;
      zoneMaterial.size = quality === "high" ? 2.2 + faceBias * 0.55 : 1.55 + faceBias * 0.25;
    }
  });

  return (
    <group>
      <points ref={glowPoints} geometry={geometry}>
        <pointsMaterial
          vertexColors
          size={GLOW_POINT_SIZE_HIGH}
          sizeAttenuation={false}
          transparent
          opacity={0.045}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <points ref={edgePoints} geometry={edgeGeometry}>
        <pointsMaterial
          color="#70f5ff"
          size={2.8}
          sizeAttenuation={false}
          transparent
          opacity={0.1}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <points ref={warmPoints} geometry={warmGeometry}>
        <pointsMaterial
          color="#ff9b32"
          size={2.6}
          sizeAttenuation={false}
          transparent
          opacity={0.13}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <points ref={cyanPoints} geometry={cyanGeometry}>
        <pointsMaterial
          color="#5ef5ff"
          size={2.15}
          sizeAttenuation={false}
          transparent
          opacity={0.08}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <points ref={voiceCorePoints} geometry={voiceCoreGeometry}>
        <pointsMaterial
          color="#ff7d22"
          size={3}
          sizeAttenuation={false}
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <points ref={voiceFacePoints} geometry={voiceFaceGeometry}>
        <pointsMaterial
          color="#ffb15a"
          size={2.4}
          sizeAttenuation={false}
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {zoneGeometries.map((zoneGeometry, zoneIndex) => (
        <points
          key={zoneIndex}
          ref={(node) => {
            zonePoints.current[zoneIndex] = node;
          }}
          geometry={zoneGeometry}
        >
          <pointsMaterial
            color="#5ef5ff"
            size={2.1}
            sizeAttenuation={false}
            transparent
            opacity={0.04}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      ))}

      <points ref={basePoints} geometry={geometry}>
        <pointsMaterial
          vertexColors
          size={BASE_POINT_SIZE_HIGH}
          sizeAttenuation={false}
          transparent
          opacity={0.92}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.NormalBlending}
        />
      </points>
    </group>
  );
}

function ParticleScene({
  data,
  state,
  effects,
  reducedMotion,
  playbackGate,
  quality,
  trackingTarget,
}: {
  data: ParticleData;
  state: AstraAvatarState;
  effects: boolean;
  reducedMotion: boolean;
  playbackGate: number;
  quality: RenderQuality;
  trackingTarget: { current: FingerTrackingTarget };
}) {
  return (
    <Canvas
      style={{ position: "absolute", inset: 0 }}
      camera={{ position: [0, 0, 7.2], fov: 38 }}
      dpr={quality === "high" ? 1.25 : 1}
      gl={{ antialias: false, alpha: true, powerPreference: "default", toneMapping: THREE.NoToneMapping }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.NoToneMapping;
      }}
    >
      <ParticleArtwork
        data={data}
        state={state}
        effects={effects}
        reducedMotion={reducedMotion}
        playbackGate={playbackGate}
        quality={quality}
        trackingTarget={trackingTarget}
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
  const [qualityMode, setQualityMode] = useState<QualityMode>("auto");
  const [autoLow, setAutoLow] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const fpsFrame = useRef({ frames: 0, started: 0 });
  const preCameraFpsRef = useRef<number | null>(null);

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
  const resolvedQuality: RenderQuality =
    qualityMode === "auto" ? (autoLow ? "low" : "high") : qualityMode;
  const tracking = useFingerTracking(resolvedQuality);
  const showReferenceOnly = view === "reference" || !effects;
  const showParticles = view !== "reference" && effects;
  const referenceOpacity = showReferenceOnly ? 1 : view === "compare" ? 1 : 0.028;
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
              filter: resolvedQuality === "high" ? "blur(18px)" : "blur(8px)",
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
                "repeating-linear-gradient(180deg, rgba(90,235,255,.45) 0px, rgba(90,235,255,.45) 1px, transparent 1px, transparent 5px)",
              mixBlendMode: "screen",
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
        <div style={{ fontSize: 11, letterSpacing: ".28em", color: "#61efff" }}>ASTRA MAX // HUMANOID V11.2</div>
        <div style={{ marginTop: 6, fontSize: 10, letterSpacing: ".18em", color: "rgba(223,251,255,.55)" }}>
          VOICE REACTIVE FACE // REAL PLAYBACK EVENTS
        </div>
      </header>

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
            <button onClick={toggleCamera} style={buttonStyle(tracking.enabled)}>
              {tracking.enabled ? "CAMERA OFF" : "CAMERA ON"}
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
            <span>{state.toUpperCase()}</span>
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
          <div>Playback active: {runtime.playbackActive ? "YES" : "NO"}</div>
          <div>Playback gate: {runtime.speechLevel.toFixed(0)} (event-driven, not loudness)</div>
          <div>Voice face driver: smoothed playback envelope + visual cadence</div>
          <div>Pause behavior: reactive face/core fades while playback gate is 0</div>
          <div>Mic support: {runtime.micSupported ? "YES" : "NO"}</div>
          <div>Mic active: {runtime.micActive ? "YES" : "NO"}</div>
          <div>Mic transcript: {runtime.micTranscript || "—"}</div>
          <div>Base blend: Normal</div>
          <div>Energy layers: Additive</div>
          <div>DPR: {resolvedQuality === "high" ? "1.25" : "1.0"}</div>
          <div>FPS: {fps ?? "..."}</div>
          <div>Pre-camera FPS: {preCameraFpsRef.current ?? "not measured"}</div>
          <div>Camera: {tracking.enabled ? "ON" : "OFF"} / {tracking.status.toUpperCase()}</div>
          <div>Hand: {tracking.handFound ? "FOUND" : "NOT FOUND"}</div>
          <div>Hand delegate: {tracking.delegate ?? "not loaded"}</div>
          <div>Tracking FPS: {tracking.trackingFps ?? "..."}</div>
          <div>Inference: {tracking.processingMs === null ? "..." : `${tracking.processingMs} ms`}</div>
          <div>Tracking privacy: frames processed locally; no recording/upload by ASTRA.</div>
          <div>Last request latency: {latency === null ? "not measured" : `${latency} ms`}</div>
          <div>Reduced motion: {reducedMotion ? "ON" : "OFF"}</div>
          <div>Effects: {effects ? "ON" : "OFF"}</div>
          <div>Renderer: Three.js via React Three Fiber</div>
          <div>Color: sRGB input/output, NoToneMapping</div>
          {loadError && <div style={{ marginTop: 8, color: "#ffb35f" }}>Load error: {loadError}</div>}
          <div style={{ marginTop: 9, color: "rgba(255,190,90,.8)" }}>
            V11.2 adds dedicated face/core playback layers driven only by real speechSynthesis playback events. The rhythmic pulse is a visual cadence, not an audio waveform or measured loudness. Pause/stop fades the reactive layers; reduced-motion uses steady energy instead of rhythmic pulsing.
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
  background: "rgba(0,7,11,.82)",
  backdropFilter: "blur(12px)",
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
  background: "rgba(0,7,11,.9)",
  borderRadius: 12,
  padding: 14,
  backdropFilter: "blur(10px)",
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
