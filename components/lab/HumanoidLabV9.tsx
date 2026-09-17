"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useAstraRuntime } from "@/components/AstraRuntime";
import type { AstraAvatarState } from "@/lib/avatar/types";

const ARTWORK = "/assets/astra-humanoid/astra-idle-v1.webp";
const SAMPLE_W = 320;
const SAMPLE_H = 180;
const STEP = 2;
const WORLD_W = 7.2;
const WORLD_H = WORLD_W * (SAMPLE_H / SAMPLE_W);

const STATES: AstraAvatarState[] = ["idle", "listening", "thinking", "speaking"];

type ViewMode = "reference" | "particles" | "compare";

type ParticleData = {
  count: number;
  positions: Float32Array;
  colors: Float32Array;
  head: Uint8Array;
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
  const color = new THREE.Color();

  for (let y = 0; y < SAMPLE_H; y += STEP) {
    for (let x = 0; x < SAMPLE_W; x += STEP) {
      const i = (y * SAMPLE_W + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3] / 255;
      const brightness = Math.max(r, g, b) / 255;
      if (a < 0.2 || brightness < 0.075) continue;

      const nx = x / (SAMPLE_W - 1);
      const ny = y / (SAMPLE_H - 1);
      const wx = (nx - 0.5) * WORLD_W;
      const wy = (0.5 - ny) * WORLD_H;

      // Approved artwork head region. Only these samples gain depth/rotation.
      const hx = (nx - 0.5) / 0.18;
      const hy = (ny - 0.39) / 0.29;
      const rr = hx * hx + hy * hy;
      const isHead = rr <= 1;
      const depth = isHead ? Math.sqrt(Math.max(0, 1 - rr)) * 0.7 : 0;

      pos.push(wx, wy, depth);
      color.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
      col.push(color.r, color.g, color.b);
      mask.push(isHead ? 1 : 0);
    }
  }

  const positions = new Float32Array(pos);
  return {
    count: positions.length / 3,
    positions,
    original: new Float32Array(positions),
    colors: new Float32Array(col),
    head: new Uint8Array(mask),
  };
}

function ParticleArtwork({
  data,
  state,
  effects,
  reducedMotion,
}: {
  data: ParticleData;
  state: AstraAvatarState;
  effects: boolean;
  reducedMotion: boolean;
}) {
  const points = useRef<THREE.Points>(null);
  const target = useRef({ yaw: 0, pitch: 0 });
  const current = useRef({ yaw: 0, pitch: 0 });

  useFrame(({ pointer, clock }, dt) => {
    if (!points.current) return;
    const geom = points.current.geometry;
    const attr = geom.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const base = data.original;
    const t = clock.elapsedTime;

    if (!effects || reducedMotion) {
      target.current.yaw = 0;
      target.current.pitch = 0;
    } else if (state === "listening") {
      target.current.yaw = THREE.MathUtils.clamp(pointer.x * 0.38, -0.42, 0.42);
      target.current.pitch = THREE.MathUtils.clamp(-pointer.y * 0.15, -0.16, 0.16);
    } else if (state === "thinking") {
      target.current.yaw = 0.11 + Math.sin(t * 0.45) * 0.035;
      target.current.pitch = -0.025;
    } else if (state === "speaking") {
      target.current.yaw = Math.sin(t * 0.6) * 0.035;
      target.current.pitch = Math.sin(t * 1.4) * 0.018;
    } else {
      target.current.yaw = Math.sin(t * 0.22) * 0.012;
      target.current.pitch = Math.sin(t * 0.31) * 0.006;
    }

    const smoothing = 1 - Math.exp(-dt * 6.5);
    current.current.yaw = THREE.MathUtils.lerp(current.current.yaw, target.current.yaw, smoothing);
    current.current.pitch = THREE.MathUtils.lerp(current.current.pitch, target.current.pitch, smoothing);

    const cy = Math.cos(current.current.yaw);
    const sy = Math.sin(current.current.yaw);
    const cp = Math.cos(current.current.pitch);
    const sp = Math.sin(current.current.pitch);
    const chest = effects && !reducedMotion ? Math.sin(t * 0.8) * 0.012 : 0;
    const speakingPulse = state === "speaking" && effects ? 1 + Math.abs(Math.sin(t * 8.2)) * 0.28 : 1;

    for (let i = 0; i < data.count; i += 1) {
      const o = i * 3;
      const x0 = base[o];
      const y0 = base[o + 1];
      const z0 = base[o + 2];

      if (data.head[i]) {
        const x1 = x0 * cy + z0 * sy;
        const z1 = -x0 * sy + z0 * cy;
        const y1 = y0 * cp - z1 * sp;
        const z2 = y0 * sp + z1 * cp;
        arr[o] = x1;
        arr[o + 1] = y1;
        arr[o + 2] = z2;
      } else {
        const anchor = THREE.MathUtils.clamp((-y0 - 0.25) / 1.8, 0, 1);
        arr[o] = x0;
        arr[o + 1] = y0 + chest * anchor;
        arr[o + 2] = z0;
      }
    }

    attr.needsUpdate = true;
    const material = points.current.material as THREE.PointsMaterial;
    const turn = Math.abs(current.current.yaw) / 0.42;
    material.size = (effects ? 0.032 : 0.025) * (1 + turn * 0.28) * speakingPulse;
    material.opacity = effects ? 0.88 : 1;
  });

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(data.positions), 3));
    g.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
    return g;
  }, [data]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        vertexColors
        size={0.032}
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function ParticleScene({ data, state, effects, reducedMotion }: {
  data: ParticleData;
  state: AstraAvatarState;
  effects: boolean;
  reducedMotion: boolean;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 7.2], fov: 38 }}
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.NoToneMapping;
      }}
    >
      <color attach="background" args={["#000306"]} />
      <ParticleArtwork data={data} state={state} effects={effects} reducedMotion={reducedMotion} />
    </Canvas>
  );
}

export default function HumanoidLabV9({ onExit }: { onExit?: () => void }) {
  const runtime = useAstraRuntime();
  const reducedMotion = useReducedMotion();
  const [data, setData] = useState<ParticleData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("particles");
  const [effects, setEffects] = useState(true);
  const [technical, setTechnical] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const fpsFrame = useRef({ frames: 0, started: 0 });

  useEffect(() => {
    const image = new Image();
    image.decoding = "async";
    image.src = ARTWORK;
    image.onload = () => {
      try {
        setData(buildParticleData(image));
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

  const effectiveEffects = effects && !reducedMotion;
  const state = runtime.avatarState;

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
    <main style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", background: "#000306", color: "#dffbff", fontFamily: "var(--font-mono)" }}>
      <img
        src={ARTWORK}
        alt="Approved ASTRA idle artwork reference"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
          opacity: view === "reference" ? 1 : view === "compare" ? 0.92 : 0,
          transition: "opacity 180ms ease", pointerEvents: "none",
        }}
      />

      <div style={{
        position: "absolute", inset: 0,
        opacity: view === "reference" ? 0 : 1,
        clipPath: view === "compare" ? "inset(0 0 0 50%)" : "none",
        pointerEvents: view === "reference" ? "none" : "auto",
      }}>
        {data ? (
          <ParticleScene data={data} state={state} effects={effectiveEffects} reducedMotion={reducedMotion} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#5cdcea", letterSpacing: ".18em" }}>
            {loadError ?? "SAMPLING APPROVED ARTWORK..."}
          </div>
        )}
      </div>

      {view === "compare" && <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "rgba(255,255,255,.42)", pointerEvents: "none" }} />}

      <header style={{ position: "absolute", top: 18, left: 20, zIndex: 20, textShadow: "0 1px 12px #000" }}>
        <div style={{ fontSize: 11, letterSpacing: ".28em", color: "#61efff" }}>ASTRA // HUMANOID V9</div>
        <div style={{ marginTop: 6, fontSize: 10, letterSpacing: ".18em", color: "rgba(223,251,255,.55)" }}>IMAGE-DRIVEN PARTICLE ENTITY</div>
      </header>

      <button onClick={exit} style={{ position: "absolute", top: 16, right: 18, zIndex: 30, border: "1px solid rgba(97,239,255,.55)", background: "rgba(0,8,12,.78)", color: "#aaf8ff", borderRadius: 18, padding: "8px 14px", fontFamily: "inherit", fontSize: 10, letterSpacing: ".16em" }}>
        EXIT
      </button>

      <section style={{ position: "absolute", left: 18, right: 18, bottom: 18, zIndex: 25, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, pointerEvents: "none" }}>
        <div style={{ display: "grid", gap: 9, pointerEvents: "auto" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {STATES.map((item) => (
              <button key={item} onClick={() => runtime.setAvatarState(item)} style={buttonStyle(state === item)}>{item.toUpperCase()}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {(["reference", "particles", "compare"] as ViewMode[]).map((item) => (
              <button key={item} onClick={() => setView(item)} style={buttonStyle(view === item)}>{item.toUpperCase()}</button>
            ))}
            <button onClick={() => setEffects((v) => !v)} style={buttonStyle(!effects)}>{effects ? "EFFECTS ON" : "EFFECTS OFF"}</button>
            <button onClick={() => setTechnical((v) => !v)} style={buttonStyle(technical)}>TECHNICAL</button>
          </div>
        </div>

        <div style={{ width: "min(440px, 44vw)", minWidth: 280, pointerEvents: "auto", border: "1px solid rgba(54,228,247,.28)", background: "rgba(0,7,11,.82)", backdropFilter: "blur(12px)", borderRadius: 14, padding: 12, boxShadow: "0 16px 60px rgba(0,0,0,.34)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 9, letterSpacing: ".18em", color: "#65eafb" }}>
            <span>{runtime.activeAgent ?? "ASTRA CORE"}</span>
            <span>{state.toUpperCase()}</span>
          </div>
          <div style={{ minHeight: 42, marginTop: 10, color: "rgba(225,250,255,.72)", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.5 }}>
            {runtime.lastResponse?.message ?? "Approved artwork is driving the humanoid particle field."}
          </div>
          <form onSubmit={submit} style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ketik perintah ASTRA..." style={{ flex: 1, minWidth: 0, border: "1px solid rgba(98,221,239,.22)", borderRadius: 8, background: "rgba(3,16,22,.9)", color: "#e8fdff", padding: "10px 11px", fontFamily: "inherit", outline: "none" }} />
            <button disabled={busy || !message.trim()} type="submit" style={{ ...buttonStyle(false), opacity: busy ? .55 : 1 }}>{busy ? "RUN" : "SEND"}</button>
          </form>
        </div>
      </section>

      {technical && (
        <aside style={{ position: "absolute", top: 64, right: 18, width: 290, zIndex: 24, border: "1px solid rgba(79,220,239,.25)", background: "rgba(0,7,11,.9)", borderRadius: 12, padding: 14, backdropFilter: "blur(10px)", fontSize: 10, lineHeight: 1.75, color: "rgba(220,248,252,.68)" }}>
          <div style={{ color: "#5eeaff", letterSpacing: ".18em", marginBottom: 8 }}>TECHNICAL DETAILS</div>
          <div>Artwork: astra-idle-v1.webp</div>
          <div>Sampler: {SAMPLE_W}×{SAMPLE_H}, step {STEP}px</div>
          <div>Particles: {data?.count ?? "loading"}</div>
          <div>FPS: {fps ?? "..."}</div>
          <div>Last request latency: {latency === null ? "not measured" : `${latency} ms`}</div>
          <div>Reduced motion: {reducedMotion ? "ON" : "OFF"}</div>
          <div>Effects: {effects ? "ON" : "OFF"}</div>
          <div>Renderer: Three.js via React Three Fiber</div>
          <div>Color: sRGB input/output, NoToneMapping</div>
          <div style={{ marginTop: 9, color: "rgba(255,190,90,.8)" }}>State buttons currently reuse the approved idle artwork; no unapproved state images are invented.</div>
        </aside>
      )}
    </main>
  );
}

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
