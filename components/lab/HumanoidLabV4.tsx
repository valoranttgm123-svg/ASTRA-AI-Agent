"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ChangeEvent, CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const DEFAULT_MODEL =
  "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/RobotExpressive/RobotExpressive.glb";

type AgentState = "idle" | "listening" | "thinking" | "speaking" | "success" | "error";

type Rig = {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  scale: number;
  offset: THREE.Vector3;
  head: THREE.Object3D | null;
  neck: THREE.Object3D | null;
  chest: THREE.Object3D | null;
  morphMeshes: THREE.Mesh[];
  materials: THREE.MeshStandardMaterial[];
  stats: { bones: number; meshes: number; skinned: number; morphs: string[] };
};

const STATES: AgentState[] = ["idle", "listening", "thinking", "speaking", "success", "error"];
const CLIP_HINTS: Record<AgentState, string[]> = {
  idle: ["Idle", "Standing"],
  listening: ["Standing", "Idle"],
  thinking: ["Idle", "Standing"],
  speaking: ["Idle", "Standing"],
  success: ["ThumbsUp", "Yes", "Wave", "Idle"],
  error: ["No", "Idle"],
};

function findObject(root: THREE.Object3D, names: string[]) {
  const needles = names.map((name) => name.toLowerCase());
  let result: THREE.Object3D | null = null;
  root.traverse((object) => {
    if (result) return;
    const name = object.name.toLowerCase();
    if (needles.includes(name) || needles.some((needle) => name.includes(needle))) result = object;
  });
  return result;
}

function inspect(scene: THREE.Group) {
  let bones = 0, meshes = 0, skinned = 0;
  const morphs = new Set<string>();
  scene.traverse((object) => {
    if ((object as THREE.Bone).isBone) bones += 1;
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes += 1;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) skinned += 1;
    Object.keys(mesh.morphTargetDictionary ?? {}).forEach((name) => morphs.add(name));
  });
  return { bones, meshes, skinned, morphs: [...morphs].sort() };
}

function safeHologramMaterial(materials: THREE.MeshStandardMaterial[]) {
  const material = new THREE.MeshStandardMaterial({
    color: "#052532",
    emissive: "#00bcd8",
    emissiveIntensity: 1.05,
    roughness: 0.32,
    metalness: 0.12,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
  materials.push(material);
  return material;
}

async function loadRig(url: string): Promise<Rig> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = gltf.scene;
  const materials: THREE.MeshStandardMaterial[] = [];
  const morphMeshes: THREE.Mesh[] = [];

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const count = Array.isArray(mesh.material) ? mesh.material.length : 1;
    const replacements = Array.from({ length: count }, () => safeHologramMaterial(materials));
    mesh.material = Array.isArray(mesh.material) ? replacements : replacements[0];
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) morphMeshes.push(mesh);
  });

  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  return {
    scene,
    clips: gltf.animations,
    scale: size.y > 0.0001 ? 4.6 / size.y : 1,
    offset: new THREE.Vector3(-center.x, -box.min.y, -center.z),
    head: findObject(scene, ["Head", "head", "mixamorigHead", "J_Bip_C_Head"]),
    neck: findObject(scene, ["Neck", "neck", "mixamorigNeck", "J_Bip_C_Neck"]),
    chest: findObject(scene, ["Spine2", "Spine1", "Chest", "UpperChest", "mixamorigSpine2"]),
    morphMeshes,
    materials,
    stats: inspect(scene),
  };
}

function selectClip(clips: THREE.AnimationClip[], state: AgentState) {
  for (const hint of CLIP_HINTS[state]) {
    const clip = clips.find((candidate) => candidate.name.toLowerCase() === hint.toLowerCase());
    if (clip) return clip;
  }
  return clips[0] ?? null;
}

function setMorph(mesh: THREE.Mesh, names: string[], value: number) {
  if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
  for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (names.some((target) => normalized.includes(target))) mesh.morphTargetInfluences[index] = value;
  }
}

function CameraControls() {
  const { camera, gl } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const instance = new OrbitControls(camera, gl.domElement);
    instance.enableDamping = true;
    instance.dampingFactor = 0.06;
    instance.target.set(0, 3.0, 0);
    instance.minDistance = 3.4;
    instance.maxDistance = 7;
    instance.minPolarAngle = Math.PI * 0.29;
    instance.maxPolarAngle = Math.PI * 0.68;
    instance.update();
    controls.current = instance;
    return () => { instance.dispose(); controls.current = null; };
  }, [camera, gl]);
  useFrame(() => controls.current?.update());
  return null;
}

function Particles({ active }: { active: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 640;
    const data = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const a = i * 2.399963;
      const n = ((i * 47) % 100) / 100;
      const r = 0.72 + ((i * 31) % 100) / 180;
      data[i * 3] = Math.cos(a) * r * (0.55 + n * 0.5);
      data[i * 3 + 1] = n * 1.55 - 0.35;
      data[i * 3 + 2] = Math.sin(a) * r * 0.58 - 0.16;
    }
    return data;
  }, []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.05;
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.25) * 0.03;
  });
  return (
    <points ref={ref} position={[0, 3.5, -0.35]}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial color="#22eaff" size={active ? 0.034 : 0.024} transparent opacity={active ? 0.8 : 0.48} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function Avatar({ rig, state }: { rig: Rig; state: AgentState }) {
  const root = useRef<THREE.Group>(null);
  const mixer = useMemo(() => new THREE.AnimationMixer(rig.scene), [rig.scene]);
  const action = useRef<THREE.AnimationAction | null>(null);
  const headBase = useMemo(() => rig.head?.rotation.clone() ?? new THREE.Euler(), [rig.head]);
  const neckBase = useMemo(() => rig.neck?.rotation.clone() ?? new THREE.Euler(), [rig.neck]);
  const chestBase = useMemo(() => rig.chest?.rotation.clone() ?? new THREE.Euler(), [rig.chest]);
  const smooth = useRef({ yaw: 0, pitch: 0, roll: 0, x: 0, y: 0 });

  useEffect(() => {
    const clip = selectClip(rig.clips, state);
    if (!clip) return;
    const next = mixer.clipAction(clip);
    if (next !== action.current) {
      action.current?.fadeOut(0.25);
      next.reset().setEffectiveWeight(1).setEffectiveTimeScale(state === "thinking" ? 0.72 : 1).fadeIn(0.25);
      if (state === "success" || state === "error") { next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true; }
      else { next.setLoop(THREE.LoopRepeat, Infinity); next.clampWhenFinished = false; }
      next.play();
      action.current = next;
    }
  }, [mixer, rig.clips, state]);

  useEffect(() => () => { mixer.stopAllAction(); }, [mixer]);

  useFrame(({ clock, pointer }, dt) => {
    mixer.update(dt);
    const t = clock.elapsedTime;
    const active = state !== "idle";
    for (const material of rig.materials) {
      material.emissiveIntensity = state === "speaking" ? 1.55 : state === "thinking" ? 1.25 : active ? 1.15 : 0.95;
      material.opacity = state === "speaking" ? 0.9 : 0.8;
    }

    let yaw = 0, pitch = 0, roll = 0, x = 0;
    let y = Math.sin(t * 1.5) * 0.018;
    if (state === "listening") { yaw = pointer.x * 0.22; pitch = -pointer.y * 0.1; x = pointer.x * 0.055; }
    if (state === "thinking") { yaw = 0.16 + Math.sin(t * 0.55) * 0.08; pitch = -0.07 + Math.sin(t * 0.38) * 0.03; roll = Math.sin(t * 0.5) * 0.018; }
    if (state === "speaking") { yaw = Math.sin(t * 0.8) * 0.075; pitch = Math.sin(t * 1.8) * 0.04; roll = Math.sin(t * 1.2) * 0.014; y += Math.abs(Math.sin(t * 3.2)) * 0.018; }
    if (state === "success") { pitch = -0.08 + Math.sin(t * 2.7) * 0.04; yaw = Math.sin(t * 1.0) * 0.04; }
    if (state === "error") { pitch = 0.07; roll = -0.07; yaw = -0.05; }

    const k = 1 - Math.exp(-dt * 6.2);
    smooth.current.yaw = THREE.MathUtils.lerp(smooth.current.yaw, yaw, k);
    smooth.current.pitch = THREE.MathUtils.lerp(smooth.current.pitch, pitch, k);
    smooth.current.roll = THREE.MathUtils.lerp(smooth.current.roll, roll, k);
    smooth.current.x = THREE.MathUtils.lerp(smooth.current.x, x, k);
    smooth.current.y = THREE.MathUtils.lerp(smooth.current.y, y, k);

    if (root.current) {
      const fallback = rig.head ? 0.5 : 1;
      root.current.rotation.y = smooth.current.yaw * fallback;
      root.current.rotation.x = smooth.current.pitch * fallback;
      root.current.rotation.z = smooth.current.roll * fallback;
      root.current.position.x = smooth.current.x * fallback;
      root.current.position.y = smooth.current.y;
    }

    if (rig.head) rig.head.rotation.set(headBase.x + smooth.current.pitch, headBase.y + smooth.current.yaw, headBase.z + smooth.current.roll);
    if (rig.neck) rig.neck.rotation.set(neckBase.x + smooth.current.pitch * 0.32, neckBase.y + smooth.current.yaw * 0.26, neckBase.z + smooth.current.roll * 0.22);
    if (rig.chest) rig.chest.rotation.set(chestBase.x + Math.sin(t * 1.5) * 0.012, chestBase.y, chestBase.z + Math.sin(t * 0.55) * 0.007);

    const talk = state === "speaking" ? 0.18 + Math.abs(Math.sin(t * 7.8) * 0.38 + Math.sin(t * 12.5) * 0.18) : 0;
    for (const mesh of rig.morphMeshes) {
      setMorph(mesh, ["jawopen", "mouthopen", "visemeaa", "visemea"], talk);
      setMorph(mesh, ["surprised"], state === "speaking" ? talk * 0.3 : 0);
      setMorph(mesh, ["smile"], state === "success" ? 0.45 : 0);
      setMorph(mesh, ["sad"], state === "error" ? 0.42 : 0);
      setMorph(mesh, ["angry"], state === "thinking" ? 0.1 : 0);
    }
  });

  return <group ref={root}><group scale={rig.scale}><primitive object={rig.scene} position={rig.offset} /></group></group>;
}

function Scene({ rig, state }: { rig: Rig | null; state: AgentState }) {
  const active = state !== "idle";
  const speaking = state === "speaking";
  return (
    <>
      <color attach="background" args={["#02070d"]} />
      <fog attach="fog" args={["#02070d", 8, 16]} />
      <ambientLight intensity={0.42} />
      <hemisphereLight args={["#7ff4ff", "#02060b", 0.95]} />
      <directionalLight position={[3, 6, 5]} intensity={1.5} color="#bafaff" />
      <pointLight position={[-2.2, 3.4, 2.5]} intensity={active ? 2.8 : 1.6} color="#00e5ff" />
      <pointLight position={[0.2, 3.35, 1.2]} intensity={speaking ? 5 : 2.6} color="#ff9d31" />
      <mesh position={[0, 3.42, -0.65]}><ringGeometry args={[1.28, 1.295, 128]} /><meshBasicMaterial color="#10e5ff" transparent opacity={active ? 0.45 : 0.25} /></mesh>
      <mesh position={[0, 3.4, -0.42]}><sphereGeometry args={[0.13, 32, 32]} /><meshBasicMaterial color="#ff9d31" transparent opacity={speaking ? 1 : 0.58} /></mesh>
      <Particles active={active} />
      {rig ? <Avatar rig={rig} state={state} /> : null}
      <CameraControls />
    </>
  );
}

const buttonBase: CSSProperties = { borderRadius: 6, padding: "8px 11px", fontFamily: "inherit", fontSize: 9, letterSpacing: ".12em", cursor: "pointer" };

export default function HumanoidLabV4() {
  const [rig, setRig] = useState<Rig | null>(null);
  const [state, setState] = useState<AgentState>("idle");
  const [autoDemo, setAutoDemo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelName, setModelName] = useState("RobotExpressive — safe hologram");
  const localUrl = useRef<string | null>(null);

  const load = async (url: string, name: string) => {
    setLoading(true); setError(null);
    try { setRig(await loadRig(url)); setModelName(name); }
    catch (cause) { console.error(cause); setError("Model gagal dimuat. Coba refresh atau pilih file .glb dari PC."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    void load(DEFAULT_MODEL, "RobotExpressive — safe hologram");
    return () => { if (localUrl.current) URL.revokeObjectURL(localUrl.current); };
  }, []);

  useEffect(() => {
    if (!autoDemo) return;
    let index = 0;
    const timer = window.setInterval(() => { index = (index + 1) % STATES.length; setState(STATES[index]); }, 3200);
    return () => window.clearInterval(timer);
  }, [autoDemo]);

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) { setError("Gunakan file .glb."); return; }
    if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    localUrl.current = URL.createObjectURL(file);
    void load(localUrl.current, file.name);
  };

  return (
    <main style={{ height: "100vh", background: "#02070d", color: "#e9fbff", fontFamily: "var(--font-mono, monospace)", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", height: "100%" }}>
        <section style={{ position: "relative", height: "100%", overflow: "hidden" }}>
          <Canvas style={{ width: "100%", height: "100%", display: "block" }} camera={{ position: [0, 3.05, 4.8], fov: 32, near: 0.1, far: 30 }} dpr={[1, 1.6]} gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}>
            <Scene rig={rig} state={state} />
          </Canvas>
          <div style={{ position: "absolute", left: 22, top: 20, pointerEvents: "none" }}>
            <div style={{ fontSize: 11, letterSpacing: ".28em", color: "#7cf4ff" }}>ASTRA // HUMANOID MOTION TEST V4</div>
            <div style={{ marginTop: 8, fontSize: 27, fontFamily: "system-ui, sans-serif", fontWeight: 300 }}>Shader-Safe Live Motion</div>
            <div style={{ marginTop: 8, fontSize: 10, letterSpacing: ".14em", color: "#ffb25f" }}>{state.toUpperCase()} // {autoDemo ? "AUTO DEMO" : "MANUAL"}</div>
          </div>
          <div style={{ position: "absolute", left: 22, bottom: 22, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setAutoDemo((value) => !value)} style={{ ...buttonBase, border: "1px solid rgba(255,166,76,.6)", background: autoDemo ? "rgba(255,155,55,.14)" : "rgba(2,12,21,.8)", color: "#ffc37f" }}>AUTO DEMO {autoDemo ? "ON" : "OFF"}</button>
            {STATES.map((value) => <button key={value} type="button" onClick={() => { setAutoDemo(false); setState(value); }} style={{ ...buttonBase, border: `1px solid ${state === value ? "rgba(0,229,255,.85)" : "rgba(150,235,255,.18)"}`, background: state === value ? "rgba(0,229,255,.13)" : "rgba(2,12,21,.8)", color: state === value ? "#9af9ff" : "rgba(220,248,255,.62)" }}>{value.toUpperCase()}</button>)}
          </div>
          {loading ? <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(2,7,13,.72)" }}><div style={{ fontSize: 11, letterSpacing: ".24em", color: "#8ff8ff" }}>LOADING SAFE RIG...</div></div> : null}
        </section>
        <aside style={{ borderLeft: "1px solid rgba(87,220,255,.14)", padding: 22, background: "rgba(2,10,17,.97)", overflowY: "auto" }}>
          <a href="/" style={{ color: "rgba(180,242,255,.7)", textDecoration: "none", fontSize: 10, letterSpacing: ".16em" }}>← KEMBALI KE ASTRA</a>
          <div style={{ marginTop: 28 }}><div style={{ fontSize: 9, letterSpacing: ".18em", color: "rgba(117,242,255,.65)" }}>MODEL AKTIF</div><div style={{ marginTop: 8, fontFamily: "system-ui, sans-serif", fontSize: 18 }}>{modelName}</div><div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "rgba(220,245,255,.46)" }}>V4 menghapus custom shader yang menyebabkan WebGL compile error. Motion dan state tetap aktif.</div></div>
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)" }}><div style={{ fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 10 }}>RIG DETECTION</div><div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "7px 12px", fontSize: 10, color: "rgba(220,245,255,.58)" }}><span>Bones</span><strong>{rig?.stats.bones ?? 0}</strong><span>Meshes</span><strong>{rig?.stats.meshes ?? 0}</strong><span>Skinned meshes</span><strong>{rig?.stats.skinned ?? 0}</strong><span>Head controller</span><strong>{rig?.head ? "YES" : "FALLBACK"}</strong><span>Neck controller</span><strong>{rig?.neck ? "YES" : "FALLBACK"}</strong><span>Morph targets</span><strong>{rig?.stats.morphs.length ?? 0}</strong><span>Animation clips</span><strong>{rig?.clips.length ?? 0}</strong></div></div>
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)" }}><label style={{ display: "block", fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 9 }}>TES FILE .GLB DARI PC</label><input type="file" accept=".glb,model/gltf-binary" onChange={chooseFile} style={{ width: "100%", fontSize: 11, color: "rgba(225,248,255,.72)" }} /></div>
          {error ? <div style={{ marginTop: 18, padding: 11, border: "1px solid rgba(255,95,95,.28)", borderRadius: 6, background: "rgba(255,65,65,.06)", color: "#ffb6b6", fontSize: 10 }}>{error}</div> : null}
        </aside>
      </div>
    </main>
  );
}
