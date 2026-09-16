"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const DEMO_URL =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CesiumMan/glTF-Binary/CesiumMan.glb";

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
  summary: {
    bones: number;
    meshes: number;
    skinnedMeshes: number;
    morphTargets: string[];
  };
};

const STATE_LABELS: Record<AvatarState, string> = {
  idle: "IDLE",
  listening: "LISTENING",
  thinking: "THINKING",
  speaking: "SPEAKING",
  success: "SUCCESS",
  error: "ERROR",
};

function findNamedObject(root: THREE.Object3D, candidates: string[]) {
  const exact = candidates.map((name) => name.toLowerCase());
  let fallback: THREE.Object3D | null = null;
  root.traverse((object) => {
    if (fallback) return;
    const name = object.name.toLowerCase();
    if (exact.includes(name)) fallback = object;
  });
  if (fallback) return fallback;

  root.traverse((object) => {
    if (fallback) return;
    const name = object.name.toLowerCase();
    if (candidates.some((candidate) => name.includes(candidate.toLowerCase()))) fallback = object;
  });
  return fallback;
}

function inspectRig(scene: THREE.Group): LoadedRig["summary"] {
  let bones = 0;
  let meshes = 0;
  let skinnedMeshes = 0;
  const morphTargets = new Set<string>();

  scene.traverse((object) => {
    if ((object as THREE.Bone).isBone) bones += 1;
    if ((object as THREE.Mesh).isMesh) {
      meshes += 1;
      if ((object as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes += 1;
      const mesh = object as THREE.Mesh;
      if (mesh.morphTargetDictionary) {
        Object.keys(mesh.morphTargetDictionary).forEach((name) => morphTargets.add(name));
      }
    }
  });

  return {
    bones,
    meshes,
    skinnedMeshes,
    morphTargets: Array.from(morphTargets).sort(),
  };
}

async function loadRig(url: string): Promise<LoadedRig> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const scene = gltf.scene;

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const targetHeight = 4.4;
  const scale = size.y > 0.0001 ? targetHeight / size.y : 1;
  const offset = new THREE.Vector3(-center.x, -box.min.y, -center.z);

  const morphMeshes: THREE.Mesh[] = [];
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) morphMeshes.push(mesh);
  });

  return {
    scene,
    clips: gltf.animations,
    scale,
    offset,
    head: findNamedObject(scene, ["Head", "mixamorigHead", "CC_Base_Head", "J_Bip_C_Head"]),
    neck: findNamedObject(scene, ["Neck", "mixamorigNeck", "CC_Base_Neck", "J_Bip_C_Neck"]),
    jaw: findNamedObject(scene, ["Jaw", "mixamorigJaw", "CC_Base_JawRoot", "jawRoot"]),
    morphMeshes,
    summary: inspectRig(scene),
  };
}

function setMorph(mesh: THREE.Mesh, fragments: string[], value: number) {
  if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return false;
  let changed = false;
  for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (fragments.some((fragment) => normalized.includes(fragment))) {
      mesh.morphTargetInfluences[index] = value;
      changed = true;
    }
  }
  return changed;
}

function LabOrbitControls() {
  const { camera, gl } = useThree();
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 2.15, 0);
    controls.minDistance = 3.2;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI * 0.82;
    controls.update();
    const id = window.setInterval(() => controls.update(), 16);
    return () => {
      window.clearInterval(id);
      controls.dispose();
    };
  }, [camera, gl]);
  return null;
}

function RiggedAvatar({
  rig,
  state,
  clipIndex,
  onClipNames,
}: {
  rig: LoadedRig;
  state: AvatarState;
  clipIndex: number;
  onClipNames: (names: string[]) => void;
}) {
  const root = useRef<THREE.Group>(null);
  const mixer = useMemo(() => new THREE.AnimationMixer(rig.scene), [rig.scene]);
  const headBase = useMemo(() => rig.head?.rotation.clone() ?? new THREE.Euler(), [rig.head]);
  const neckBase = useMemo(() => rig.neck?.rotation.clone() ?? new THREE.Euler(), [rig.neck]);
  const jawBase = useMemo(() => rig.jaw?.rotation.clone() ?? new THREE.Euler(), [rig.jaw]);

  useEffect(() => {
    onClipNames(rig.clips.map((clip, index) => clip.name || `Animation ${index + 1}`));
  }, [onClipNames, rig.clips]);

  useEffect(() => {
    mixer.stopAllAction();
    const clip = rig.clips[clipIndex];
    if (clip) mixer.clipAction(clip).reset().fadeIn(0.2).play();
    return () => mixer.stopAllAction();
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

    const yaw = listening
      ? pointer.x * 0.22
      : thinking
        ? 0.10 + Math.sin(t * 0.72) * 0.06
        : speaking
          ? pointer.x * 0.08 + Math.sin(t * 0.55) * 0.025
          : 0;
    const pitch = listening
      ? -pointer.y * 0.08 - 0.025
      : thinking
        ? -0.045
        : success
          ? Math.sin(t * 3.2) * 0.025
          : error
            ? 0.035
            : 0;

    if (rig.head) {
      rig.head.rotation.set(headBase.x + pitch, headBase.y + yaw, headBase.z + (error ? -0.035 : 0));
    } else if (root.current) {
      root.current.rotation.y = yaw * 0.45;
      root.current.rotation.x = pitch * 0.35;
    }

    if (rig.neck) {
      rig.neck.rotation.set(neckBase.x + pitch * 0.28, neckBase.y + yaw * 0.22, neckBase.z);
    }

    const talk = speaking ? 0.18 + Math.abs(Math.sin(t * 10.5)) * 0.55 : 0;
    let morphJaw = false;
    for (const mesh of rig.morphMeshes) {
      morphJaw = setMorph(mesh, ["jawopen", "mouthopen", "visemeaa", "visemea"], talk) || morphJaw;
    }
    if (rig.jaw && !morphJaw) {
      rig.jaw.rotation.set(jawBase.x + talk * 0.22, jawBase.y, jawBase.z);
    }

    const blinkPhase = t % 4.3;
    const blink = blinkPhase > 4.12 ? 1 - Math.min(1, Math.abs(blinkPhase - 4.21) / 0.09) : 0;
    for (const mesh of rig.morphMeshes) {
      setMorph(mesh, ["eyeblink", "blinkleft", "blinkright", "blinkl", "blinkr"], Math.max(0, blink));
    }
  });

  return (
    <group ref={root}>
      <group scale={rig.scale} position={[0, 0, 0]}>
        <primitive object={rig.scene} position={rig.offset} />
      </group>
    </group>
  );
}

function LabScene({
  rig,
  state,
  clipIndex,
  onClipNames,
}: {
  rig: LoadedRig | null;
  state: AvatarState;
  clipIndex: number;
  onClipNames: (names: string[]) => void;
}) {
  const active = state !== "idle";
  const speaking = state === "speaking";

  return (
    <>
      <color attach="background" args={["#030a12"]} />
      <fog attach="fog" args={["#030a12", 8, 18]} />
      <ambientLight intensity={0.68} />
      <hemisphereLight args={["#a9fbff", "#07111d", 1.4]} />
      <directionalLight position={[3, 7, 5]} intensity={3.2} color="#c8fdff" castShadow />
      <pointLight position={[-3, 3, 3]} intensity={active ? 2.5 : 1.5} color="#00e5ff" />
      <pointLight position={[3, 2.4, 2.3]} intensity={speaking ? 3.4 : 1.2} color={speaking ? "#ff9f31" : "#1596b5"} />

      {rig ? <RiggedAvatar rig={rig} state={state} clipIndex={clipIndex} onClipNames={onClipNames} /> : null}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[5, 96]} />
        <meshStandardMaterial color="#07131e" roughness={0.9} metalness={0.08} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <ringGeometry args={[2.3, 2.34, 96]} />
        <meshBasicMaterial color={speaking ? "#ff9f31" : "#00e5ff"} transparent opacity={0.32} />
      </mesh>
      <gridHelper args={[10, 20, "#155b72", "#0b2633"]} position={[0, 0.012, 0]} />
      <LabOrbitControls />
    </>
  );
}

export default function HumanoidLab() {
  const [rig, setRig] = useState<LoadedRig | null>(null);
  const [sourceUrl, setSourceUrl] = useState(DEMO_URL);
  const [loadedName, setLoadedName] = useState("CesiumMan demo");
  const [state, setState] = useState<AvatarState>("idle");
  const [clipNames, setClipNames] = useState<string[]>([]);
  const [clipIndex, setClipIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const loadFromUrl = async (url: string, name = "Remote GLB") => {
    setLoading(true);
    setError(null);
    try {
      const nextRig = await loadRig(url);
      setRig(nextRig);
      setLoadedName(name);
      setClipIndex(0);
      setClipNames(nextRig.clips.map((clip, index) => clip.name || `Animation ${index + 1}`));
    } catch (cause) {
      console.error(cause);
      setError("Model gagal dimuat. Gunakan file .glb tunggal atau URL GLB yang mengizinkan CORS.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFromUrl(DEMO_URL, "CesiumMan demo");
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const submitUrl = (event: FormEvent) => {
    event.preventDefault();
    if (sourceUrl.trim()) void loadFromUrl(sourceUrl.trim());
  };

  const pickLocal = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setError("Untuk lab ini gunakan file .glb agar texture dan rig berada dalam satu file.");
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    void loadFromUrl(objectUrlRef.current, file.name);
  };

  return (
    <main style={{ minHeight: "100vh", background: "#02070d", color: "#e9fbff", fontFamily: "var(--font-mono, monospace)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) min(380px,34vw)", minHeight: "100vh" }}>
        <section style={{ position: "relative", minHeight: 620, overflow: "hidden" }}>
          <Canvas
            shadows
            camera={{ position: [0, 2.7, 6.8], fov: 38, near: 0.1, far: 50 }}
            dpr={[1, 1.6]}
            gl={{ antialias: true, powerPreference: "high-performance" }}
          >
            <LabScene rig={rig} state={state} clipIndex={clipIndex} onClipNames={setClipNames} />
          </Canvas>

          <div style={{ position: "absolute", left: 22, top: 20, pointerEvents: "none" }}>
            <div style={{ fontSize: 11, letterSpacing: ".28em", color: "#7cf4ff" }}>ASTRA // HUMANOID LAB</div>
            <div style={{ marginTop: 8, fontSize: 26, letterSpacing: ".03em", fontFamily: "system-ui, sans-serif", fontWeight: 300 }}>
              Rig & Interaction Test
            </div>
          </div>

          <div style={{ position: "absolute", left: 22, bottom: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(Object.keys(STATE_LABELS) as AvatarState[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setState(value)}
                style={{
                  border: `1px solid ${state === value ? "rgba(0,229,255,.8)" : "rgba(150,235,255,.18)"}`,
                  background: state === value ? "rgba(0,229,255,.12)" : "rgba(2,12,21,.72)",
                  color: state === value ? "#9af9ff" : "rgba(220,248,255,.62)",
                  borderRadius: 6,
                  padding: "8px 10px",
                  fontFamily: "inherit",
                  fontSize: 9,
                  letterSpacing: ".13em",
                  cursor: "pointer",
                }}
              >
                {STATE_LABELS[value]}
              </button>
            ))}
          </div>

          {loading && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(2,7,13,.62)", backdropFilter: "blur(2px)" }}>
              <div style={{ fontSize: 11, letterSpacing: ".24em", color: "#8ff8ff" }}>LOADING RIG...</div>
            </div>
          )}
        </section>

        <aside style={{ borderLeft: "1px solid rgba(87,220,255,.14)", padding: 22, background: "rgba(2,10,17,.96)", overflowY: "auto" }}>
          <a href="/" style={{ color: "rgba(180,242,255,.7)", textDecoration: "none", fontSize: 10, letterSpacing: ".16em" }}>← KEMBALI KE ASTRA</a>

          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 9, letterSpacing: ".2em", color: "rgba(117,242,255,.65)" }}>MODEL AKTIF</div>
            <div style={{ marginTop: 7, fontFamily: "system-ui, sans-serif", fontSize: 18 }}>{loadedName}</div>
            <div style={{ marginTop: 5, fontSize: 9, color: "rgba(220,245,255,.42)", lineHeight: 1.6 }}>
              Demo CesiumMan: © 2017 Cesium, CC BY 4.0. Hanya untuk menguji pipeline rig/skin/animation.
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)" }}>
            <label style={{ display: "block", fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 8 }}>PILIH MODEL .GLB DARI PC</label>
            <input
              type="file"
              accept=".glb,model/gltf-binary"
              onChange={(event) => pickLocal(event.target.files?.[0])}
              style={{ width: "100%", fontSize: 11, color: "rgba(225,248,255,.7)" }}
            />
            <div style={{ marginTop: 8, fontSize: 9, lineHeight: 1.55, color: "rgba(220,245,255,.38)" }}>
              File dibaca lokal oleh browser. Tidak dikirim ke server atau GitHub.
            </div>
          </div>

          <form onSubmit={submitUrl} style={{ marginTop: 22 }}>
            <label style={{ display: "block", fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 8 }}>ATAU URL GLB</label>
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 6, border: "1px solid rgba(87,220,255,.17)", background: "#06111c", color: "#dffbff", fontFamily: "inherit", fontSize: 10 }}
            />
            <button type="submit" style={{ marginTop: 8, width: "100%", border: "1px solid rgba(0,229,255,.35)", background: "rgba(0,229,255,.08)", color: "#9af9ff", padding: 9, borderRadius: 6, fontFamily: "inherit", fontSize: 9, letterSpacing: ".14em", cursor: "pointer" }}>
              LOAD URL
            </button>
          </form>

          {error && <div style={{ marginTop: 14, padding: 10, border: "1px solid rgba(255,104,104,.26)", background: "rgba(255,60,60,.06)", color: "#ffb8b8", borderRadius: 6, fontSize: 10, lineHeight: 1.55 }}>{error}</div>}

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)" }}>
            <div style={{ fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 10 }}>RIG DETECTION</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "7px 12px", fontSize: 10, color: "rgba(220,245,255,.58)" }}>
              <span>Bones</span><strong style={{ color: "#b9f9ff" }}>{rig?.summary.bones ?? 0}</strong>
              <span>Meshes</span><strong style={{ color: "#b9f9ff" }}>{rig?.summary.meshes ?? 0}</strong>
              <span>Skinned meshes</span><strong style={{ color: "#b9f9ff" }}>{rig?.summary.skinnedMeshes ?? 0}</strong>
              <span>Head bone</span><strong style={{ color: rig?.head ? "#8dffce" : "#ffbf7a" }}>{rig?.head ? "YES" : "NO"}</strong>
              <span>Neck bone</span><strong style={{ color: rig?.neck ? "#8dffce" : "#ffbf7a" }}>{rig?.neck ? "YES" : "NO"}</strong>
              <span>Jaw bone</span><strong style={{ color: rig?.jaw ? "#8dffce" : "#ffbf7a" }}>{rig?.jaw ? "YES" : "NO"}</strong>
              <span>Morph targets</span><strong style={{ color: "#b9f9ff" }}>{rig?.summary.morphTargets.length ?? 0}</strong>
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)" }}>
            <label style={{ display: "block", fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 8 }}>ANIMATION CLIP</label>
            <select
              value={clipIndex}
              onChange={(event) => setClipIndex(Number(event.target.value))}
              disabled={clipNames.length === 0}
              style={{ width: "100%", padding: 9, borderRadius: 6, border: "1px solid rgba(87,220,255,.17)", background: "#06111c", color: "#dffbff", fontFamily: "inherit", fontSize: 10 }}
            >
              {clipNames.length === 0 ? <option>Tidak ada animation clip</option> : clipNames.map((name, index) => <option key={`${name}-${index}`} value={index}>{name}</option>)}
            </select>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)", fontSize: 10, lineHeight: 1.65, color: "rgba(220,245,255,.48)" }}>
            <strong style={{ color: "rgba(180,248,255,.78)" }}>Cara tes:</strong> drag mouse untuk memutar kamera, scroll untuk zoom, pilih LISTENING lalu gerakkan cursor, dan pilih SPEAKING untuk tes jaw/morph target. Model final ASTRA nanti dipasang di lab ini terlebih dahulu sebelum masuk halaman utama.
          </div>
        </aside>
      </div>
    </main>
  );
}
