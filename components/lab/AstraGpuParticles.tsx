"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { AstraAvatarState } from "@/lib/avatar/types";
import type { FingerTrackingTarget } from "./useFingerTracking";

const ASSEMBLY_DURATION_SECONDS = 2.6;
const ASSEMBLY_WINDOW = 0.34;
const SHOCKWAVE_DURATION_SECONDS = 2.35;

type RenderQuality = "low" | "high";

type ParticleDataLike = {
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
};

type StateProfile = {
  cyan: number;
  warm: number;
  field: number;
  zone: number;
  tone: number;
};

const STATE_PROFILES: Record<"idle" | "listening" | "thinking" | "speaking", StateProfile> = {
  idle: { cyan: 0.08, warm: 0.10, field: 0.08, zone: 0.05, tone: 0.30 },
  listening: { cyan: 0.40, warm: 0.10, field: 0.20, zone: 0.28, tone: 0.04 },
  thinking: { cyan: 0.16, warm: 0.42, field: 0.29, zone: 0.34, tone: 0.72 },
  speaking: { cyan: 0.20, warm: 0.34, field: 0.28, zone: 0.24, tone: 0.82 },
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
    zone: THREE.MathUtils.lerp(from.zone, to.zone, amount),
    tone: THREE.MathUtils.lerp(from.tone, to.tone, amount),
  };
}

function mark(indices: Uint32Array, target: Float32Array, value = 1) {
  for (let i = 0; i < indices.length; i += 1) {
    target[indices[i]] = value;
  }
}

function hash01(value: number) {
  const raw = Math.sin(value * 12.9898) * 43758.5453;
  return raw - Math.floor(raw);
}

const vertexShader = `
attribute vec3 color;
attribute float aHead;
attribute float aEdge;
attribute float aWarm;
attribute float aCyan;
attribute float aVoiceFace;
attribute float aVoiceCore;
attribute float aAssemblyPhase;
attribute vec3 aAssemblySource;
attribute float aZone;
attribute float aSeed;

uniform float uTime;
uniform float uYaw;
uniform float uPitch;
uniform float uChest;
uniform float uAssemblyProgress;
uniform float uAssemblyEnabled;
uniform float uPointSize;
uniform float uGlowPass;
uniform float uStateCyan;
uniform float uStateWarm;
uniform float uStateZone;
uniform float uStateTone;
uniform float uVoice;
uniform float uEffects;
uniform float uShockwaveActive;
uniform float uShockwaveProgress;

varying vec3 vColor;
varying float vAlpha;
varying float vGlowPass;

float smoother(float x) {
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

void main() {
  vec3 p = position;

  if (aHead > 0.5) {
    float cy = cos(uYaw);
    float sy = sin(uYaw);
    float cp = cos(uPitch);
    float sp = sin(uPitch);
    float yRel = p.y - 0.56745000;
    float x1 = p.x * cy + p.z * sy;
    float z1 = -p.x * sy + p.z * cy;
    float y1 = yRel * cp - z1 * sp;
    float z2 = yRel * sp + z1 * cp;
    p = vec3(x1, y1 + 0.56745000, z2);
  } else {
    float chestWeight = clamp((-p.y + 0.2) / 2.2, 0.0, 1.0);
    p.y += uChest * chestWeight;
  }

  if (uAssemblyEnabled > 0.5 && aAssemblyPhase >= 0.0 && uAssemblyProgress < 1.0) {
    float raw = clamp((uAssemblyProgress - aAssemblyPhase) / 0.3400, 0.0, 1.0);
    float local = smoother(raw);
    float arc = sin(local * 3.14159265);
    float curvePhase = aSeed * 6.2831853;
    float streamCurve =
      sin(local * 4.7123889 + curvePhase) *
      pow(1.0 - local, 2.0) *
      0.014;

    p = mix(aAssemblySource, p, local);
    p.x += streamCurve;
    p.y += arc * (0.14 + aSeed * 0.08);
    p.z += arc * (0.10 + fract(aSeed * 7.13) * 0.08);
  }

  float shockProgress = clamp(uShockwaveProgress, 0.0, 1.0);
  vec2 shockOrigin = vec2(0.0, -0.24);
  vec2 shockVector = vec2(p.x, p.y) - shockOrigin;
  float shockRadius = length(shockVector);
  float travel = clamp((shockProgress - 0.08) / 0.78, 0.0, 1.0);
  float waveRadius = mix(0.10, 4.75, travel);
  float ring = 1.0 - smoothstep(0.0, 0.23, abs(shockRadius - waveRadius));
  float waveFade =
    smoothstep(0.04, 0.12, shockProgress) *
    (1.0 - smoothstep(0.84, 1.0, shockProgress));
  float coreLock =
    (1.0 - smoothstep(0.10, 0.78, shockRadius)) *
    (1.0 - smoothstep(0.04, 0.22, shockProgress));
  float shockRing = ring * waveFade * uShockwaveActive;
  float shockCore = coreLock * uShockwaveActive;
  float shockEnergy = max(shockRing, shockCore);

  if (shockRing > 0.001) {
    vec2 direction = shockVector / max(shockRadius, 0.0001);
    p.xy += direction * shockRing * (1.0 - travel) * 0.035;
  }

  float cyanEnergy =
    aCyan * uStateCyan +
    aEdge * (0.08 + uStateCyan * 0.35) +
    shockRing * (0.34 + travel * 0.26);
  float warmEnergy =
    aWarm * uStateWarm +
    shockCore * 0.62 +
    shockRing * (1.0 - travel) * 0.16;
  float voiceEnergy = (aVoiceFace * 0.85 + aVoiceCore * 0.60) * uVoice;
  float zoneEnergy = aZone * uStateZone;
  float energy = (cyanEnergy + warmEnergy + voiceEnergy + zoneEnergy) * uEffects;

  vec3 cyan = vec3(0.37, 0.96, 1.0);
  vec3 warm = vec3(1.0, 0.58, 0.18);
  vec3 stateTint = mix(cyan, warm, clamp(uStateTone, 0.0, 1.0));

  if (uGlowPass > 0.5) {
    float glowEnergy = clamp(energy, 0.0, 1.25);
    vColor = mix(stateTint, color, 0.34) * (0.56 + glowEnergy * 0.82);
    vAlpha = clamp(0.032 + glowEnergy * 0.16, 0.0, 0.28);
    gl_PointSize = uPointSize * (1.0 + glowEnergy * 0.08 + shockEnergy * 0.14);
  } else {
    vec3 liftedSource = pow(max(color, vec3(0.0)), vec3(0.72));
    float sourceLuma = dot(liftedSource, vec3(0.2126, 0.7152, 0.0722));
    float darkLift = (1.0 - smoothstep(0.05, 0.28, sourceLuma)) * 0.055;

    vec3 boosted =
      liftedSource * 1.20 +
      vec3(darkLift) +
      cyan * cyanEnergy * 0.15 +
      warm * (warmEnergy + voiceEnergy) * 0.16;

    float peak = max(boosted.r, max(boosted.g, boosted.b));
    if (peak > 1.0) {
      boosted /= peak;
    }

    vColor = clamp(boosted, 0.0, 1.0);
    vAlpha = 1.0;
    gl_PointSize = uPointSize * (1.0 + shockEnergy * 0.10);
  }

  vGlowPass = uGlowPass;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const fragmentShader = `
varying vec3 vColor;
varying float vAlpha;
varying float vGlowPass;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  float d = length(centered);
  float alpha;

  if (vGlowPass > 0.5) {
    alpha = 1.0 - smoothstep(0.14, 0.48, d);
  } else {
    float brightCore = 1.0 - smoothstep(0.15, 0.30, d);
    float softRim = 1.0 - smoothstep(0.30, 0.49, d);
    alpha = max(brightCore, softRim * 0.58);
  }

  alpha *= vAlpha;
  if (alpha < 0.02) discard;

  gl_FragColor = vec4(vColor, alpha);
}
`;

export default function AstraGpuParticles({
  data,
  state,
  effects,
  reducedMotion,
  playbackGate,
  quality,
  trackingTarget,
  assemblyRun,
  assemblySkipped,
  onAssemblyComplete,
  onShockwaveChange,
}: {
  data: ParticleDataLike;
  state: AstraAvatarState;
  effects: boolean;
  reducedMotion: boolean;
  playbackGate: number;
  quality: RenderQuality;
  trackingTarget: { current: FingerTrackingTarget };
  assemblyRun: number;
  assemblySkipped: boolean;
  onAssemblyComplete: () => void;
  onShockwaveChange: (active: boolean) => void;
}) {
  const target = useRef({ yaw: 0, pitch: 0 });
  const current = useRef({ yaw: 0, pitch: 0 });
  const playbackEnvelope = useRef(0);
  const currentProfile = useRef<StateProfile>({ ...profileForState(state) });
  const transition = useRef({
    progress: 1,
    from: { ...profileForState(state) },
    to: { ...profileForState(state) },
  });
  const assemblyClock = useRef({
    run: assemblyRun,
    startedAt: 0,
    initialized: false,
    completedRun: -1,
  });
  const shockwaveClock = useRef({
    active: false,
    startedAt: 0,
    run: -1,
  });

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(data.positions), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(data.colors), 3));

    const head = new Float32Array(data.count);
    const edge = new Float32Array(data.count);
    const warm = new Float32Array(data.count);
    const cyan = new Float32Array(data.count);
    const voiceFace = new Float32Array(data.count);
    const voiceCore = new Float32Array(data.count);
    const zone = new Float32Array(data.count);
    const seed = new Float32Array(data.count);

    for (let i = 0; i < data.count; i += 1) {
      head[i] = data.head[i] ? 1 : 0;
      seed[i] = hash01(i + 0.37);
    }
    mark(data.edge, edge);
    mark(data.warm, warm);
    mark(data.cyan, cyan);
    mark(data.voiceFace, voiceFace);
    mark(data.voiceCore, voiceCore);

    for (let zoneIndex = 0; zoneIndex < data.zones.length; zoneIndex += 1) {
      const indices = data.zones[zoneIndex];
      const weight = 1 - zoneIndex / Math.max(1, data.zones.length - 1);
      mark(indices, zone, weight);
    }

    g.setAttribute("aHead", new THREE.BufferAttribute(head, 1));
    g.setAttribute("aEdge", new THREE.BufferAttribute(edge, 1));
    g.setAttribute("aWarm", new THREE.BufferAttribute(warm, 1));
    g.setAttribute("aCyan", new THREE.BufferAttribute(cyan, 1));
    g.setAttribute("aVoiceFace", new THREE.BufferAttribute(voiceFace, 1));
    g.setAttribute("aVoiceCore", new THREE.BufferAttribute(voiceCore, 1));
    g.setAttribute("aAssemblyPhase", new THREE.BufferAttribute(new Float32Array(data.assemblyPhase), 1));
    g.setAttribute("aAssemblySource", new THREE.BufferAttribute(new Float32Array(data.assemblySource), 3));
    g.setAttribute("aZone", new THREE.BufferAttribute(zone, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.computeBoundingSphere();
    return g;
  }, [data]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uYaw: { value: 0 },
    uPitch: { value: 0 },
    uChest: { value: 0 },
    uAssemblyProgress: { value: 1 },
    uAssemblyEnabled: { value: 0 },
    uPointSize: { value: 2.25 },
    uGlowPass: { value: 0 },
    uStateCyan: { value: 0.08 },
    uStateWarm: { value: 0.10 },
    uStateZone: { value: 0.05 },
    uStateTone: { value: 0.30 },
    uVoice: { value: 0 },
    uEffects: { value: 1 },
    uShockwaveActive: { value: 0 },
    uShockwaveProgress: { value: 1 },
  }), []);

  const glowUniforms = useMemo(() => {
    const copied: Record<string, { value: number }> = {};
    for (const [key, entry] of Object.entries(uniforms)) {
      copied[key] = { value: entry.value };
    }
    copied.uGlowPass.value = 1;
    return copied;
  }, [uniforms]);

  const baseMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
  }), [uniforms]);

  const glowMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: glowUniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }), [glowUniforms]);

  useEffect(() => {
    transition.current = {
      progress: reducedMotion ? 1 : 0,
      from: { ...currentProfile.current },
      to: { ...profileForState(state) },
    };
  }, [state, reducedMotion]);

  useEffect(() => {
    assemblyClock.current = {
      run: assemblyRun,
      startedAt: 0,
      initialized: false,
      completedRun: -1,
    };
    if (shockwaveClock.current.active) {
      shockwaveClock.current.active = false;
      onShockwaveChange(false);
    }
    shockwaveClock.current = {
      active: false,
      startedAt: 0,
      run: assemblyRun,
    };
  }, [assemblyRun, onShockwaveChange]);

  useEffect(() => {
    if ((!effects || reducedMotion || assemblySkipped) && shockwaveClock.current.active) {
      shockwaveClock.current.active = false;
      onShockwaveChange(false);
    }
  }, [effects, reducedMotion, assemblySkipped, onShockwaveChange]);

  useEffect(() => () => {
    geometry.dispose();
    baseMaterial.dispose();
    glowMaterial.dispose();
  }, [geometry, baseMaterial, glowMaterial]);

  useFrame(({ pointer, clock }, dt) => {
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

    transition.current.progress = Math.min(
      1,
      transition.current.progress + dt * (reducedMotion ? 10 : 1 / 0.68),
    );
    const eased = THREE.MathUtils.smoothstep(transition.current.progress, 0, 1);
    currentProfile.current = mixProfile(transition.current.from, transition.current.to, eased);
    const profile = currentProfile.current;

    const playbackTarget = effects && state === "speaking"
      ? THREE.MathUtils.clamp(playbackGate, 0, 1)
      : 0;
    const envelopeRate = playbackTarget > playbackEnvelope.current ? 12 : 6.5;
    playbackEnvelope.current = THREE.MathUtils.lerp(
      playbackEnvelope.current,
      playbackTarget,
      1 - Math.exp(-dt * envelopeRate),
    );
    const visualRhythm = reducedMotion
      ? 0.74
      : 0.70 +
        Math.pow((Math.sin(t * 5.7) + 1) * 0.5, 1.7) * 0.20 +
        Math.pow((Math.sin(t * 9.8 + 0.9) + 1) * 0.5, 2.2) * 0.10;
    const voice = playbackEnvelope.current * visualRhythm;

    let assemblyProgress = 1;
    let assemblyEnabled = 0;
    if (effects && !reducedMotion && !assemblySkipped) {
      if (
        assemblyClock.current.run !== assemblyRun ||
        !assemblyClock.current.initialized
      ) {
        assemblyClock.current.run = assemblyRun;
        assemblyClock.current.startedAt = t;
        assemblyClock.current.initialized = true;
        assemblyClock.current.completedRun = -1;
      }
      assemblyProgress = THREE.MathUtils.clamp(
        (t - assemblyClock.current.startedAt) / ASSEMBLY_DURATION_SECONDS,
        0,
        1,
      );
      assemblyEnabled = 1;
    }

    if (
      assemblyProgress >= 1 &&
      assemblyClock.current.completedRun !== assemblyRun
    ) {
      assemblyClock.current.completedRun = assemblyRun;
      onAssemblyComplete();

      if (effects && !reducedMotion && !assemblySkipped) {
        shockwaveClock.current = {
          active: true,
          startedAt: t,
          run: assemblyRun,
        };
        onShockwaveChange(true);
      }
    }

    let shockwaveProgress = 1;
    let shockwaveActive = 0;
    if (shockwaveClock.current.active) {
      shockwaveProgress = THREE.MathUtils.clamp(
        (t - shockwaveClock.current.startedAt) / SHOCKWAVE_DURATION_SECONDS,
        0,
        1,
      );
      shockwaveActive = 1;

      if (shockwaveProgress >= 1) {
        shockwaveClock.current.active = false;
        shockwaveActive = 0;
        onShockwaveChange(false);
      }
    }

    const chest = effects && !reducedMotion ? Math.sin(t * 0.78) * 0.012 : 0;
    const baseSize = quality === "high" ? 2.80 : 1.62;
    const glowSize = quality === "high" ? 3.65 : 2.28;

    const writeUniforms = (targetUniforms: Record<string, { value: number }>, glow: boolean) => {
      targetUniforms.uTime.value = t;
      targetUniforms.uYaw.value = current.current.yaw;
      targetUniforms.uPitch.value = current.current.pitch;
      targetUniforms.uChest.value = chest;
      targetUniforms.uAssemblyProgress.value = assemblyProgress;
      targetUniforms.uAssemblyEnabled.value = assemblyEnabled;
      targetUniforms.uPointSize.value = glow ? glowSize : baseSize;
      targetUniforms.uStateCyan.value = profile.cyan;
      targetUniforms.uStateWarm.value = profile.warm;
      targetUniforms.uStateZone.value = profile.zone;
      targetUniforms.uStateTone.value = profile.tone;
      targetUniforms.uVoice.value = voice;
      targetUniforms.uEffects.value = effects ? 1 : 0;
      targetUniforms.uShockwaveActive.value = shockwaveActive;
      targetUniforms.uShockwaveProgress.value = shockwaveProgress;
    };

    writeUniforms(uniforms, false);
    writeUniforms(glowUniforms, true);
  });

  return (
    <group>
      <points geometry={geometry} material={glowMaterial} frustumCulled={false} />
      <points geometry={geometry} material={baseMaterial} frustumCulled={false} />
    </group>
  );
}
