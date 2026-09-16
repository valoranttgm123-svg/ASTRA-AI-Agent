"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const FACE_MODEL = "https://threejs.org/examples/models/gltf/facecap.glb";

type AgentState = "idle" | "listening" | "thinking" | "speaking" | "success" | "error";
type FaceStats = { meshes: number; morphTargets: number; animationClips: number };
type LoadedFace = {
  scene: THREE.Group;
  morphMeshes: THREE.Mesh[];
  scale: number;
  offset: THREE.Vector3;
  stats: FaceStats;
};

const STATES: AgentState[] = ["idle", "listening", "thinking", "speaking", "success", "error"];
const GLB_JSON = 0x4e4f534a;
const GLB_BIN = 0x004e4942;

function stripTextureFields(material: Record<string, unknown>) {
  const next = structuredClone(material);
  const pbr = next.pbrMetallicRoughness as Record<string, unknown> | undefined;
  if (pbr) {
    delete pbr.baseColorTexture;
    delete pbr.metallicRoughnessTexture;
  }
  delete next.normalTexture;
  delete next.occlusionTexture;
  delete next.emissiveTexture;
  return next;
}

function sanitizeGlbTextures(source: ArrayBuffer) {
  const view = new DataView(source);
  if (view.getUint32(0, true) !== 0x46546c67) return source;

  const chunks: { type: number; data: Uint8Array }[] = [];
  let offset = 12;
  while (offset + 8 <= source.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const data = new Uint8Array(source, offset + 8, length);
    chunks.push({ type, data });
    offset += 8 + length;
  }

  const jsonChunk = chunks.find((chunk) => chunk.type === GLB_JSON);
  if (!jsonChunk) return source;

  const jsonText = new TextDecoder().decode(jsonChunk.data).replace(/\u0000+$/g, "").trimEnd();
  const json = JSON.parse(jsonText) as Record<string, unknown>;
  delete json.images;
  delete json.textures;
  delete json.samplers;

  if (Array.isArray(json.materials)) {
    json.materials = (json.materials as Record<string, unknown>[]).map(stripTextureFields);
  }

  for (const key of ["extensionsUsed", "extensionsRequired"] as const) {
    if (Array.isArray(json[key])) {
      json[key] = (json[key] as string[]).filter((name) => name !== "KHR_texture_basisu" && name !== "EXT_texture_webp");
    }
  }

  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = Math.ceil(encoded.length / 4) * 4;
  const jsonData = new Uint8Array(jsonLength);
  jsonData.fill(0x20);
  jsonData.set(encoded);

  const binChunks = chunks.filter((chunk) => chunk.type === GLB_BIN);
  const totalLength = 12 + 8 + jsonData.length + binChunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
  const output = new ArrayBuffer(totalLength);
  const out = new DataView(output);
  out.setUint32(0, 0x46546c67, true);
  out.setUint32(4, 2, true);
  out.setUint32(8, totalLength, true);

  let cursor = 12;
  out.setUint32(cursor, jsonData.length, true);
  out.setUint32(cursor + 4, GLB_JSON, true);
  new Uint8Array(output, cursor + 8, jsonData.length).set(jsonData);
  cursor += 8 + jsonData.length;

  for (const chunk of binChunks) {
    out.setUint32(cursor, chunk.data.length, true);
    out.setUint32(cursor + 4, chunk.type, true);
    new Uint8Array(output, cursor + 8, chunk.data.length).set(chunk.data);
    cursor += 8 + chunk.data.length;
  }

  return output;
}

function normalizeMorph(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function setMorph(mesh: THREE.Mesh, fragments: string[], target: number, alpha: number) {
  if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
  for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
    const normalized = normalizeMorph(name);
    if (!fragments.some((fragment) => normalized.includes(fragment))) continue;
    const current = mesh.morphTargetInfluences[index] ?? 0;
    mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(current, target, alpha);
  }
}

function hologramMaterial() {
  return new THREE.MeshStandardMaterial({
    color: "#04141c",
    emissive: "#00cde8",
    emissiveIntensity: 1.05,
    roughness: 0.3,
    metalness: 0.08,
    transparent: true,
    opacity: 0.52,
    wireframe: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

async function loadTexturelessFace(): Promise<LoadedFace> {
  const response = await fetch(FACE_MODEL, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Face model HTTP ${response.status}`);
  const raw = await response.arrayBuffer();
  const clean = sanitizeGlbTextures(raw);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(clean, "https://threejs.org/examples/models/gltf/");
  const scene = gltf.scene;
  const morphMeshes: THREE.Mesh[] = [];
  const morphNames = new Set<string>();
  let meshes = 0;

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes += 1;
    mesh.material = hologramMaterial();
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
      morphMeshes.push(mesh);
      Object.keys(mesh.morphTargetDictionary).forEach((name) => morphNames.add(name));
    }
  });

  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = size.y > 0.0001 ? 2.65 / size.y : 1;
  const offset = new THREE.Vector3(-center.x, -center.y + 0.28 / scale, -center.z);

  return {
    scene,
    morphMeshes,
    scale,
    offset,
    stats: { meshes, morphTargets: morphNames.size, animationClips: gltf.animations.length },
  };
}

function FaceEntity({ state, onReady, onError }: { state: AgentState; onReady: (stats: FaceStats) => void; onError: (message: string) => void }) {
  const [face, setFace] = useState<LoadedFace | null>(null);
  const root = useRef<THREE.Group>(null);
  const smooth = useRef({ yaw: 0, pitch: 0, roll: 0, mouth: 0, y: 0 });
  const nextBlink = useRef(2.4);
  const blinkStart = useRef(-1);

  useEffect(() => {
    let cancelled = false;
    void loadTexturelessFace()
      .then((loaded) => {
        if (cancelled) return;
        setFace(loaded);
        onReady(loaded.stats);
      })
      .catch((cause) => {
        console.error(cause);
        if (!cancelled) onError("Geometry wajah gagal dimuat. Refresh halaman dan periksa koneksi internet.");
      });
    return () => { cancelled = true; };
  }, [onError, onReady]);

  useFrame(({ clock, pointer }, dt) => {
    if (!face) return;
    const t = clock.elapsedTime;
    const k = 1 - Math.exp(-dt * 6.2);
    let yaw = Math.sin(t * 0.32) * 0.015;
    let pitch = Math.sin(t * 0.43) * 0.008;
    let roll = Math.sin(t * 0.27) * 0.005;
    let y = Math.sin(t * 1.2) * 0.007;

    if (state === "listening") {
      yaw = pointer.x * 0.22;
      pitch = -pointer.y * 0.09;
      roll = -pointer.x * 0.014;
    } else if (state === "thinking") {
      yaw = 0.09 + Math.sin(t * 0.5) * 0.04;
      pitch = -0.04 + Math.sin(t * 0.34) * 0.012;
    } else if (state === "speaking") {
      yaw = Math.sin(t * 0.6) * 0.03;
      pitch = Math.sin(t * 1.5) * 0.016;
      y += Math.abs(Math.sin(t * 2.8)) * 0.006;
    } else if (state === "success") {
      pitch = -0.03 + Math.sin(t * 2.5) * 0.016;
    } else if (state === "error") {
      yaw = -0.035;
      pitch = 0.025;
      roll = -0.02;
    }

    smooth.current.yaw = THREE.MathUtils.lerp(smooth.current.yaw, yaw, k);
    smooth.current.pitch = THREE.MathUtils.lerp(smooth.current.pitch, pitch, k);
    smooth.current.roll = THREE.MathUtils.lerp(smooth.current.roll, roll, k);
    smooth.current.y = THREE.MathUtils.lerp(smooth.current.y, y, k);
    if (root.current) {
      root.current.rotation.set(smooth.current.pitch, smooth.current.yaw, smooth.current.roll);
      root.current.position.y = smooth.current.y;
    }

    if (t >= nextBlink.current && blinkStart.current < 0) {
      blinkStart.current = t;
      nextBlink.current = t + 3 + ((Math.sin(t * 4.1) + 1) * 0.5) * 2;
    }
    let blink = 0;
    if (blinkStart.current >= 0) {
      const elapsed = t - blinkStart.current;
      if (elapsed <= 0.15) blink = Math.sin((elapsed / 0.15) * Math.PI);
      else blinkStart.current = -1;
    }

    const talk = state === "speaking" ? 0.1 + Math.abs(Math.sin(t * 7.6) * 0.35 + Math.sin(t * 11.9) * 0.15) : 0;
    smooth.current.mouth = THREE.MathUtils.lerp(smooth.current.mouth, talk, 1 - Math.exp(-dt * 13));

    for (const mesh of face.morphMeshes) {
      if (mesh.morphTargetInfluences) {
        for (let i = 0; i < mesh.morphTargetInfluences.length; i += 1) {
          mesh.morphTargetInfluences[i] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[i] ?? 0, 0, 1 - Math.exp(-dt * 7));
        }
      }
      setMorph(mesh, ["eyeblinkleft", "eyeblinkl"], blink, 0.9);
      setMorph(mesh, ["eyeblinkright", "eyeblinkr"], blink, 0.9);
      setMorph(mesh, ["jawopen"], smooth.current.mouth, 0.86);
      setMorph(mesh, ["mouthsmileleft", "mouthsmilel"], state === "success" ? 0.28 : 0, 0.65);
      setMorph(mesh, ["mouthsmileright", "mouthsmiler"], state === "success" ? 0.28 : 0, 0.65);
      setMorph(mesh, ["mouthfrownleft", "mouthfrownl"], state === "error" ? 0.22 : 0, 0.65);
      setMorph(mesh, ["mouthfrownright", "mouthfrownr"], state === "error" ? 0.22 : 0, 0.65);
      setMorph(mesh, ["browdownleft", "browdownl", "browdownright", "browdownr"], state === "thinking" ? 0.15 : 0, 0.6);
    }
  });

  return (
    <group ref={root}>
      {face ? <group scale={face.scale}><primitive object={face.scene} position={face.offset} /></group> : null}
      <mesh position={[0, -0.86, -0.08]} scale={[1.25, 0.18, 0.6]}>
        <sphereGeometry args={[1, 64, 28]} />
        <meshBasicMaterial color="#00b9d2" wireframe transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.98, 0.2]}>
        <sphereGeometry args={[0.085, 24, 24]} />
        <meshBasicMaterial color="#ff9c35" transparent opacity={state === "speaking" ? 0.95 : 0.58} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Particles({ active }: { active: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 780;
    const data = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const a = i * 2.399963;
      const y = ((i * 43) % 100) / 100;
      const r = 0.66 + ((i * 29) % 100) / 190;
      data[i * 3] = Math.cos(a) * r * (0.58 + y * 0.42);
      data[i * 3 + 1] = y * 1.45 - 0.36;
      data[i * 3 + 2] = Math.sin(a) * r * 0.58 - 0.32;
    }
    return data;
  }, []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.035;
  });
  return <points ref={ref} position={[0, 0.38, -0.35]}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <pointsMaterial color="#1ce8ff" size={active ? 0.024 : 0.017} transparent opacity={active ? 0.76 : 0.42} depthWrite={false} blending={THREE.AdditiveBlending} />
  </points>;
}

function Controls() {
  const { camera, gl } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const next = new OrbitControls(camera, gl.domElement);
    next.enableDamping = true;
    next.dampingFactor = 0.07;
    next.enablePan = false;
    next.target.set(0, -0.05, 0);
    next.minDistance = 2.7;
    next.maxDistance = 5.4;
    next.minAzimuthAngle = -Math.PI * 0.35;
    next.maxAzimuthAngle = Math.PI * 0.35;
    next.update();
    controls.current = next;
    return () => { next.dispose(); controls.current = null; };
  }, [camera, gl]);
  useFrame(() => controls.current?.update());
  return null;
}

function Scene({ state, onReady, onError }: { state: AgentState; onReady: (stats: FaceStats) => void; onError: (message: string) => void }) {
  const active = state !== "idle";
  return <>
    <color attach="background" args={["#02070d"]} />
    <fog attach="fog" args={["#02070d", 6, 12]} />
    <ambientLight intensity={0.25} />
    <hemisphereLight args={["#7ff5ff", "#01050a", 0.75]} />
    <pointLight position={[0, 0.1, 2.5]} intensity={2.8} color="#00dff5" />
    <pointLight position={[0, -0.55, 1.4]} intensity={state === "speaking" ? 4.3 : 2.2} color="#ff9c35" />
    <mesh position={[0, 0.12, -0.7]}>
      <ringGeometry args={[1.28, 1.29, 160]} />
      <meshBasicMaterial color="#20eaff" transparent opacity={active ? 0.34 : 0.18} />
    </mesh>
    <Particles active={active} />
    <FaceEntity state={state} onReady={onReady} onError={onError} />
    <Controls />
  </>;
}

const buttonStyle: CSSProperties = {
  borderRadius: 6,
  padding: "8px 11px",
  fontFamily: "inherit",
  fontSize: 9,
  letterSpacing: ".12em",
  cursor: "pointer",
};

export default function HumanoidLabV6() {
  const [state, setState] = useState<AgentState>("idle");
  const [autoDemo, setAutoDemo] = useState(true);
  const [stats, setStats] = useState<FaceStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoDemo) return;
    let index = 0;
    const timer = window.setInterval(() => {
      index = (index + 1) % STATES.length;
      setState(STATES[index]);
    }, 3300);
    return () => window.clearInterval(timer);
  }, [autoDemo]);

  const choose = (next: AgentState) => {
    setAutoDemo(false);
    setState(next);
  };

  return <main style={{ height: "100vh", background: "#02070d", color: "#eafcff", fontFamily: "var(--font-mono, monospace)", overflow: "hidden" }}>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 330px", height: "100%" }}>
      <section style={{ position: "relative", height: "100%" }}>
        <Canvas camera={{ position: [0, 0.02, 3.8], fov: 31, near: 0.1, far: 20 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}>
          <Scene state={state} onReady={(value) => { setStats(value); setError(null); }} onError={setError} />
        </Canvas>
        <div style={{ position: "absolute", left: 20, top: 20, pointerEvents: "none" }}>
          <div style={{ fontSize: 11, letterSpacing: ".28em", color: "#78efff" }}>ASTRA // TEXTURELESS HUMAN V6</div>
          <div style={{ marginTop: 8, fontSize: 27, fontFamily: "system-ui, sans-serif", fontWeight: 300 }}>Faceless Morph Rig</div>
          <div style={{ marginTop: 8, fontSize: 10, letterSpacing: ".13em", color: "#ffb363" }}>{state.toUpperCase()} // {autoDemo ? "AUTO DEMO" : "MANUAL"}</div>
        </div>
        <div style={{ position: "absolute", left: 20, bottom: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setAutoDemo((value) => !value)} style={{ ...buttonStyle, border: "1px solid rgba(255,170,80,.55)", background: autoDemo ? "rgba(255,155,55,.13)" : "rgba(2,12,21,.85)", color: "#ffc681" }}>DEMO {autoDemo ? "ON" : "OFF"}</button>
          {STATES.map((value) => <button key={value} type="button" onClick={() => choose(value)} style={{ ...buttonStyle, border: `1px solid ${state === value ? "rgba(0,229,255,.85)" : "rgba(150,235,255,.18)"}`, background: state === value ? "rgba(0,229,255,.13)" : "rgba(2,12,21,.85)", color: state === value ? "#a0f9ff" : "rgba(220,248,255,.62)" }}>{value.toUpperCase()}</button>)}
        </div>
      </section>
      <aside style={{ borderLeft: "1px solid rgba(87,220,255,.14)", padding: 22, background: "rgba(2,10,17,.97)" }}>
        <a href="/" style={{ color: "rgba(180,242,255,.7)", textDecoration: "none", fontSize: 10, letterSpacing: ".16em" }}>← KEMBALI KE ASTRA</a>
        <div style={{ marginTop: 28, fontSize: 9, letterSpacing: ".18em", color: "rgba(117,242,255,.65)" }}>V6 STATUS</div>
        <div style={{ marginTop: 8, fontSize: 18, fontFamily: "system-ui, sans-serif" }}>Textureless FaceCap geometry</div>
        <div style={{ marginTop: 10, fontSize: 10, lineHeight: 1.65, color: "rgba(220,245,255,.48)" }}>Texture dihapus sebelum GLTFLoader melakukan parse. Tidak ada Blob texture URL, jadi error texture localhost seharusnya hilang.</div>
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid rgba(87,220,255,.12)", display: "grid", gridTemplateColumns: "1fr auto", gap: "8px 12px", fontSize: 10, color: "rgba(220,245,255,.58)" }}>
          <span>Meshes</span><strong style={{ color: "#b9f9ff" }}>{stats?.meshes ?? "…"}</strong>
          <span>Morph targets</span><strong style={{ color: "#b9f9ff" }}>{stats?.morphTargets ?? "…"}</strong>
          <span>Animation clips</span><strong style={{ color: "#b9f9ff" }}>{stats?.animationClips ?? "…"}</strong>
          <span>Texture dependency</span><strong style={{ color: "#8fffb1" }}>NONE</strong>
        </div>
        {error ? <div style={{ marginTop: 20, padding: 12, border: "1px solid rgba(255,90,90,.3)", color: "#ffb3b3", fontSize: 10, lineHeight: 1.55 }}>{error}</div> : null}
      </aside>
    </div>
  </main>;
}
