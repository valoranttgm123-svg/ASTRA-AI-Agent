"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const DEMO_URL = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CesiumMan/glTF-Binary/CesiumMan.glb";
type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "success" | "error";

type LoadedRig = {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  scale: number;
  offset: THREE.Vector3;
  head: THREE.Object3D | null;
  neck: THREE.Object3D | null;
  jaw: THREE.Object3D | null;
  morphMeshes: THREE.Mesh[];
  summary: { bones: number; meshes: number; skinnedMeshes: number; morphTargets: string[] };
};

const STATES: AvatarState[] = ["idle", "listening", "thinking", "speaking", "success", "error"];

function findPart(root: THREE.Object3D, names: string[]) {
  const needles = names.map((n) => n.toLowerCase());
  let exact: THREE.Object3D | null = null;
  root.traverse((o) => { if (!exact && needles.includes(o.name.toLowerCase())) exact = o; });
  if (exact) return exact;
  let fuzzy: THREE.Object3D | null = null;
  root.traverse((o) => { if (!fuzzy && needles.some((n) => o.name.toLowerCase().includes(n))) fuzzy = o; });
  return fuzzy;
}

function inspect(scene: THREE.Group) {
  let bones = 0, meshes = 0, skinnedMeshes = 0;
  const morphTargets = new Set<string>();
  scene.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones += 1;
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes += 1;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes += 1;
    Object.keys(mesh.morphTargetDictionary ?? {}).forEach((name) => morphTargets.add(name));
  });
  return { bones, meshes, skinnedMeshes, morphTargets: [...morphTargets].sort() };
}

async function loadRig(url: string): Promise<LoadedRig> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = gltf.scene;
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
  });
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const morphMeshes: THREE.Mesh[] = [];
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) morphMeshes.push(mesh);
  });
  return {
    scene,
    clips: gltf.animations,
    scale: size.y > 0.0001 ? 4.4 / size.y : 1,
    offset: new THREE.Vector3(-center.x, -box.min.y, -center.z),
    head: findPart(scene, ["Head", "mixamorigHead", "CC_Base_Head", "J_Bip_C_Head"]),
    neck: findPart(scene, ["Neck", "mixamorigNeck", "CC_Base_Neck", "J_Bip_C_Neck"]),
    jaw: findPart(scene, ["Jaw", "mixamorigJaw", "CC_Base_JawRoot", "jawRoot"]),
    morphMeshes,
    summary: inspect(scene),
  };
}

function setMorph(mesh: THREE.Mesh, fragments: string[], value: number) {
  if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return false;
  let changed = false;
  for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (fragments.some((f) => normalized.includes(f))) {
      mesh.morphTargetInfluences[index] = value;
      changed = true;
    }
  }
  return changed;
}

function Controls() {
  const { camera, gl } = useThree();
  const ref = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 2.1, 0);
    controls.minDistance = 3.2;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI * 0.82;
    controls.update();
    ref.current = controls;
    return () => { controls.dispose(); ref.current = null; };
  }, [camera, gl]);
  useFrame(() => ref.current?.update());
  return null;
}

function Avatar({ rig, state, clipIndex }: { rig: LoadedRig; state: AvatarState; clipIndex: number }) {
  const root = useRef<THREE.Group>(null);
  const mixer = useMemo(() => new THREE.AnimationMixer(rig.scene), [rig.scene]);
  const headBase = useMemo(() => rig.head?.rotation.clone() ?? new THREE.Euler(), [rig.head]);
  const neckBase = useMemo(() => rig.neck?.rotation.clone() ?? new THREE.Euler(), [rig.neck]);
  const jawBase = useMemo(() => rig.jaw?.rotation.clone() ?? new THREE.Euler(), [rig.jaw]);

  useEffect(() => {
    mixer.stopAllAction();
    const clip = rig.clips[clipIndex];
    if (clip) mixer.clipAction(clip).reset().fadeIn(0.2).play();
    return () => { mixer.stopAllAction(); };
  }, [clipIndex, mixer, rig.clips]);

  useFrame(({ clock, pointer }, dt) => {
    mixer.update(dt);
    const t = clock.elapsedTime;
    const speaking = state === "speaking";
    const listening = state === "listening";
    const thinking = state === "thinking";
    const error = state === "error";
    const success = state === "success";
    const breath = Math.sin(t * 1.65) * 0.006;

    if (root.current) {
      root.current.position.y = breath;
      root.current.rotation.z = error ? -0.018 : 0;
      root.current.scale.setScalar(1 + breath * 0.08);
    }

    const yaw = listening ? pointer.x * 0.22 : thinking ? 0.1 + Math.sin(t * 0.72) * 0.06 : speaking ? pointer.x * 0.08 + Math.sin(t * 0.55) * 0.025 : 0;
    const pitch = listening ? -pointer.y * 0.08 - 0.025 : thinking ? -0.045 : success ? Math.sin(t * 3.2) * 0.025 : error ? 0.035 : 0;

    if (rig.head) rig.head.rotation.set(headBase.x + pitch, headBase.y + yaw, headBase.z + (error ? -0.035 : 0));
    else if (root.current) { root.current.rotation.y = yaw * 0.45; root.current.rotation.x = pitch * 0.35; }
    if (rig.neck) rig.neck.rotation.set(neckBase.x + pitch * 0.28, neckBase.y + yaw * 0.22, neckBase.z);

    const talk = speaking ? 0.18 + Math.abs(Math.sin(t * 10.5)) * 0.55 : 0;
    let morphJaw = false;
    for (const mesh of rig.morphMeshes) morphJaw = setMorph(mesh, ["jawopen", "mouthopen", "visemeaa", "visemea"], talk) || morphJaw;
    if (rig.jaw && !morphJaw) rig.jaw.rotation.set(jawBase.x + talk * 0.22, jawBase.y, jawBase.z);

    const phase = t % 4.3;
    const blink = phase > 4.12 ? Math.max(0, 1 - Math.abs(phase - 4.21) / 0.09) : 0;
    for (const mesh of rig.morphMeshes) setMorph(mesh, ["eyeblink", "blinkleft", "blinkright", "blinkl", "blinkr"], blink);
  });

  return <group ref={root}><group scale={rig.scale}><primitive object={rig.scene} position={rig.offset} /></group></group>;
}

function Scene({ rig, state, clipIndex }: { rig: LoadedRig | null; state: AvatarState; clipIndex: number }) {
  const active = state !== "idle";
  const speaking = state === "speaking";
  return <>
    <color attach="background" args={["#030a12"]} />
    <fog attach="fog" args={["#030a12", 8, 18]} />
    <ambientLight intensity={0.68} />
    <hemisphereLight args={["#a9fbff", "#07111d", 1.4]} />
    <directionalLight position={[3, 7, 5]} intensity={3.2} color="#c8fdff" castShadow />
    <pointLight position={[-3, 3, 3]} intensity={active ? 2.5 : 1.5} color="#00e5ff" />
    <pointLight position={[3, 2.4, 2.3]} intensity={speaking ? 3.4 : 1.2} color={speaking ? "#ff9f31" : "#1596b5"} />
    {rig && <Avatar rig={rig} state={state} clipIndex={clipIndex} />}
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[5, 96]} /><meshStandardMaterial color="#07131e" roughness={0.9} metalness={0.08} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
      <ringGeometry args={[2.3, 2.34, 96]} /><meshBasicMaterial color={speaking ? "#ff9f31" : "#00e5ff"} transparent opacity={0.32} />
    </mesh>
    <gridHelper args={[10, 20, "#155b72", "#0b2633"]} position={[0, 0.012, 0]} />
    <Controls />
  </>;
}

export default function HumanoidLab() {
  const [rig, setRig] = useState<LoadedRig | null>(null);
  const [sourceUrl, setSourceUrl] = useState(DEMO_URL);
  const [loadedName, setLoadedName] = useState("CesiumMan demo");
  const [state, setState] = useState<AvatarState>("idle");
  const [clipIndex, setClipIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const load = async (url: string, name = "Remote GLB") => {
    setLoading(true); setError(null);
    try { const next = await loadRig(url); setRig(next); setLoadedName(name); setClipIndex(0); }
    catch (cause) { console.error(cause); setError("Model gagal dimuat. Gunakan file .glb tunggal atau URL GLB yang mengizinkan CORS."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    void load(DEMO_URL, "CesiumMan demo");
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, []);

  const submitUrl = (e: FormEvent) => { e.preventDefault(); if (sourceUrl.trim()) void load(sourceUrl.trim()); };
  const pickLocal = (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) { setError("Gunakan file .glb agar mesh, texture dan rig berada dalam satu file."); return; }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    void load(objectUrlRef.current, file.name);
  };

  const clips = rig?.clips ?? [];
  const metric = (label: string, value: string | number, ok = true) => <><span>{label}</span><strong style={{ color: ok ? "#b9f9ff" : "#ffbf7a" }}>{value}</strong></>;

  return <main style={{ minHeight: "100vh", background: "#02070d", color: "#e9fbff", fontFamily: "var(--font-mono, monospace)" }}>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) min(380px,34vw)", minHeight: "100vh" }}>
      <section style={{ position: "relative", minHeight: 620, overflow: "hidden" }}>
        <Canvas shadows camera={{ position: [0, 2.7, 6.8], fov: 38, near: 0.1, far: 50 }} dpr={[1, 1.6]} gl={{ antialias: true, powerPreference: "high-performance" }}>
          <Scene rig={rig} state={state} clipIndex={clipIndex} />
        </Canvas>
        <div style={{ position: "absolute", left: 22, top: 20, pointerEvents: "none" }}>
          <div style={{ fontSize: 11, letterSpacing: ".28em", color: "#7cf4ff" }}>ASTRA // HUMANOID LAB</div>
          <div style={{ marginTop: 8, fontSize: 26, fontFamily: "system-ui, sans-serif", fontWeight: 300 }}>Rig & Interaction Test</div>
        </div>
        <div style={{ position: "absolute", left: 22, bottom: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {STATES.map((value) => <button key={value} type="button" onClick={() => setState(value)} style={{ border: `1px solid ${state === value ? "rgba(0,229,255,.8)" : "rgba(150,235,255,.18)"}`, background: state === value ? "rgba(0,229,255,.12)" : "rgba(2,12,21,.72)", color: state === value ? "#9af9ff" : "rgba(220,248,255,.62)", borderRadius: 6, padding: "8px 10px", fontFamily: "inherit", fontSize: 9, letterSpacing: ".13em", cursor: "pointer" }}>{value.toUpperCase()}</button>)}
        </div>
        {loading && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(2,7,13,.62)" }}><div style={{ fontSize: 11, letterSpacing: ".24em", color: "#8ff8ff" }}>LOADING RIG...</div></div>}
      </section>

      <aside style={{ borderLeft: "1px solid rgba(87,220,255,.14)", padding: 22, background: "rgba(2,10,17,.96)", overflowY: "auto" }}>
        <a href="/" style={{ color: "rgba(180,242,255,.7)", textDecoration: "none", fontSize: 10, letterSpacing: ".16em" }}>← KEMBALI KE ASTRA</a>
        <div style={{ marginTop: 28 }}><div style={{ fontSize: 9, letterSpacing: ".2em", color: "rgba(117,242,255,.65)" }}>MODEL AKTIF</div><div style={{ marginTop: 7, fontFamily: "system-ui, sans-serif", fontSize: 18 }}>{loadedName}</div><div style={{ marginTop: 5, fontSize: 9, color: "rgba(220,245,255,.42)", lineHeight: 1.6 }}>Demo CesiumMan: © 2017 Cesium, CC BY 4.0. Hanya untuk menguji pipeline rig/skin/animation.</div></div>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)" }}>
          <label style={{ display: "block", fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 8 }}>PILIH MODEL .GLB DARI PC</label>
          <input type="file" accept=".glb,model/gltf-binary" onChange={(e) => pickLocal(e.target.files?.[0])} style={{ width: "100%", fontSize: 11, color: "rgba(225,248,255,.7)" }} />
          <div style={{ marginTop: 8, fontSize: 9, lineHeight: 1.55, color: "rgba(220,245,255,.38)" }}>File dibaca lokal oleh browser. Tidak dikirim ke server atau GitHub.</div>
        </div>

        <form onSubmit={submitUrl} style={{ marginTop: 22 }}>
          <label style={{ display: "block", fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 8 }}>ATAU URL GLB</label>
          <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 6, border: "1px solid rgba(87,220,255,.17)", background: "#06111c", color: "#dffbff", fontFamily: "inherit", fontSize: 10 }} />
          <button type="submit" style={{ marginTop: 8, width: "100%", border: "1px solid rgba(0,229,255,.35)", background: "rgba(0,229,255,.08)", color: "#9af9ff", padding: 9, borderRadius: 6, fontFamily: "inherit", fontSize: 9, letterSpacing: ".14em", cursor: "pointer" }}>LOAD URL</button>
        </form>
        {error && <div style={{ marginTop: 14, padding: 10, border: "1px solid rgba(255,104,104,.26)", background: "rgba(255,60,60,.06)", color: "#ffb8b8", borderRadius: 6, fontSize: 10, lineHeight: 1.55 }}>{error}</div>}

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)" }}>
          <div style={{ fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 10 }}>RIG DETECTION</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "7px 12px", fontSize: 10, color: "rgba(220,245,255,.58)" }}>
            {metric("Bones", rig?.summary.bones ?? 0)}{metric("Meshes", rig?.summary.meshes ?? 0)}{metric("Skinned meshes", rig?.summary.skinnedMeshes ?? 0)}{metric("Head bone", rig?.head ? "YES" : "NO", Boolean(rig?.head))}{metric("Neck bone", rig?.neck ? "YES" : "NO", Boolean(rig?.neck))}{metric("Jaw bone", rig?.jaw ? "YES" : "NO", Boolean(rig?.jaw))}{metric("Morph targets", rig?.summary.morphTargets.length ?? 0)}
          </div>
        </div>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)" }}>
          <label style={{ display: "block", fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 8 }}>ANIMATION CLIP</label>
          <select value={clipIndex} onChange={(e) => setClipIndex(Number(e.target.value))} disabled={clips.length === 0} style={{ width: "100%", padding: 9, borderRadius: 6, border: "1px solid rgba(87,220,255,.17)", background: "#06111c", color: "#dffbff", fontFamily: "inherit", fontSize: 10 }}>
            {clips.length === 0 ? <option>Tidak ada animation clip</option> : clips.map((clip, index) => <option key={`${clip.name}-${index}`} value={index}>{clip.name || `Animation ${index + 1}`}</option>)}
          </select>
        </div>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)", fontSize: 10, lineHeight: 1.65, color: "rgba(220,245,255,.48)" }}><strong style={{ color: "rgba(180,248,255,.78)" }}>Cara tes:</strong> drag mouse untuk memutar kamera, scroll untuk zoom, pilih LISTENING lalu gerakkan cursor, dan pilih SPEAKING untuk tes jaw/morph target.</div>
      </aside>
    </div>
  </main>;
}
