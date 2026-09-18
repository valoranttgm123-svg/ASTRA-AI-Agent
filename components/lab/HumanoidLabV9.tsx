"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useAstraRuntime } from "@/components/AstraRuntime";
import type { AstraAvatarState } from "@/lib/avatar/types";

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
  original: Float32Array;
};

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

      pos.push(wx, wy, depth);
      color.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
      col.push(color.r, color.g, color.b);
      mask.push(isHead ? 1 : 0);
      if (isEdge) edgeIndices.push(particleIndex);
      if (isWarm) warmIndices.push(particleIndex);
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
  speechLevel,
  quality,
}: {
  data: ParticleData;
  state: AstraAvatarState;
  effects: boolean;
  reducedMotion: boolean;
  speechLevel: number;
  quality: RenderQuality;
}) {
  const basePoints = useRef<THREE.Points>(null);
  const glowPoints = useRef<THREE.Points>(null);
  const edgePoints = useRef<THREE.Points>(null);
  const warmPoints = useRef<THREE.Points>(null);
  const target = useRef({ yaw: 0, pitch: 0 });
  const current = useRef({ yaw: 0, pitch: 0 });

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(data.positions), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(data.colors), 3));
    g.computeBoundingSphere();
    return g;
  }, [data]);

  const edgeGeometry = useMemo(() => createSubsetGeometry(data.edge, data.positions), [data]);
  const warmGeometry = useMemo(() => createSubsetGeometry(data.warm, data.positions), [data]);

  useEffect(() => () => {
    geometry.dispose();
    edgeGeometry.dispose();
    warmGeometry.dispose();
  }, [geometry, edgeGeometry, warmGeometry]);

  useFrame(({ pointer, clock }, dt) => {
    if (!basePoints.current) return;

    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const base = data.original;
    const t = clock.elapsedTime;

    if (!effects || reducedMotion) {
      target.current.yaw = 0;
      target.current.pitch = 0;
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

    const turn = Math.abs(current.current.yaw) / 0.38;
    const baseSize = quality === "high" ? BASE_POINT_SIZE_HIGH : BASE_POINT_SIZE_LOW;
    const glowSize = quality === "high" ? GLOW_POINT_SIZE_HIGH : GLOW_POINT_SIZE_LOW;
    const voice = THREE.MathUtils.clamp(speechLevel, 0, 1);
    const speakingBoost = state === "speaking" ? 1 + voice * 0.16 : 1;

    const baseMaterial = basePoints.current.material as THREE.PointsMaterial;
    baseMaterial.opacity = state === "speaking" ? 0.97 : 0.92;
    baseMaterial.size = baseSize * speakingBoost;

    if (glowPoints.current) {
      const glowMaterial = glowPoints.current.material as THREE.PointsMaterial;
      glowMaterial.opacity = quality === "high"
        ? (state === "speaking" ? 0.07 + voice * 0.035 : state === "thinking" ? 0.055 : 0.032)
        : 0.018;
      glowMaterial.size = glowSize * speakingBoost;
    }

    if (edgePoints.current) {
      const edgeMaterial = edgePoints.current.material as THREE.PointsMaterial;
      edgeMaterial.opacity = quality === "high"
        ? THREE.MathUtils.clamp(0.08 + turn * 0.34 + (state === "listening" ? 0.08 : 0), 0.08, 0.48)
        : THREE.MathUtils.clamp(0.06 + turn * 0.2, 0.06, 0.25);
      edgeMaterial.size = quality === "high" ? 2.8 + turn * 0.8 : 2.0 + turn * 0.4;
    }

    if (warmPoints.current) {
      const warmMaterial = warmPoints.current.material as THREE.PointsMaterial;
      const stateEnergy =
        state === "speaking" ? 0.34 + voice * 0.4 :
        state === "thinking" ? 0.34 :
        state === "listening" ? 0.2 :
        0.13;
      warmMaterial.opacity = quality === "high" ? stateEnergy : stateEnergy * 0.65;
      warmMaterial.size = quality === "high" ? 2.6 + voice * 1.1 : 1.9 + voice * 0.5;
    }
  });

  return (
    <group>
      <points ref={glowPoints} geometry={geometry}>
        <pointsMaterial
          vertexColors
          size={GLOW_POINT_SIZE}
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
  speechLevel,
  quality,
}: {
  data: ParticleData;
  state: AstraAvatarState;
  effects: boolean;
  reducedMotion: boolean;
  speechLevel: number;
  quality: RenderQuality;
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
        speechLevel={speechLevel}
        quality={quality}
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
  const resolvedQuality: RenderQuality =
    qualityMode === "auto" ? (autoLow ? "low" : "high") : qualityMode;
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = message.trim();
    if (!value || busy) return;
    setBusy(true);
    const started = performance.now();
    try {
      await runtime.send(value);
      setLatency(Math.round(performance.now() - started));
      setMessage("");
    } catch {
      setLatency(Math.round(performance.now() - started));
    } finally {
      setBusy(false);
    }
  };

  const exit = () => {
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
              speechLevel={runtime.speechLevel}
              quality={resolvedQuality}
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
        <div style={{ fontSize: 11, letterSpacing: ".28em", color: "#61efff" }}>ASTRA MAX // HUMANOID V10</div>
        <div style={{ marginTop: 6, fontSize: 10, letterSpacing: ".18em", color: "rgba(223,251,255,.55)" }}>
          GOD MODE // ADAPTIVE NEURAL PARTICLE ENTITY
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
            <button onClick={() => setTechnical((value) => !value)} style={buttonStyle(technical)}>
              TECHNICAL
            </button>
          </div>
        </div>

        <div style={consoleStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 9, letterSpacing: ".18em", color: "#65eafb" }}>
            <span>{runtime.activeAgent ?? "ASTRA CORE"}</span>
            <span>{state.toUpperCase()}</span>
          </div>
          <div style={{ minHeight: 42, marginTop: 10, color: "rgba(225,250,255,.72)", fontSize: 11, lineHeight: 1.5 }}>
            {runtime.lastResponse?.message ?? "Approved artwork is driving the humanoid particle field."}
          </div>
          <form onSubmit={submit} style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ketik perintah ASTRA..."
              style={inputStyle}
            />
            <button disabled={busy || !message.trim()} type="submit" style={{ ...buttonStyle(false), opacity: busy ? 0.55 : 1 }}>
              {busy ? "RUN" : "SEND"}
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
          <div>Speech level: {runtime.speechLevel.toFixed(2)}</div>
          <div>Base blend: Normal</div>
          <div>Energy layers: Additive</div>
          <div>DPR: {resolvedQuality === "high" ? "1.25" : "1.0"}</div>
          <div>FPS: {fps ?? "..."}</div>
          <div>Last request latency: {latency === null ? "not measured" : `${latency} ms`}</div>
          <div>Reduced motion: {reducedMotion ? "ON" : "OFF"}</div>
          <div>Effects: {effects ? "ON" : "OFF"}</div>
          <div>Renderer: Three.js via React Three Fiber</div>
          <div>Color: sRGB input/output, NoToneMapping</div>
          {loadError && <div style={{ marginTop: 8, color: "#ffb35f" }}>Load error: {loadError}</div>}
          <div style={{ marginTop: 9, color: "rgba(255,190,90,.8)" }}>
            V10 MAX adds adaptive quality, cyan edge energy, orange neural-core sampling, voice-reactive intensity, and GPU-safe layered rendering.
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
