"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const FACE_MODEL = "https://threejs.org/examples/models/gltf/facecap.glb";

type AgentState = "idle" | "listening" | "thinking" | "speaking" | "success" | "error";
type FaceData = { scene: THREE.Group; morphMeshes: THREE.Mesh[]; scale: number; offset: THREE.Vector3; morphCount: number; meshCount: number };
const STATES: AgentState[] = ["idle", "listening", "thinking", "speaking", "success", "error"];

function normalize(name: string) { return name.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function morph(mesh: THREE.Mesh, names: string[], value: number, alpha: number) {
  if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
  for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
    const n = normalize(name);
    if (!names.some((needle) => n.includes(needle))) continue;
    mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[index] ?? 0, value, alpha);
  }
}

function stripTextures(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) return buffer;
  let offset = 12;
  const chunks: Array<{ type: number; data: Uint8Array }> = [];
  while (offset + 8 <= buffer.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    chunks.push({ type, data: new Uint8Array(buffer.slice(offset + 8, offset + 8 + length)) });
    offset += 8 + length;
  }
  const jsonChunk = chunks.find((chunk) => chunk.type === 0x4e4f534a);
  if (!jsonChunk) return buffer;
  const json = JSON.parse(new TextDecoder().decode(jsonChunk.data).replace(/\u0000+$/g, "").trim()) as Record<string, any>;
  delete json.images; delete json.textures; delete json.samplers;
  if (Array.isArray(json.materials)) for (const m of json.materials) {
    if (m?.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; }
    delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture;
  }
  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const padded = new Uint8Array(Math.ceil(encoded.byteLength / 4) * 4); padded.fill(0x20); padded.set(encoded); jsonChunk.data = padded;
  const total = 12 + chunks.reduce((sum, chunk) => sum + 8 + chunk.data.byteLength, 0);
  const out = new ArrayBuffer(total); const dv = new DataView(out);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  let w = 12;
  for (const chunk of chunks) { dv.setUint32(w, chunk.data.byteLength, true); dv.setUint32(w + 4, chunk.type, true); new Uint8Array(out, w + 8, chunk.data.byteLength).set(chunk.data); w += 8 + chunk.data.byteLength; }
  return out;
}

async function loadFace(): Promise<FaceData> {
  const response = await fetch(FACE_MODEL, { cache: "force-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(stripTextures(await response.arrayBuffer()), "");
  const scene = gltf.scene; const morphMeshes: THREE.Mesh[] = []; const morphNames = new Set<string>(); let meshCount = 0;
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh; if (!mesh.isMesh) return; meshCount += 1;
    mesh.material = new THREE.MeshStandardMaterial({ color: "#02090e", emissive: "#006b7c", emissiveIntensity: 0.45, transparent: true, opacity: 0.18, roughness: 0.5, metalness: 0.02, side: THREE.DoubleSide, depthWrite: false });
    if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) { morphMeshes.push(mesh); Object.keys(mesh.morphTargetDictionary).forEach((name) => morphNames.add(name)); }
  });
  const box = new THREE.Box3().setFromObject(scene); const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3()); const scale = size.y > 0.001 ? 2.35 / size.y : 1;
  return { scene, morphMeshes, scale, offset: new THREE.Vector3(-center.x, -center.y + 0.22 / scale, -center.z), morphCount: morphNames.size, meshCount };
}

function Contours({ active, speaking }: { active: boolean; speaking: boolean }) {
  const group = useRef<THREE.Group>(null);
  const lineObjects = useMemo(() => {
    const output: THREE.Line[] = [];
    for (let i = 0; i < 58; i += 1) {
      const p = i / 57; const y = THREE.MathUtils.lerp(-0.86, 1.05, p); const ny = (y + 0.02) / 1.03;
      const ellipse = Math.sqrt(Math.max(0, 1 - ny * ny)); const width = 0.42 + ellipse * 0.45; const depth = 0.28 + ellipse * 0.28;
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 88; s += 1) { const a = (s / 88) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * width, y, Math.sin(a) * depth)); }
      const geometry = new THREE.BufferGeometry().setFromPoints(pts);
      const material = new THREE.LineBasicMaterial({ color: 0x24d9ee, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
      output.push(new THREE.Line(geometry, material));
    }
    return output;
  }, []);

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.22) * 0.024;
    lineObjects.forEach((line, index) => {
      const material = line.material as THREE.LineBasicMaterial;
      material.opacity = (active ? 0.42 : 0.23) * (0.82 + 0.18 * Math.sin(clock.elapsedTime * 1.1 + index * 0.17));
      material.color.set(speaking ? 0x69f5ff : 0x24d9ee);
    });
  });

  return <group ref={group} position={[0, 0.2, -0.03]}>{lineObjects.map((line, index) => <primitive key={index} object={line} />)}</group>;
}

function Particles({ active }: { active: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => { const count = 950; const data = new Float32Array(count * 3); for (let i = 0; i < count; i += 1) { const a = i * 2.399963; const y = ((i * 37) % 100) / 100; const r = 0.58 + ((i * 23) % 100) / 250; data[i * 3] = Math.cos(a) * r * (0.55 + y * 0.5); data[i * 3 + 1] = 0.25 + y * 1.22; data[i * 3 + 2] = Math.sin(a) * r * 0.55 - 0.18; } return data; }, []);
  useFrame(({ clock }) => { if (!ref.current) return; ref.current.rotation.y = clock.elapsedTime * 0.04; });
  return <points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial color="#39eaff" size={active ? 0.022 : 0.016} transparent opacity={active ? 0.7 : 0.38} depthWrite={false} blending={THREE.AdditiveBlending} /></points>;
}

function Entity({ face, state }: { face: FaceData; state: AgentState }) {
  const root = useRef<THREE.Group>(null); const smooth = useRef({ yaw: 0, pitch: 0, roll: 0, mouth: 0, y: 0 }); const blinkStart = useRef(-1); const nextBlink = useRef(2.4);
  useFrame(({ clock, pointer }, dt) => {
    const t = clock.elapsedTime; let yaw = Math.sin(t * 0.28) * 0.016; let pitch = Math.sin(t * 0.35) * 0.008; let roll = 0; let y = Math.sin(t * 1.1) * 0.008;
    if (state === "listening") { yaw = pointer.x * 0.17; pitch = -pointer.y * 0.075; }
    else if (state === "thinking") { yaw = 0.075 + Math.sin(t * 0.45) * 0.03; pitch = -0.03; roll = 0.01; }
    else if (state === "speaking") { yaw = Math.sin(t * 0.52) * 0.028; pitch = Math.sin(t * 1.3) * 0.014; y += Math.abs(Math.sin(t * 2.4)) * 0.006; }
    else if (state === "error") { yaw = -0.03; pitch = 0.018; roll = -0.018; }
    const a = 1 - Math.exp(-dt * 6); smooth.current.yaw = THREE.MathUtils.lerp(smooth.current.yaw, yaw, a); smooth.current.pitch = THREE.MathUtils.lerp(smooth.current.pitch, pitch, a); smooth.current.roll = THREE.MathUtils.lerp(smooth.current.roll, roll, a); smooth.current.y = THREE.MathUtils.lerp(smooth.current.y, y, a);
    if (root.current) { root.current.rotation.set(smooth.current.pitch, smooth.current.yaw, smooth.current.roll); root.current.position.y = smooth.current.y; }
    if (t >= nextBlink.current && blinkStart.current < 0) { blinkStart.current = t; nextBlink.current = t + 3.2 + ((Math.sin(t * 4.1) + 1) * 0.5) * 1.9; }
    let blink = 0; if (blinkStart.current >= 0) { const elapsed = t - blinkStart.current; if (elapsed < 0.15) blink = Math.sin((elapsed / 0.15) * Math.PI); else blinkStart.current = -1; }
    const talk = state === "speaking" ? 0.06 + Math.abs(Math.sin(t * 7) * 0.2 + Math.sin(t * 11.5) * 0.1) : 0; smooth.current.mouth = THREE.MathUtils.lerp(smooth.current.mouth, talk, 1 - Math.exp(-dt * 12));
    for (const mesh of face.morphMeshes) { if (mesh.morphTargetInfluences) for (let i = 0; i < mesh.morphTargetInfluences.length; i += 1) mesh.morphTargetInfluences[i] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[i] ?? 0, 0, 1 - Math.exp(-dt * 7)); morph(mesh, ["eyeblinkleft", "eyeblinkl"], blink, 0.9); morph(mesh, ["eyeblinkright", "eyeblinkr"], blink, 0.9); morph(mesh, ["jawopen"], smooth.current.mouth, 0.82); morph(mesh, ["browdownleft", "browdownright"], state === "thinking" ? 0.1 : 0, 0.6); }
  });
  const active = state !== "idle"; const speaking = state === "speaking";
  return <group ref={root}><group scale={face.scale}><primitive object={face.scene} position={face.offset} /></group><Contours active={active} speaking={speaking} /><Particles active={active} /><mesh position={[0, -0.87, 0]}><cylinderGeometry args={[0.28, 0.4, 0.68, 48, 1, true]} /><meshBasicMaterial color="#0b8294" transparent opacity={0.22} wireframe /></mesh><mesh position={[0, -1.3, -0.04]} scale={[1.5, 0.46, 0.7]}><sphereGeometry args={[1, 48, 24]} /><meshBasicMaterial color="#087f90" transparent opacity={0.13} wireframe /></mesh><mesh position={[0, -0.18, 0.43]}><sphereGeometry args={[0.1, 24, 24]} /><meshBasicMaterial color="#ff9d32" transparent opacity={speaking ? 0.95 : 0.55} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh><pointLight position={[0, -0.18, 0.65]} intensity={speaking ? 3.5 : 1.9} color="#ff9d32" distance={3.5} /></group>;
}

function CameraRig() { const { camera, gl } = useThree(); const ref = useRef<OrbitControls | null>(null); useEffect(() => { const c = new OrbitControls(camera, gl.domElement); c.enableDamping = true; c.enablePan = false; c.target.set(0, -0.16, 0); c.minDistance = 3.5; c.maxDistance = 5.7; c.minAzimuthAngle = -0.5; c.maxAzimuthAngle = 0.5; c.update(); ref.current = c; return () => c.dispose(); }, [camera, gl]); useFrame(() => ref.current?.update()); return null; }

function Scene({ face, state }: { face: FaceData | null; state: AgentState }) { const active = state !== "idle"; return <><color attach="background" args={["#01070b"]} /><fog attach="fog" args={["#01070b", 6, 13]} /><ambientLight intensity={0.18} /><hemisphereLight args={["#5cf0ff", "#01070b", 0.65]} /><pointLight position={[-2, 1.1, 2]} intensity={active ? 2.0 : 1.0} color="#12dff2" distance={6} /><mesh position={[0, -0.08, -0.82]}><ringGeometry args={[1.5, 1.515, 128]} /><meshBasicMaterial color="#19d9eb" transparent opacity={active ? 0.26 : 0.14} /></mesh>{face ? <Entity face={face} state={state} /> : null}<CameraRig /></>; }

const buttonBase: CSSProperties = { borderRadius: 4, padding: "8px 10px", fontFamily: "inherit", fontSize: 9, letterSpacing: ".12em", cursor: "pointer" };

export default function HumanoidLabV7b() {
  const [face, setFace] = useState<FaceData | null>(null); const [state, setState] = useState<AgentState>("idle"); const [autoDemo, setAutoDemo] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { let alive = true; void loadFace().then((data) => alive && setFace(data)).catch((e) => { console.error(e); if (alive) setError("Gagal memuat geometry humanoid."); }); return () => { alive = false; }; }, []);
  useEffect(() => { if (!autoDemo) return; let i = 0; const timer = window.setInterval(() => { i = (i + 1) % STATES.length; setState(STATES[i]); }, 3400); return () => window.clearInterval(timer); }, [autoDemo]);
  const chooseState = useCallback((next: AgentState) => { setAutoDemo(false); setState(next); }, []); const label = state.toUpperCase();
  return <main style={{ height: "100vh", background: "#01070b", color: "#dffaff", fontFamily: "var(--font-mono, monospace)", overflow: "hidden" }}><div style={{ display: "grid", gridTemplateColumns: "1fr 300px", height: "100%" }}><section style={{ position: "relative", minWidth: 0 }}><Canvas style={{ width: "100%", height: "100%" }} camera={{ position: [0, 0, 4.25], fov: 31, near: 0.1, far: 30 }} dpr={[1, 1.5]}><Scene face={face} state={state} /></Canvas><div style={{ position: "absolute", left: 24, top: 20, pointerEvents: "none" }}><div style={{ fontSize: 10, letterSpacing: ".3em", color: "#61efff" }}>ASTRA // ENTITY INTERFACE V7</div><div style={{ marginTop: 10, fontFamily: "system-ui, sans-serif", fontWeight: 300, fontSize: 29 }}>Interactive Holographic Agent</div><div style={{ marginTop: 9, fontSize: 9, letterSpacing: ".18em", color: state === "speaking" ? "#ffb15e" : "rgba(151,241,255,.72)" }}>{label} // {autoDemo ? "AUTO" : "MANUAL"}</div></div><div style={{ position: "absolute", left: 24, bottom: 24, display: "flex", gap: 7, flexWrap: "wrap" }}><button type="button" onClick={() => setAutoDemo((v) => !v)} style={{ ...buttonBase, border: "1px solid rgba(255,167,76,.48)", background: autoDemo ? "rgba(255,154,54,.11)" : "rgba(2,12,18,.82)", color: "#ffc17b" }}>DEMO {autoDemo ? "ON" : "OFF"}</button>{STATES.map((value) => <button key={value} type="button" onClick={() => chooseState(value)} style={{ ...buttonBase, border: `1px solid ${state === value ? "rgba(54,234,255,.82)" : "rgba(145,233,255,.16)"}`, background: state === value ? "rgba(0,218,242,.11)" : "rgba(2,12,18,.82)", color: state === value ? "#9af8ff" : "rgba(220,247,255,.54)" }}>{value.toUpperCase()}</button>)}</div>{!face && !error ? <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", fontSize: 10, letterSpacing: ".24em", color: "rgba(125,241,255,.76)" }}>INITIALIZING ENTITY...</div> : null}</section><aside style={{ borderLeft: "1px solid rgba(81,220,244,.12)", background: "rgba(2,10,15,.96)", padding: 22 }}><a href="/" style={{ color: "rgba(183,243,255,.62)", textDecoration: "none", fontSize: 9, letterSpacing: ".15em" }}>← KEMBALI KE ASTRA</a><div style={{ marginTop: 28, fontSize: 8, letterSpacing: ".18em", color: "rgba(97,239,255,.58)" }}>ENTITY</div><div style={{ marginTop: 8, fontFamily: "system-ui, sans-serif", fontSize: 18 }}>ASTRA H-01</div><div style={{ marginTop: 8, fontSize: 9, lineHeight: 1.7, color: "rgba(211,244,251,.45)" }}>Original ASTRA holographic agent interface. Human geometry is used only as a motion foundation; visible styling is ASTRA-specific.</div><div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid rgba(81,220,244,.1)", display: "grid", gridTemplateColumns: "1fr auto", gap: "8px 12px", fontSize: 9, color: "rgba(211,244,251,.5)" }}><span>State</span><strong style={{ color: "#9af8ff" }}>{label}</strong><span>Geometry</span><strong style={{ color: face ? "#98ffbd" : "#ffc17b" }}>{face ? "READY" : "LOADING"}</strong><span>Morph targets</span><strong>{face?.morphCount ?? 0}</strong><span>Textures</span><strong style={{ color: "#98ffbd" }}>OFF</strong><span>Agent link</span><strong style={{ color: "#ffc17b" }}>SIMULATED</strong></div><div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid rgba(81,220,244,.1)", fontSize: 9, lineHeight: 1.8, color: "rgba(211,244,251,.46)" }}>LISTENING → pointer tracking<br/>THINKING → focus posture<br/>SPEAKING → mouth morph + orange core<br/>NEXT → real voice/TTS/runtime state</div>{error ? <div style={{ marginTop: 20, color: "#ffb1b1", fontSize: 9 }}>{error}</div> : null}</aside></div></main>;
}
