"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const DEMO_URL =
  "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/RobotExpressive/RobotExpressive.glb";

type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "success" | "error";

type LoadedRig = {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  scale: number;
  offset: THREE.Vector3;
  head: THREE.Object3D | null;
  neck: THREE.Object3D | null;
  chest: THREE.Object3D | null;
  jaw: THREE.Object3D | null;
  leftEye: THREE.Object3D | null;
  rightEye: THREE.Object3D | null;
  morphMeshes: THREE.Mesh[];
  holoMaterials: THREE.MeshStandardMaterial[];
  summary: {
    bones: number;
    meshes: number;
    skinnedMeshes: number;
    morphTargets: string[];
  };
};

const STATES: AvatarState[] = ["idle", "listening", "thinking", "speaking", "success", "error"];

const STATE_CLIP: Record<AvatarState, string[]> = {
  idle: ["Idle", "Standing"],
  listening: ["Standing", "Idle"],
  thinking: ["Standing", "Idle"],
  speaking: ["Idle", "Standing"],
  success: ["ThumbsUp", "Yes", "Idle"],
  error: ["No", "Idle"],
};

function findPart(root: THREE.Object3D, names: string[]) {
  const needles = names.map((name) => name.toLowerCase());
  let found: THREE.Object3D | null = null;

  root.traverse((object) => {
    if (found) return;
    if (needles.includes(object.name.toLowerCase())) found = object;
  });

  if (found) return found;

  root.traverse((object) => {
    if (found) return;
    const name = object.name.toLowerCase();
    if (needles.some((needle) => name.includes(needle))) found = object;
  });

  return found;
}

function inspect(scene: THREE.Group) {
  let bones = 0;
  let meshes = 0;
  let skinnedMeshes = 0;
  const morphTargets = new Set<string>();

  scene.traverse((object) => {
    if ((object as THREE.Bone).isBone) bones += 1;
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes += 1;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes += 1;
    Object.keys(mesh.morphTargetDictionary ?? {}).forEach((name) => morphTargets.add(name));
  });

  return { bones, meshes, skinnedMeshes, morphTargets: [...morphTargets].sort() };
}

function createHologramMaterial(materials: THREE.MeshStandardMaterial[]) {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#03131d"),
    emissive: new THREE.Color("#008ea8"),
    emissiveIntensity: 0.7,
    roughness: 0.42,
    metalness: 0.08,
    transparent: true,
    opacity: 0.76,
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    material.userData.holoShader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec3 vAstraWorldPosition;\nvarying vec3 vAstraWorldNormal;`,
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>\nvAstraWorldPosition = worldPosition.xyz;\nvAstraWorldNormal = normalize(mat3(modelMatrix) * transformedNormal);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nuniform float uTime;\nvarying vec3 vAstraWorldPosition;\nvarying vec3 vAstraWorldNormal;`,
      )
      .replace(
        "#include <output_fragment>",
        `float scanSignal = 0.5 + 0.5 * sin(vAstraWorldPosition.y * 72.0 - uTime * 3.2);\nfloat scanBand = smoothstep(0.70, 0.97, scanSignal);\nvec3 astraView = normalize(cameraPosition - vAstraWorldPosition);\nfloat astraFresnel = pow(1.0 - max(0.0, dot(normalize(vAstraWorldNormal), astraView)), 2.0);\nvec3 cyanGlow = vec3(0.0, 0.82, 1.0) * (scanBand * 0.95 + astraFresnel * 1.35);\noutgoingLight += cyanGlow;\ndiffuseColor.a = clamp(0.24 + scanBand * 0.36 + astraFresnel * 0.48, 0.18, 0.94);\n#include <output_fragment>`,
      );
  };

  material.customProgramCacheKey = () => "astra-hologram-v2";
  materials.push(material);
  return material;
}

async function loadRig(url: string): Promise<LoadedRig> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = gltf.scene;
  const holoMaterials: THREE.MeshStandardMaterial[] = [];
  const morphMeshes: THREE.Mesh[] = [];

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.castShadow = false;
    mesh.receiveShadow = false;

    const count = Array.isArray(mesh.material) ? mesh.material.length : 1;
    const replacements = Array.from({ length: count }, () => createHologramMaterial(holoMaterials));
    mesh.material = Array.isArray(mesh.material) ? replacements : replacements[0];

    if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) morphMeshes.push(mesh);
  });

  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  return {
    scene,
    clips: gltf.animations,
    scale: size.y > 0.0001 ? 4.5 / size.y : 1,
    offset: new THREE.Vector3(-center.x, -box.min.y, -center.z),
    head: findPart(scene, ["Head", "mixamorigHead", "CC_Base_Head", "J_Bip_C_Head", "Head_4"]),
    neck: findPart(scene, ["Neck", "mixamorigNeck", "CC_Base_Neck", "J_Bip_C_Neck"]),
    chest: findPart(scene, ["Spine2", "Spine1", "Chest", "UpperChest", "mixamorigSpine2"]),
    jaw: findPart(scene, ["Jaw", "mixamorigJaw", "CC_Base_JawRoot", "jawRoot"]),
    leftEye: findPart(scene, ["LeftEye", "Eye_L", "mixamorigLeftEye"]),
    rightEye: findPart(scene, ["RightEye", "Eye_R", "mixamorigRightEye"]),
    morphMeshes,
    holoMaterials,
    summary: inspect(scene),
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

function findClip(clips: THREE.AnimationClip[], names: string[]) {
  for (const name of names) {
    const clip = clips.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
    if (clip) return clip;
  }
  return clips[0] ?? null;
}

function Controls() {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.set(0, 3.05, 0);
    controls.minDistance = 3.6;
    controls.maxDistance = 7.2;
    controls.minPolarAngle = Math.PI * 0.28;
    controls.maxPolarAngle = Math.PI * 0.66;
    controls.minAzimuthAngle = -Math.PI * 0.42;
    controls.maxAzimuthAngle = Math.PI * 0.42;
    controls.update();
    controlsRef.current = controls;

    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl]);

  useFrame(() => controlsRef.current?.update());
  return null;
}

function ParticleHalo({ active }: { active: boolean }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 680;
    const data = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      const a = i * 2.399963;
      const r = 0.72 + ((i * 37) % 100) / 190;
      const y = ((i * 53) % 100) / 100;
      data[i * 3] = Math.cos(a) * r * (0.55 + y * 0.5);
      data[i * 3 + 1] = y * 1.5 - 0.32;
      data[i * 3 + 2] = Math.sin(a) * r * 0.58 - 0.14;
    }

    return data;
  }, []);

  useFrame(({ clock }) => {
    if (!points.current) return;
    points.current.rotation.y = clock.elapsedTime * 0.035;
    points.current.rotation.z = Math.sin(clock.elapsedTime * 0.22) * 0.025;
  });

  return (
    <points ref={points} position={[0, 3.55, -0.28]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#19dfff"
        size={active ? 0.032 : 0.024}
        transparent
        opacity={active ? 0.78 : 0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Avatar({
  rig,
  state,
  manualClip,
}: {
  rig: LoadedRig;
  state: AvatarState;
  manualClip: number;
}) {
  const root = useRef<THREE.Group>(null);
  const mixer = useMemo(() => new THREE.AnimationMixer(rig.scene), [rig.scene]);
  const activeAction = useRef<THREE.AnimationAction | null>(null);
  const headBase = useMemo(() => rig.head?.rotation.clone() ?? new THREE.Euler(), [rig.head]);
  const neckBase = useMemo(() => rig.neck?.rotation.clone() ?? new THREE.Euler(), [rig.neck]);
  const chestBase = useMemo(() => rig.chest?.rotation.clone() ?? new THREE.Euler(), [rig.chest]);
  const jawBase = useMemo(() => rig.jaw?.rotation.clone() ?? new THREE.Euler(), [rig.jaw]);
  const pose = useRef({ yaw: 0, pitch: 0, roll: 0, mouth: 0 });
  const nextBlink = useRef(2.8);
  const blinkStarted = useRef(-1);

  useEffect(() => {
    const clip = manualClip >= 0 ? rig.clips[manualClip] ?? null : findClip(rig.clips, STATE_CLIP[state]);
    if (!clip) return;

    const next = mixer.clipAction(clip);
    const previous = activeAction.current;

    if (previous !== next) {
      previous?.fadeOut(0.38);
      next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.38);
      if (state === "success" || state === "error") {
        next.setLoop(THREE.LoopOnce, 1);
        next.clampWhenFinished = true;
      } else {
        next.setLoop(THREE.LoopRepeat, Infinity);
        next.clampWhenFinished = false;
      }
      next.play();
      activeAction.current = next;
    }

    return () => undefined;
  }, [manualClip, mixer, rig.clips, state]);

  useEffect(() => () => mixer.stopAllAction(), [mixer]);

  useFrame(({ clock, pointer }, dt) => {
    mixer.update(dt);
    const t = clock.elapsedTime;
    const listening = state === "listening";
    const thinking = state === "thinking";
    const speaking = state === "speaking";
    const success = state === "success";
    const error = state === "error";

    for (const material of rig.holoMaterials) {
      const shader = material.userData.holoShader as
        | { uniforms?: { uTime?: { value: number } } }
        | undefined;
      if (shader?.uniforms?.uTime) shader.uniforms.uTime.value = t;
      material.emissiveIntensity = speaking ? 1.05 : thinking ? 0.9 : 0.72;
    }

    let targetYaw = 0;
    let targetPitch = 0;
    let targetRoll = 0;

    if (listening) {
      targetYaw = pointer.x * 0.2;
      targetPitch = -pointer.y * 0.085 - 0.018;
    } else if (thinking) {
      targetYaw = 0.085 + Math.sin(t * 0.46) * 0.045;
      targetPitch = -0.045 + Math.sin(t * 0.31) * 0.016;
    } else if (speaking) {
      targetYaw = pointer.x * 0.045 + Math.sin(t * 0.38) * 0.02;
      targetPitch = Math.sin(t * 1.15) * 0.016;
    } else if (success) {
      targetPitch = -0.018;
      targetYaw = Math.sin(t * 0.8) * 0.018;
    } else if (error) {
      targetPitch = 0.03;
      targetRoll = -0.025;
    }

    const smoothing = 1 - Math.exp(-dt * 6.5);
    pose.current.yaw = THREE.MathUtils.lerp(pose.current.yaw, targetYaw, smoothing);
    pose.current.pitch = THREE.MathUtils.lerp(pose.current.pitch, targetPitch, smoothing);
    pose.current.roll = THREE.MathUtils.lerp(pose.current.roll, targetRoll, smoothing);

    if (rig.head) {
      rig.head.rotation.set(
        headBase.x + pose.current.pitch,
        headBase.y + pose.current.yaw,
        headBase.z + pose.current.roll,
      );
    }

    if (rig.neck) {
      rig.neck.rotation.set(
        neckBase.x + pose.current.pitch * 0.28,
        neckBase.y + pose.current.yaw * 0.22,
        neckBase.z + pose.current.roll * 0.2,
      );
    }

    const breath = Math.sin(t * 1.55) * 0.006;
    if (rig.chest) {
      rig.chest.rotation.set(
        chestBase.x + breath * 0.7,
        chestBase.y,
        chestBase.z + Math.sin(t * 0.55) * 0.003,
      );
    }

    if (root.current) root.current.position.y = breath * 0.35;

    const rawTalk = speaking
      ? 0.12 + Math.abs(Math.sin(t * 7.7) * 0.4 + Math.sin(t * 11.9) * 0.2)
      : 0;
    pose.current.mouth = THREE.MathUtils.lerp(pose.current.mouth, rawTalk, 1 - Math.exp(-dt * 12));

    let hasMouth = false;
    for (const mesh of rig.morphMeshes) {
      hasMouth =
        setMorph(mesh, ["jawopen", "mouthopen", "visemeaa", "visemea"], pose.current.mouth) || hasMouth;
      setMorph(mesh, ["sad"], error ? 0.38 : 0);
      setMorph(mesh, ["angry"], thinking ? 0.08 : 0);
      setMorph(mesh, ["surprised"], speaking && !hasMouth ? pose.current.mouth * 0.18 : 0);
    }

    if (rig.jaw && !hasMouth) {
      rig.jaw.rotation.set(jawBase.x + pose.current.mouth * 0.2, jawBase.y, jawBase.z);
    }

    if (t >= nextBlink.current && blinkStarted.current < 0) {
      blinkStarted.current = t;
      nextBlink.current = t + 3.2 + ((Math.sin(t * 4.91) + 1) * 0.5) * 2.4;
    }

    let blink = 0;
    if (blinkStarted.current >= 0) {
      const elapsed = t - blinkStarted.current;
      if (elapsed < 0.16) blink = Math.sin((elapsed / 0.16) * Math.PI);
      else blinkStarted.current = -1;
    }

    for (const mesh of rig.morphMeshes) {
      setMorph(mesh, ["eyeblink", "blinkleft", "blinkright", "blinkl", "blinkr"], blink);
    }
  });

  return (
    <group ref={root}>
      <group scale={rig.scale}>
        <primitive object={rig.scene} position={rig.offset} />
      </group>
    </group>
  );
}

function Scene({
  rig,
  state,
  manualClip,
}: {
  rig: LoadedRig | null;
  state: AvatarState;
  manualClip: number;
}) {
  const active = state !== "idle";
  const speaking = state === "speaking";

  return (
    <>
      <color attach="background" args={["#02070d"]} />
      <fog attach="fog" args={["#02070d", 7.5, 15]} />
      <ambientLight intensity={0.32} />
      <hemisphereLight args={["#7befff", "#02060b", 0.8]} />
      <directionalLight position={[2.8, 6.5, 4.5]} intensity={1.2} color="#a6f8ff" />
      <pointLight position={[-2.1, 3.4, 2.6]} intensity={active ? 2.1 : 1.35} color="#00d9ff" />
      <pointLight position={[0, 3.55, 1.15]} intensity={speaking ? 4.2 : 2.5} color="#ff9f31" />

      <group position={[0, 0, -0.55]}>
        <mesh position={[0, 3.35, 0]}>
          <ringGeometry args={[1.25, 1.265, 128]} />
          <meshBasicMaterial color="#0bdfff" transparent opacity={active ? 0.36 : 0.22} />
        </mesh>
        <mesh position={[0, 3.35, -0.03]} scale={1.28}>
          <ringGeometry args={[1.25, 1.257, 128]} />
          <meshBasicMaterial color="#0bdfff" transparent opacity={0.11} />
        </mesh>
      </group>

      <mesh position={[0, 3.48, -0.42]}>
        <sphereGeometry args={[0.13, 32, 32]} />
        <meshBasicMaterial color="#ff9f31" transparent opacity={speaking ? 0.92 : 0.58} />
      </mesh>

      <mesh position={[0, 2.55, -0.3]}>
        <sphereGeometry args={[0.09, 24, 24]} />
        <meshBasicMaterial color="#ff9f31" transparent opacity={active ? 0.6 : 0.32} />
      </mesh>

      <ParticleHalo active={active} />
      {rig ? <Avatar rig={rig} state={state} manualClip={manualClip} /> : null}
      <Controls />
    </>
  );
}

export default function HumanoidLab() {
  const [rig, setRig] = useState<LoadedRig | null>(null);
  const [sourceUrl, setSourceUrl] = useState(DEMO_URL);
  const [loadedName, setLoadedName] = useState("RobotExpressive hologram demo");
  const [state, setState] = useState<AvatarState>("idle");
  const [manualClip, setManualClip] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const load = async (url: string, name = "Remote GLB") => {
    setLoading(true);
    setError(null);
    try {
      const next = await loadRig(url);
      setRig(next);
      setLoadedName(name);
      setManualClip(-1);
    } catch (cause) {
      console.error(cause);
      setError("Model gagal dimuat. Gunakan file .glb tunggal atau URL GLB yang mengizinkan CORS.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(DEMO_URL, "RobotExpressive hologram demo");
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const submitUrl = (event: FormEvent) => {
    event.preventDefault();
    if (sourceUrl.trim()) void load(sourceUrl.trim());
  };

  const pickLocal = (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setError("Gunakan file .glb agar mesh, texture dan rig berada dalam satu file.");
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    void load(objectUrlRef.current, file.name);
  };

  const clips = rig?.clips ?? [];
  const metric = (label: string, value: string | number, ok = true) => (
    <>
      <span>{label}</span>
      <strong style={{ color: ok ? "#b9f9ff" : "#ffbf7a" }}>{value}</strong>
    </>
  );

  return (
    <main
      style={{
        height: "100vh",
        background: "#02070d",
        color: "#e9fbff",
        fontFamily: "var(--font-mono, monospace)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) min(390px,34vw)",
          height: "100vh",
        }}
      >
        <section style={{ position: "relative", height: "100vh", overflow: "hidden" }}>
          <Canvas
            style={{ width: "100%", height: "100%", display: "block" }}
            camera={{ position: [0, 3.08, 4.9], fov: 32, near: 0.1, far: 30 }}
            dpr={[1, 1.55]}
            gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
          >
            <Scene rig={rig} state={state} manualClip={manualClip} />
          </Canvas>

          <div style={{ position: "absolute", left: 22, top: 20, pointerEvents: "none" }}>
            <div style={{ fontSize: 11, letterSpacing: ".28em", color: "#7cf4ff" }}>
              ASTRA // HUMANOID LAB V2
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 26,
                fontFamily: "system-ui, sans-serif",
                fontWeight: 300,
              }}
            >
              Hologram Interaction Rig
            </div>
            <div style={{ marginTop: 7, fontSize: 9, letterSpacing: ".16em", color: "rgba(255,177,87,.7)" }}>
              {state.toUpperCase()} // CONTOUR + PARTICLE + ORANGE CORE
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              left: 22,
              bottom: 20,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {STATES.map((value) => (
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
                {value.toUpperCase()}
              </button>
            ))}
          </div>

          {loading ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                background: "rgba(2,7,13,.66)",
              }}
            >
              <div style={{ fontSize: 11, letterSpacing: ".24em", color: "#8ff8ff" }}>LOADING RIG...</div>
            </div>
          ) : null}
        </section>

        <aside
          style={{
            borderLeft: "1px solid rgba(87,220,255,.14)",
            padding: 22,
            background: "rgba(2,10,17,.97)",
            overflowY: "auto",
          }}
        >
          <a
            href="/"
            style={{ color: "rgba(180,242,255,.7)", textDecoration: "none", fontSize: 10, letterSpacing: ".16em" }}
          >
            ← KEMBALI KE ASTRA
          </a>

          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 9, letterSpacing: ".2em", color: "rgba(117,242,255,.65)" }}>MODEL AKTIF</div>
            <div style={{ marginTop: 7, fontFamily: "system-ui, sans-serif", fontSize: 18 }}>{loadedName}</div>
            <div style={{ marginTop: 5, fontSize: 9, color: "rgba(220,245,255,.42)", lineHeight: 1.6 }}>
              Default memakai RobotExpressive hanya sebagai rig gerak. Material asli diganti ASTRA hologram shader.
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)" }}>
            <label style={{ display: "block", fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 8 }}>
              PILIH MODEL .GLB DARI PC
            </label>
            <input
              type="file"
              accept=".glb,model/gltf-binary"
              onChange={(event) => pickLocal(event.target.files?.[0])}
              style={{ width: "100%", fontSize: 11, color: "rgba(225,248,255,.7)" }}
            />
            <div style={{ marginTop: 8, fontSize: 9, lineHeight: 1.55, color: "rgba(220,245,255,.38)" }}>
              File dibaca lokal oleh browser dan langsung diberi hologram shader. Tidak dikirim ke server/GitHub.
            </div>
          </div>

          <form onSubmit={submitUrl} style={{ marginTop: 22 }}>
            <label style={{ display: "block", fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 8 }}>
              ATAU URL GLB
            </label>
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "9px 10px",
                borderRadius: 6,
                border: "1px solid rgba(87,220,255,.17)",
                background: "#06111c",
                color: "#dffbff",
                fontFamily: "inherit",
                fontSize: 10,
              }}
            />
            <button
              type="submit"
              style={{
                marginTop: 8,
                width: "100%",
                border: "1px solid rgba(0,229,255,.35)",
                background: "rgba(0,229,255,.08)",
                color: "#9af9ff",
                padding: 9,
                borderRadius: 6,
                fontFamily: "inherit",
                fontSize: 9,
                letterSpacing: ".14em",
                cursor: "pointer",
              }}
            >
              LOAD URL
            </button>
          </form>

          {error ? (
            <div
              style={{
                marginTop: 14,
                padding: 10,
                border: "1px solid rgba(255,104,104,.26)",
                background: "rgba(255,60,60,.06)",
                color: "#ffb8b8",
                borderRadius: 6,
                fontSize: 10,
                lineHeight: 1.55,
              }}
            >
              {error}
            </div>
          ) : null}

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)" }}>
            <div style={{ fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 10 }}>
              RIG DETECTION
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "7px 12px",
                fontSize: 10,
                color: "rgba(220,245,255,.58)",
              }}
            >
              {metric("Bones", rig?.summary.bones ?? 0)}
              {metric("Meshes", rig?.summary.meshes ?? 0)}
              {metric("Skinned meshes", rig?.summary.skinnedMeshes ?? 0)}
              {metric("Head controller", rig?.head ? "YES" : "FALLBACK", true)}
              {metric("Neck controller", rig?.neck ? "YES" : "FALLBACK", true)}
              {metric("Jaw controller", rig?.jaw ? "YES" : "MORPH", true)}
              {metric("Morph targets", rig?.summary.morphTargets.length ?? 0)}
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)" }}>
            <label style={{ display: "block", fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 8 }}>
              MOTION SOURCE
            </label>
            <select
              value={manualClip}
              onChange={(event) => setManualClip(Number(event.target.value))}
              style={{
                width: "100%",
                padding: 9,
                borderRadius: 6,
                border: "1px solid rgba(87,220,255,.17)",
                background: "#06111c",
                color: "#dffbff",
                fontFamily: "inherit",
                fontSize: 10,
              }}
            >
              <option value={-1}>AUTO — mengikuti state ASTRA</option>
              {clips.map((clip, index) => (
                <option key={`${clip.name}-${index}`} value={index}>
                  {clip.name || `Animation ${index + 1}`}
                </option>
              ))}
            </select>
          </div>

          {rig?.summary.morphTargets.length ? (
            <div style={{ marginTop: 20, fontSize: 9, lineHeight: 1.55, color: "rgba(220,245,255,.4)" }}>
              Facial morph: {rig.summary.morphTargets.slice(0, 8).join(", ")}
              {rig.summary.morphTargets.length > 8 ? " …" : ""}
            </div>
          ) : null}

          <div
            style={{
              marginTop: 24,
              paddingTop: 20,
              borderTop: "1px solid rgba(87,220,255,.12)",
              fontSize: 10,
              lineHeight: 1.65,
              color: "rgba(220,245,255,.48)",
            }}
          >
            <strong style={{ color: "rgba(180,248,255,.78)" }}>Tes interaksi:</strong> LISTENING mengikuti cursor,
            THINKING membuat micro-pose, SPEAKING mengaktifkan mouth/viseme bila tersedia, SUCCESS/ERROR memakai emote rig.
          </div>
        </aside>
      </div>
    </main>
  );
}
