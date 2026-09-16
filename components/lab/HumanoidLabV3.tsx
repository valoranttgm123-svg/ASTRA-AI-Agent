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
  stats: {
    bones: number;
    meshes: number;
    skinned: number;
    morphs: string[];
  };
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
    if (needles.includes(object.name.toLowerCase())) result = object;
  });

  if (result) return result;

  root.traverse((object) => {
    if (result) return;
    const name = object.name.toLowerCase();
    if (needles.some((needle) => name.includes(needle))) result = object;
  });

  return result;
}

function inspect(scene: THREE.Group) {
  let bones = 0;
  let meshes = 0;
  let skinned = 0;
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

function makeHologramMaterial(materials: THREE.MeshStandardMaterial[]) {
  const material = new THREE.MeshStandardMaterial({
    color: "#04151f",
    emissive: "#00b8d4",
    emissiveIntensity: 0.95,
    roughness: 0.35,
    metalness: 0.08,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uAstraTime = { value: 0 };
    material.userData.astraShader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vAstraWorldPosition;\nvarying vec3 vAstraWorldNormal;",
      )
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvAstraWorldPosition = worldPosition.xyz;\nvAstraWorldNormal = normalize(mat3(modelMatrix) * transformedNormal);",
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uAstraTime;\nvarying vec3 vAstraWorldPosition;\nvarying vec3 vAstraWorldNormal;",
      )
      .replace(
        "#include <output_fragment>",
        [
          "float scan = 0.5 + 0.5 * sin(vAstraWorldPosition.y * 82.0 - uAstraTime * 4.0);",
          "float band = smoothstep(0.72, 0.98, scan);",
          "vec3 viewDir = normalize(cameraPosition - vAstraWorldPosition);",
          "float fresnel = pow(1.0 - max(0.0, dot(normalize(vAstraWorldNormal), viewDir)), 2.2);",
          "outgoingLight += vec3(0.0, 0.78, 1.0) * (band * 1.0 + fresnel * 1.5);",
          "diffuseColor.a = clamp(0.28 + band * 0.34 + fresnel * 0.42, 0.2, 0.92);",
          "#include <output_fragment>",
        ].join("\n"),
      );
  };

  material.customProgramCacheKey = () => "astra-live-hologram-v3";
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

    const materialCount = Array.isArray(mesh.material) ? mesh.material.length : 1;
    const hologramMaterials = Array.from({ length: materialCount }, () => makeHologramMaterial(materials));
    mesh.material = Array.isArray(mesh.material) ? hologramMaterials : hologramMaterials[0];
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
      morphMeshes.push(mesh);
    }
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

function selectClip(clips: THREE.AnimationClip[], state: AgentState) {
  for (const hint of CLIP_HINTS[state]) {
    const exact = clips.find((clip) => clip.name.toLowerCase() === hint.toLowerCase());
    if (exact) return exact;
  }
  return clips[0] ?? null;
}

function CameraControls() {
  const { camera, gl } = useThree();
  const controls = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const instance = new OrbitControls(camera, gl.domElement);
    instance.enableDamping = true;
    instance.dampingFactor = 0.06;
    instance.target.set(0, 3.05, 0);
    instance.minDistance = 3.5;
    instance.maxDistance = 7;
    instance.minPolarAngle = Math.PI * 0.29;
    instance.maxPolarAngle = Math.PI * 0.68;
    instance.update();
    controls.current = instance;

    return () => {
      instance.dispose();
      controls.current = null;
    };
  }, [camera, gl]);

  useFrame(() => controls.current?.update());
  return null;
}

function ParticleField({ active }: { active: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 760;
    const values = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.399963;
      const normalized = ((index * 47) % 100) / 100;
      const radius = 0.72 + ((index * 31) % 100) / 170;
      values[index * 3] = Math.cos(angle) * radius * (0.55 + normalized * 0.52);
      values[index * 3 + 1] = normalized * 1.58 - 0.35;
      values[index * 3 + 2] = Math.sin(angle) * radius * 0.6 - 0.18;
    }

    return values;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.05;
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.28) * 0.025;
  });

  return (
    <points ref={ref} position={[0, 3.5, -0.35]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#21e8ff"
        size={active ? 0.034 : 0.024}
        transparent
        opacity={active ? 0.82 : 0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function AnimatedAvatar({ rig, state }: { rig: Rig; state: AgentState }) {
  const motionRoot = useRef<THREE.Group>(null);
  const mixer = useMemo(() => new THREE.AnimationMixer(rig.scene), [rig.scene]);
  const currentAction = useRef<THREE.AnimationAction | null>(null);
  const headBase = useMemo(() => rig.head?.rotation.clone() ?? new THREE.Euler(), [rig.head]);
  const neckBase = useMemo(() => rig.neck?.rotation.clone() ?? new THREE.Euler(), [rig.neck]);
  const chestBase = useMemo(() => rig.chest?.rotation.clone() ?? new THREE.Euler(), [rig.chest]);
  const smooth = useRef({ yaw: 0, pitch: 0, roll: 0, x: 0, y: 0, mouth: 0 });

  useEffect(() => {
    const clip = selectClip(rig.clips, state);
    if (!clip) return;

    const next = mixer.clipAction(clip);
    const previous = currentAction.current;

    if (next !== previous) {
      previous?.fadeOut(0.25);
      next.reset().setEffectiveTimeScale(state === "thinking" ? 0.72 : 1).setEffectiveWeight(1).fadeIn(0.25);
      if (state === "success" || state === "error") {
        next.setLoop(THREE.LoopOnce, 1);
        next.clampWhenFinished = true;
      } else {
        next.setLoop(THREE.LoopRepeat, Infinity);
        next.clampWhenFinished = false;
      }
      next.play();
      currentAction.current = next;
    }
  }, [mixer, rig.clips, state]);

  useEffect(() => {
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer]);

  useFrame(({ clock, pointer }, dt) => {
    mixer.update(dt);
    const t = clock.elapsedTime;

    for (const material of rig.materials) {
      const shader = material.userData.astraShader as { uniforms?: { uAstraTime?: { value: number } } } | undefined;
      if (shader?.uniforms?.uAstraTime) shader.uniforms.uAstraTime.value = t;
      material.emissiveIntensity = state === "speaking" ? 1.3 : state === "thinking" ? 1.1 : 0.92;
    }

    let targetYaw = 0;
    let targetPitch = 0;
    let targetRoll = 0;
    let targetX = 0;
    let targetY = Math.sin(t * 1.45) * 0.012;

    if (state === "listening") {
      targetYaw = pointer.x * 0.16;
      targetPitch = -pointer.y * 0.07;
      targetX = pointer.x * 0.035;
      targetY += -pointer.y * 0.018;
    } else if (state === "thinking") {
      targetYaw = 0.10 + Math.sin(t * 0.55) * 0.055;
      targetPitch = -0.045 + Math.sin(t * 0.38) * 0.018;
      targetRoll = Math.sin(t * 0.44) * 0.012;
      targetX = Math.sin(t * 0.35) * 0.018;
    } else if (state === "speaking") {
      targetYaw = Math.sin(t * 0.72) * 0.045 + pointer.x * 0.025;
      targetPitch = Math.sin(t * 1.55) * 0.026;
      targetRoll = Math.sin(t * 0.9) * 0.008;
      targetY += Math.abs(Math.sin(t * 3.1)) * 0.012;
    } else if (state === "success") {
      targetPitch = -0.055 + Math.sin(t * 2.8) * 0.025;
      targetYaw = Math.sin(t * 0.9) * 0.025;
    } else if (state === "error") {
      targetPitch = 0.045;
      targetRoll = -0.045;
      targetYaw = -0.035;
    }

    const response = 1 - Math.exp(-dt * 5.5);
    smooth.current.yaw = THREE.MathUtils.lerp(smooth.current.yaw, targetYaw, response);
    smooth.current.pitch = THREE.MathUtils.lerp(smooth.current.pitch, targetPitch, response);
    smooth.current.roll = THREE.MathUtils.lerp(smooth.current.roll, targetRoll, response);
    smooth.current.x = THREE.MathUtils.lerp(smooth.current.x, targetX, response);
    smooth.current.y = THREE.MathUtils.lerp(smooth.current.y, targetY, response);

    if (motionRoot.current) {
      // Guaranteed visible fallback motion. This runs even when the GLB has no usable head/neck bones.
      const fallbackScale = rig.head ? 0.36 : 1;
      motionRoot.current.rotation.y = smooth.current.yaw * fallbackScale;
      motionRoot.current.rotation.x = smooth.current.pitch * fallbackScale;
      motionRoot.current.rotation.z = smooth.current.roll * fallbackScale;
      motionRoot.current.position.x = smooth.current.x * fallbackScale;
      motionRoot.current.position.y = smooth.current.y;
    }

    if (rig.head) {
      rig.head.rotation.set(
        headBase.x + smooth.current.pitch,
        headBase.y + smooth.current.yaw,
        headBase.z + smooth.current.roll,
      );
    }

    if (rig.neck) {
      rig.neck.rotation.set(
        neckBase.x + smooth.current.pitch * 0.3,
        neckBase.y + smooth.current.yaw * 0.24,
        neckBase.z + smooth.current.roll * 0.22,
      );
    }

    if (rig.chest) {
      const breath = Math.sin(t * 1.45) * 0.012;
      rig.chest.rotation.set(
        chestBase.x + breath * 0.5,
        chestBase.y,
        chestBase.z + Math.sin(t * 0.5) * 0.005,
      );
    }

    const talk = state === "speaking"
      ? 0.08 + Math.abs(Math.sin(t * 7.5) * 0.32 + Math.sin(t * 12.2) * 0.18)
      : 0;
    smooth.current.mouth = THREE.MathUtils.lerp(
      smooth.current.mouth,
      talk,
      1 - Math.exp(-dt * 13),
    );

    for (const mesh of rig.morphMeshes) {
      const mouthApplied = setMorph(mesh, ["jawopen", "mouthopen", "visemeaa", "visemea"], smooth.current.mouth);
      if (!mouthApplied) {
        setMorph(mesh, ["surprised"], state === "speaking" ? smooth.current.mouth * 0.22 : 0);
      }
      setMorph(mesh, ["smile"], state === "success" ? 0.35 : 0);
      setMorph(mesh, ["sad"], state === "error" ? 0.34 : 0);
      setMorph(mesh, ["angry"], state === "thinking" ? 0.08 : 0);
    }
  });

  return (
    <group ref={motionRoot}>
      <group scale={rig.scale}>
        <primitive object={rig.scene} position={rig.offset} />
      </group>
    </group>
  );
}

function Scene({ rig, state }: { rig: Rig | null; state: AgentState }) {
  const active = state !== "idle";
  const speaking = state === "speaking";

  return (
    <>
      <color attach="background" args={["#02070d"]} />
      <fog attach="fog" args={["#02070d", 8, 16]} />
      <ambientLight intensity={0.3} />
      <hemisphereLight args={["#76efff", "#02060b", 0.85]} />
      <directionalLight position={[3, 6, 5]} intensity={1.2} color="#aef8ff" />
      <pointLight position={[-2.3, 3.4, 2.5]} intensity={active ? 2.4 : 1.4} color="#00dfff" />
      <pointLight position={[0.2, 3.35, 1.2]} intensity={speaking ? 4.4 : 2.5} color="#ff9d31" />

      <mesh position={[0, 3.42, -0.65]}>
        <ringGeometry args={[1.28, 1.295, 128]} />
        <meshBasicMaterial color="#10e5ff" transparent opacity={active ? 0.42 : 0.25} />
      </mesh>

      <mesh position={[0, 3.4, -0.42]}>
        <sphereGeometry args={[0.13, 32, 32]} />
        <meshBasicMaterial color="#ff9d31" transparent opacity={speaking ? 1 : 0.58} />
      </mesh>

      <ParticleField active={active} />
      {rig ? <AnimatedAvatar rig={rig} state={state} /> : null}
      <CameraControls />
    </>
  );
}

const buttonBase: CSSProperties = {
  borderRadius: 6,
  padding: "8px 11px",
  fontFamily: "inherit",
  fontSize: 9,
  letterSpacing: ".12em",
  cursor: "pointer",
};

export default function HumanoidLabV3() {
  const [rig, setRig] = useState<Rig | null>(null);
  const [state, setState] = useState<AgentState>("idle");
  const [autoDemo, setAutoDemo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelName, setModelName] = useState("RobotExpressive — ASTRA hologram");
  const localUrl = useRef<string | null>(null);

  const load = async (url: string, name: string) => {
    setLoading(true);
    setError(null);
    try {
      const next = await loadRig(url);
      setRig(next);
      setModelName(name);
    } catch (cause) {
      console.error(cause);
      setError("Model gagal dimuat. Coba refresh atau pilih file .glb dari PC.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(DEFAULT_MODEL, "RobotExpressive — ASTRA hologram");
    return () => {
      if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    };
  }, []);

  useEffect(() => {
    if (!autoDemo) return;
    let index = 0;
    const timer = window.setInterval(() => {
      index = (index + 1) % STATES.length;
      setState(STATES[index]);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [autoDemo]);

  const chooseState = (next: AgentState) => {
    setAutoDemo(false);
    setState(next);
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setError("Gunakan file .glb agar model, texture, rig, dan animasi berada dalam satu file.");
      return;
    }

    if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    localUrl.current = URL.createObjectURL(file);
    void load(localUrl.current, file.name);
  };

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
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", height: "100%" }}>
        <section style={{ position: "relative", height: "100%", overflow: "hidden" }}>
          <Canvas
            style={{ width: "100%", height: "100%", display: "block" }}
            camera={{ position: [0, 3.05, 4.8], fov: 32, near: 0.1, far: 30 }}
            dpr={[1, 1.6]}
            gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
          >
            <Scene rig={rig} state={state} />
          </Canvas>

          <div style={{ position: "absolute", left: 22, top: 20, pointerEvents: "none" }}>
            <div style={{ fontSize: 11, letterSpacing: ".28em", color: "#7cf4ff" }}>ASTRA // HUMANOID MOTION TEST V3</div>
            <div style={{ marginTop: 8, fontSize: 27, fontFamily: "system-ui, sans-serif", fontWeight: 300 }}>Guaranteed Live Motion</div>
            <div style={{ marginTop: 8, fontSize: 10, letterSpacing: ".14em", color: "#ffb25f" }}>{state.toUpperCase()} // {autoDemo ? "AUTO DEMO" : "MANUAL"}</div>
          </div>

          <div style={{ position: "absolute", left: 22, bottom: 22, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setAutoDemo((value) => !value)}
              style={{
                ...buttonBase,
                border: "1px solid rgba(255,166,76,.6)",
                background: autoDemo ? "rgba(255,155,55,.14)" : "rgba(2,12,21,.8)",
                color: "#ffc37f",
              }}
            >
              AUTO DEMO {autoDemo ? "ON" : "OFF"}
            </button>
            {STATES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => chooseState(value)}
                style={{
                  ...buttonBase,
                  border: `1px solid ${state === value ? "rgba(0,229,255,.85)" : "rgba(150,235,255,.18)"}`,
                  background: state === value ? "rgba(0,229,255,.13)" : "rgba(2,12,21,.8)",
                  color: state === value ? "#9af9ff" : "rgba(220,248,255,.62)",
                }}
              >
                {value.toUpperCase()}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(2,7,13,.72)" }}>
              <div style={{ fontSize: 11, letterSpacing: ".24em", color: "#8ff8ff" }}>LOADING LIVE RIG...</div>
            </div>
          ) : null}
        </section>

        <aside style={{ borderLeft: "1px solid rgba(87,220,255,.14)", padding: 22, background: "rgba(2,10,17,.97)", overflowY: "auto" }}>
          <a href="/" style={{ color: "rgba(180,242,255,.7)", textDecoration: "none", fontSize: 10, letterSpacing: ".16em" }}>← KEMBALI KE ASTRA</a>

          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 9, letterSpacing: ".18em", color: "rgba(117,242,255,.65)" }}>MODEL AKTIF</div>
            <div style={{ marginTop: 8, fontFamily: "system-ui, sans-serif", fontSize: 18 }}>{modelName}</div>
            <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.6, color: "rgba(220,245,255,.46)" }}>
              V3 menggerakkan seluruh bust sebagai fallback. Jadi motion tetap terlihat walaupun nama bone model tidak cocok.
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)" }}>
            <div style={{ fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 10 }}>MOTION TEST</div>
            <div style={{ fontSize: 10, lineHeight: 1.75, color: "rgba(220,245,255,.55)" }}>
              <div><strong style={{ color: "#9af9ff" }}>LISTENING:</strong> gerakkan cursor di area avatar.</div>
              <div><strong style={{ color: "#9af9ff" }}>THINKING:</strong> kepala/bust menoleh dan condong perlahan.</div>
              <div><strong style={{ color: "#9af9ff" }}>SPEAKING:</strong> nod, sway, dan morph mulut bila tersedia.</div>
              <div><strong style={{ color: "#9af9ff" }}>SUCCESS/ERROR:</strong> gesture clip + pose fallback.</div>
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)" }}>
            <div style={{ fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 10 }}>RIG DETECTION</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "7px 12px", fontSize: 10, color: "rgba(220,245,255,.58)" }}>
              <span>Bones</span><strong style={{ color: "#b9f9ff" }}>{rig?.stats.bones ?? 0}</strong>
              <span>Meshes</span><strong style={{ color: "#b9f9ff" }}>{rig?.stats.meshes ?? 0}</strong>
              <span>Skinned meshes</span><strong style={{ color: "#b9f9ff" }}>{rig?.stats.skinned ?? 0}</strong>
              <span>Head controller</span><strong style={{ color: rig?.head ? "#8fffb1" : "#ffbd75" }}>{rig?.head ? "YES" : "FALLBACK"}</strong>
              <span>Neck controller</span><strong style={{ color: rig?.neck ? "#8fffb1" : "#ffbd75" }}>{rig?.neck ? "YES" : "FALLBACK"}</strong>
              <span>Morph targets</span><strong style={{ color: "#b9f9ff" }}>{rig?.stats.morphs.length ?? 0}</strong>
              <span>Animation clips</span><strong style={{ color: "#b9f9ff" }}>{rig?.clips.length ?? 0}</strong>
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)" }}>
            <label style={{ display: "block", fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 9 }}>TES FILE .GLB DARI PC</label>
            <input type="file" accept=".glb,model/gltf-binary" onChange={chooseFile} style={{ width: "100%", fontSize: 11, color: "rgba(225,248,255,.72)" }} />
          </div>

          {error ? (
            <div style={{ marginTop: 18, padding: 11, border: "1px solid rgba(255,95,95,.28)", borderRadius: 6, background: "rgba(255,65,65,.06)", color: "#ffb6b6", fontSize: 10, lineHeight: 1.55 }}>
              {error}
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
