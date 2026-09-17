"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const ARTWORK = "/assets/humanoid/astra-idle-v1.webp";

type ViewMode = "reference" | "particles";
type AgentState = "idle" | "listening" | "thinking" | "speaking";

type ParticleData = {
  positions: Float32Array;
  colors: Float32Array;
  uvs: Float32Array;
  count: number;
  width: number;
  height: number;
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

function buildParticles(image: HTMLImageElement, step: number): ParticleData {
  const canvas = document.createElement("canvas");
  const maxW = 760;
  const scale = Math.min(1, maxW / image.naturalWidth);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D tidak tersedia");
  ctx.drawImage(image, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;

  const pos: number[] = [];
  const col: number[] = [];
  const uvs: number[] = [];
  const aspect = width / height;
  const worldH = 3.35;
  const worldW = worldH * aspect;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const brightness = Math.max(r, g, b);
      const cyanEnergy = Math.max(0, b - r * 0.25) + Math.max(0, g - r * 0.35);
      const orangeEnergy = Math.max(0, r - b * 0.35) + Math.max(0, g * 0.55 - b * 0.22);
      if (brightness < 0.11 || (cyanEnergy < 0.13 && orangeEnergy < 0.12)) continue;

      const nx = x / (width - 1);
      const ny = y / (height - 1);
      const px = (nx - 0.5) * worldW;
      const py = (0.5 - ny) * worldH;

      // Approximate rounded head depth around the central portrait area.
      const headX = (nx - 0.5) / 0.23;
      const headY = (ny - 0.36) / 0.32;
      const rr = headX * headX + headY * headY;
      const headDepth = rr < 1 ? Math.sqrt(1 - rr) * 0.5 : 0;
      const chestDepth = ny > 0.55 ? Math.max(0, 1 - Math.abs(nx - 0.5) * 2) * 0.1 : 0;
      const z = headDepth + chestDepth + brightness * 0.04;

      pos.push(px, py, z);
      col.push(r, g, b);
      uvs.push(nx, ny);
    }
  }

  return {
    positions: new Float32Array(pos),
    colors: new Float32Array(col),
    uvs: new Float32Array(uvs),
    count: pos.length / 3,
    width,
    height,
  };
}

function ParticlePortrait({
  data,
  state,
  effectsOn,
  reducedMotion,
}: {
  data: ParticleData;
  state: AgentState;
  effectsOn: boolean;
  reducedMotion: boolean;
}) {
  const points = useRef<THREE.Points>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  useFrame(({ pointer, clock }, dt) => {
    if (!points.current) return;
    const t = clock.elapsedTime;
    const activeMotion = effectsOn && !reducedMotion;

    if (state === "listening" && activeMotion) {
      target.current.x = THREE.MathUtils.clamp(pointer.x * 0.28, -0.3, 0.3);
      target.current.y = THREE.MathUtils.clamp(-pointer.y * 0.11, -0.12, 0.12);
    } else if (state === "thinking" && activeMotion) {
      target.current.x = 0.07 + Math.sin(t * 0.55) * 0.035;
      target.current.y = -0.025;
    } else if (state === "speaking" && activeMotion) {
      target.current.x = Math.sin(t * 0.62) * 0.03;
      target.current.y = Math.sin(t * 1.4) * 0.018;
    } else {
      target.current.x = 0;
      target.current.y = 0;
    }

    const a = 1 - Math.exp(-dt * 4.2);
    current.current.x = THREE.MathUtils.lerp(current.current.x, target.current.x, a);
    current.current.y = THREE.MathUtils.lerp(current.current.y, target.current.y, a);
    points.current.rotation.y = current.current.x;
    points.current.rotation.x = current.current.y;
    points.current.position.y = activeMotion ? Math.sin(t * 0.62) * 0.008 : 0;

    const material = points.current.material as THREE.PointsMaterial;
    const speakPulse = state === "speaking" && activeMotion ? 0.34 + Math.abs(Math.sin(t * 8.5)) * 0.24 : 0;
    material.size = effectsOn ? 0.018 + speakPulse * 0.007 : 0.014;
    material.opacity = effectsOn ? 0.92 : 0.78;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={0.018}
        sizeAttenuation
        transparent
        opacity={0.92}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function ParticleScene({ data, state, effectsOn, reducedMotion }: { data: ParticleData; state: AgentState; effectsOn: boolean; reducedMotion: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.1], fov: 42 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
      dpr={[1, 1.5]}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#02060a"]} />
      <ParticlePortrait data={data} state={state} effectsOn={effectsOn} reducedMotion={reducedMotion} />
    </Canvas>
  );
}

export default function HumanoidImageStage() {
  const [mode, setMode] = useState<ViewMode>("reference");
  const [effectsOn, setEffectsOn] = useState(true);
  const [state, setState] = useState<AgentState>("idle");
  const [particleData, setParticleData] = useState<ParticleData | null>(null);
  const [step, setStep] = useState(4);
  const [loadError, setLoadError] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.src = ARTWORK;
    image.onload = () => {
      if (cancelled) return;
      try {
        setParticleData(buildParticles(image, step));
        setLoadError(null);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Gagal membangun partikel");
      }
    };
    image.onerror = () => !cancelled && setLoadError("Artwork idle gagal dimuat");
    return () => { cancelled = true; };
  }, [step]);

  const effectiveEffects = effectsOn && !reducedMotion;

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>ASTRA // HUMANOID IMAGE BUILD</div>
          <h1 style={{ margin: "8px 0 0", fontSize: "clamp(24px,3vw,42px)", fontWeight: 300 }}>Approved Artwork → Live Particle Entity</h1>
        </div>
        <a href="/" style={exitStyle}>EXIT</a>
      </header>

      <section style={stageStyle}>
        <div style={figureWrapStyle}>
          {mode === "reference" ? (
            <img
              src={ARTWORK}
              alt="Approved ASTRA idle artwork"
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          ) : particleData ? (
            <ParticleScene data={particleData} state={state} effectsOn={effectiveEffects} reducedMotion={reducedMotion} />
          ) : (
            <div style={centerStyle}>{loadError ?? "MEMBANGUN PARTICLE FIELD…"}</div>
          )}
        </div>

        <div style={controlBarStyle}>
          <button style={buttonStyle(mode === "reference")} onClick={() => setMode("reference")}>ORIGINAL</button>
          <button style={buttonStyle(mode === "particles")} onClick={() => setMode("particles")}>PARTICLES</button>
          <span style={dividerStyle} />
          {(["idle", "listening", "thinking", "speaking"] as AgentState[]).map((s) => (
            <button key={s} style={buttonStyle(state === s)} onClick={() => setState(s)}>{s.toUpperCase()}</button>
          ))}
          <span style={dividerStyle} />
          <button style={buttonStyle(!effectsOn)} onClick={() => setEffectsOn((value) => !value)}>
            {effectsOn ? "EFFECTS ON" : "EFFECTS OFF"}
          </button>
        </div>
      </section>

      <details style={detailsStyle}>
        <summary style={{ cursor: "pointer", color: "#62e9f7", letterSpacing: "0.16em", fontSize: 11 }}>TECHNICAL DETAILS</summary>
        <div style={{ marginTop: 12, display: "grid", gap: 8, color: "rgba(220,240,244,.72)", fontSize: 12 }}>
          <div>Artwork: astra-idle-v1.webp</div>
          <div>Mode: {mode}</div>
          <div>Particles: {particleData?.count.toLocaleString() ?? "—"}</div>
          <div>Sampling resolution: {particleData ? `${particleData.width}×${particleData.height}` : "—"}</div>
          <div>Reduced motion: {reducedMotion ? "ON" : "OFF"}</div>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            Sampling step
            <input type="range" min={3} max={7} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} />
            {step}px
          </label>
        </div>
      </details>

      <div style={noteStyle}>
        Stage 1 uses only the approved IDLE artwork. Listening / Thinking / Speaking buttons test body/head motion only; no unapproved state artwork is invented.
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = { height: "100vh", minHeight: 640, background: "#02060a", color: "#ecf7f8", overflow: "hidden", position: "relative", fontFamily: "var(--font-mono, monospace)" };
const headerStyle: CSSProperties = { position: "absolute", zIndex: 20, top: 20, left: 24, right: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", pointerEvents: "none" };
const eyebrowStyle: CSSProperties = { color: "#4de9f8", letterSpacing: ".25em", fontSize: 11 };
const exitStyle: CSSProperties = { pointerEvents: "auto", color: "#bdeef3", border: "1px solid rgba(77,233,248,.45)", borderRadius: 999, padding: "8px 14px", textDecoration: "none", fontSize: 11, letterSpacing: ".18em", background: "rgba(1,10,15,.72)" };
const stageStyle: CSSProperties = { position: "absolute", inset: 0, display: "grid", placeItems: "center" };
const figureWrapStyle: CSSProperties = { width: "min(100vw, 1500px)", height: "min(82vh, 900px)", position: "relative", overflow: "hidden", background: "#02060a" };
const controlBarStyle: CSSProperties = { position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 22, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center", zIndex: 20, padding: 8, border: "1px solid rgba(77,233,248,.22)", borderRadius: 14, background: "rgba(1,8,13,.84)", backdropFilter: "blur(10px)" };
const dividerStyle: CSSProperties = { width: 1, height: 24, background: "rgba(77,233,248,.24)", margin: "0 2px" };
const detailsStyle: CSSProperties = { position: "absolute", right: 18, bottom: 82, zIndex: 21, width: 290, maxWidth: "calc(100vw - 36px)", border: "1px solid rgba(77,233,248,.22)", borderRadius: 12, padding: 12, background: "rgba(1,8,13,.9)" };
const noteStyle: CSSProperties = { position: "absolute", left: 22, bottom: 26, maxWidth: 430, zIndex: 12, color: "rgba(214,239,242,.58)", fontSize: 10, lineHeight: 1.5, letterSpacing: ".05em" };
const centerStyle: CSSProperties = { position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#65eaf7", letterSpacing: ".2em", fontSize: 11 };
const buttonStyle = (active: boolean): CSSProperties => ({ border: active ? "1px solid #52edf9" : "1px solid rgba(82,237,249,.24)", background: active ? "rgba(20,178,199,.18)" : "rgba(4,15,20,.74)", color: active ? "#ecffff" : "rgba(203,235,239,.65)", borderRadius: 8, padding: "8px 10px", fontSize: 10, letterSpacing: ".12em", cursor: "pointer" });
