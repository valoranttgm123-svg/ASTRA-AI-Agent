"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
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

function normalizedMorphName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function morphMatches(name: string, fragments: string[]) {
  const normalized = normalizedMorphName(name);
  return fragments.some((fragment) => normalized.includes(fragment));
}

function setMorphTarget(mesh: THREE.Mesh, fragments: string[], target: number, alpha: number) {
  if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
  for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
    if (!morphMatches(name, fragments)) continue;
    const current = mesh.morphTargetInfluences[index] ?? 0;
    mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(current, target, alpha);
  }
}

function safeHumanMaterial(name: string) {
  const lower = name.toLowerCase();
  const isEye = lower.includes("eye");
  const isTeeth = lower.includes("teeth") || lower.includes("tooth");

  if (isEye) {
    return new THREE.MeshStandardMaterial({
      color: "#b9fbff",
      emissive: "#036d86",
      emissiveIntensity: 0.65,
      roughness: 0.18,
      metalness: 0.08,
      transparent: true,
      opacity: 0.96,
    });
  }

  if (isTeeth) {
    return new THREE.MeshStandardMaterial({
      color: "#d9feff",
      emissive: "#02566b",
      emissiveIntensity: 0.32,
      roughness: 0.32,
      transparent: true,
      opacity: 0.9,
    });
  }

  return new THREE.MeshStandardMaterial({
    color: "#073746",
    emissive: "#00bdd8",
    emissiveIntensity: 0.9,
    roughness: 0.28,
    metalness: 0.08,
    transparent: true,
    opacity: 0.76,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
}

function FaceLoader({
  state,
  onReady,
  onError,
}: {
  state: AgentState;
  onReady: (stats: FaceStats) => void;
  onError: (message: string) => void;
}) {
  const { gl } = useThree();
  const [face, setFace] = useState<LoadedFace | null>(null);
  const root = useRef<THREE.Group>(null);
  const blinkStart = useRef(-1);
  const nextBlink = useRef(2.4);
  const smooth = useRef({ yaw: 0, pitch: 0, roll: 0, y: 0, mouth: 0 });

  useEffect(() => {
    let cancelled = false;
    const ktx2 = new KTX2Loader().detectSupport(gl);
    const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);

    void loader
      .loadAsync(FACE_MODEL)
      .then((gltf) => {
        if (cancelled) return;
        const scene = gltf.scene;
        const morphMeshes: THREE.Mesh[] = [];
        const morphNames = new Set<string>();
        let meshes = 0;

        scene.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
          meshes += 1;
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          mesh.material = safeHumanMaterial(mesh.name);
          if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
            morphMeshes.push(mesh);
            Object.keys(mesh.morphTargetDictionary).forEach((name) => morphNames.add(name));
          }
        });

        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = size.y > 0.0001 ? 2.5 / size.y : 1;
        const offset = new THREE.Vector3(-center.x, -center.y + 0.34 / scale, -center.z);
        const stats = { meshes, morphTargets: morphNames.size, animationClips: gltf.animations.length };

        setFace({ scene, morphMeshes, scale, offset, stats });
        onReady(stats);
      })
      .catch((cause) => {
        console.error(cause);
        if (!cancelled) onError("FaceCap gagal dimuat. Periksa koneksi internet/CORS lalu refresh halaman.");
      });

    return () => {
      cancelled = true;
      ktx2.dispose();
    };
  }, [gl, onError, onReady]);

  useFrame(({ clock, pointer }, dt) => {
    if (!face) return;
    const t = clock.elapsedTime;
    const response = 1 - Math.exp(-dt * 6.4);

    let yaw = Math.sin(t * 0.32) * 0.018;
    let pitch = Math.sin(t * 0.43) * 0.008;
    let roll = Math.sin(t * 0.27) * 0.006;
    let vertical = Math.sin(t * 1.25) * 0.008;

    if (state === "listening") {
      yaw = pointer.x * 0.24;
      pitch = -pointer.y * 0.11;
      roll = pointer.x * -0.018;
    } else if (state === "thinking") {
      yaw = 0.11 + Math.sin(t * 0.5) * 0.045;
      pitch = -0.045 + Math.sin(t * 0.34) * 0.012;
      roll = 0.018;
    } else if (state === "speaking") {
      yaw = Math.sin(t * 0.55) * 0.035;
      pitch = Math.sin(t * 1.45) * 0.02;
      vertical += Math.abs(Math.sin(t * 2.7)) * 0.008;
    } else if (state === "success") {
      pitch = -0.035 + Math.sin(t * 2.4) * 0.018;
      yaw = Math.sin(t * 0.8) * 0.02;
    } else if (state === "error") {
      pitch = 0.025;
      yaw = -0.04;
      roll = -0.025;
    }

    smooth.current.yaw = THREE.MathUtils.lerp(smooth.current.yaw, yaw, response);
    smooth.current.pitch = THREE.MathUtils.lerp(smooth.current.pitch, pitch, response);
    smooth.current.roll = THREE.MathUtils.lerp(smooth.current.roll, roll, response);
    smooth.current.y = THREE.MathUtils.lerp(smooth.current.y, vertical, response);

    if (root.current) {
      root.current.rotation.set(smooth.current.pitch, smooth.current.yaw, smooth.current.roll);
      root.current.position.y = smooth.current.y;
    }

    if (t >= nextBlink.current && blinkStart.current < 0) {
      blinkStart.current = t;
      nextBlink.current = t + 3.0 + ((Math.sin(t * 4.71) + 1) * 0.5) * 2.2;
    }

    let blink = 0;
    if (blinkStart.current >= 0) {
      const elapsed = t - blinkStart.current;
      if (elapsed <= 0.16) blink = Math.sin((elapsed / 0.16) * Math.PI);
      else blinkStart.current = -1;
    }

    const talk = state === "speaking"
      ? 0.12 + Math.abs(Math.sin(t * 7.4) * 0.38 + Math.sin(t * 12.1) * 0.16)
      : 0;
    smooth.current.mouth = THREE.MathUtils.lerp(smooth.current.mouth, talk, 1 - Math.exp(-dt * 13));

    for (const mesh of face.morphMeshes) {
      if (mesh.morphTargetInfluences) {
        for (let i = 0; i < mesh.morphTargetInfluences.length; i += 1) {
          mesh.morphTargetInfluences[i] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[i] ?? 0, 0, 1 - Math.exp(-dt * 7));
        }
      }

      setMorphTarget(mesh, ["eyeblinkleft", "eyeblinkl"], blink, 0.92);
      setMorphTarget(mesh, ["eyeblinkright", "eyeblinkr"], blink, 0.92);
      setMorphTarget(mesh, ["jawopen"], smooth.current.mouth, 0.88);
      setMorphTarget(mesh, ["mouthfunnel"], state === "speaking" ? smooth.current.mouth * 0.24 : 0, 0.7);
      setMorphTarget(mesh, ["mouthpucker"], state === "speaking" ? Math.abs(Math.sin(t * 5.3)) * 0.18 : 0, 0.65);
      setMorphTarget(mesh, ["mouthsmileleft", "mouthsmilel"], state === "success" ? 0.38 : 0, 0.72);
      setMorphTarget(mesh, ["mouthsmileright", "mouthsmiler"], state === "success" ? 0.38 : 0, 0.72);
      setMorphTarget(mesh, ["mouthfrownleft", "mouthfrownl"], state === "error" ? 0.24 : 0, 0.72);
      setMorphTarget(mesh, ["mouthfrownright", "mouthfrownr"], state === "error" ? 0.24 : 0, 0.72);
      setMorphTarget(mesh, ["browdownleft", "browdownl"], state === "thinking" ? 0.18 : 0, 0.62);
      setMorphTarget(mesh, ["browdownright", "browdownr"], state === "thinking" ? 0.18 : 0, 0.62);
      setMorphTarget(mesh, ["eyewideleft", "eyewidel"], state === "listening" ? 0.09 : 0, 0.55);
      setMorphTarget(mesh, ["eyewideright", "eyewider"], state === "listening" ? 0.09 : 0, 0.55);
    }
  });

  return (
    <group ref={root}>
      <group position={[0, -0.15, 0]}>
        <mesh position={[0, -1.02, -0.06]} scale={[1.48, 0.48, 0.72]}>
          <sphereGeometry args={[1, 72, 40]} />
          <meshStandardMaterial color="#063442" emissive="#00a9c5" emissiveIntensity={0.72} transparent opacity={0.48} roughness={0.3} metalness={0.08} />
        </mesh>
        <mesh position={[0, -0.66, -0.02]}>
          <cylinderGeometry args={[0.31, 0.43, 0.68, 48]} />
          <meshStandardMaterial color="#073442" emissive="#00bdd8" emissiveIntensity={0.76} transparent opacity={0.54} roughness={0.28} />
        </mesh>
        <mesh position={[0, -1.02, 0.36]}>
          <sphereGeometry args={[0.12, 32, 32]} />
          <meshBasicMaterial color="#ff9d32" transparent opacity={state === "speaking" ? 0.95 : 0.62} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>

      {face ? (
        <group scale={face.scale}>
          <primitive object={face.scene} position={face.offset} />
        </group>
      ) : null}
    </group>
  );
}

function ParticleHalo({ active }: { active: boolean }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 840;
    const data = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const a = i * 2.399963;
      const y = ((i * 43) % 100) / 100;
      const r = 0.76 + ((i * 29) % 100) / 170;
      data[i * 3] = Math.cos(a) * r * (0.62 + y * 0.42);
      data[i * 3 + 1] = y * 1.72 - 0.54;
      data[i * 3 + 2] = Math.sin(a) * r * 0.62 - 0.32;
    }
    return data;
  }, []);

  useFrame(({ clock }) => {
    if (!points.current) return;
    points.current.rotation.y = clock.elapsedTime * 0.035;
    points.current.rotation.z = Math.sin(clock.elapsedTime * 0.21) * 0.025;
  });

  return (
    <points ref={points} position={[0, 0.42, -0.4]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#16e6ff" size={active ? 0.025 : 0.018} transparent opacity={active ? 0.78 : 0.48} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function CameraControls() {
  const { camera, gl } = useThree();
  const controls = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const next = new OrbitControls(camera, gl.domElement);
    next.enableDamping = true;
    next.dampingFactor = 0.07;
    next.enablePan = false;
    next.target.set(0, -0.05, 0);
    next.minDistance = 2.8;
    next.maxDistance = 6.2;
    next.minAzimuthAngle = -Math.PI * 0.42;
    next.maxAzimuthAngle = Math.PI * 0.42;
    next.minPolarAngle = Math.PI * 0.3;
    next.maxPolarAngle = Math.PI * 0.66;
    next.update();
    controls.current = next;
    return () => {
      next.dispose();
      controls.current = null;
    };
  }, [camera, gl]);

  useFrame(() => controls.current?.update());
  return null;
}

function Scene({ state, onReady, onError }: { state: AgentState; onReady: (stats: FaceStats) => void; onError: (message: string) => void }) {
  const active = state !== "idle";
  const speaking = state === "speaking";

  return (
    <>
      <color attach="background" args={["#02070d"]} />
      <fog attach="fog" args={["#02070d", 5.4, 10]} />
      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#8cf5ff", "#02060a", 0.95]} />
      <directionalLight position={[2.5, 3.8, 4]} intensity={1.25} color="#bffaff" />
      <pointLight position={[-1.4, 0.8, 2.2]} intensity={active ? 2.4 : 1.5} color="#00dcff" />
      <pointLight position={[0.2, 0.3, 1.4]} intensity={speaking ? 4.6 : 2.4} color="#ff9d32" />

      <mesh position={[0, 0.4, -0.72]}>
        <ringGeometry args={[1.34, 1.355, 160]} />
        <meshBasicMaterial color="#15e4ff" transparent opacity={active ? 0.38 : 0.23} />
      </mesh>
      <mesh position={[0, 0.28, -0.48]}>
        <sphereGeometry args={[0.12, 32, 32]} />
        <meshBasicMaterial color="#ff9d32" transparent opacity={speaking ? 0.94 : 0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      <ParticleHalo active={active} />
      <FaceLoader state={state} onReady={onReady} onError={onError} />
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

export default function HumanoidLabV5() {
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
    }, 3400);
    return () => window.clearInterval(timer);
  }, [autoDemo]);

  const chooseState = (next: AgentState) => {
    setAutoDemo(false);
    setState(next);
  };

  return (
    <main style={{ height: "100vh", background: "#02070d", color: "#e9fbff", fontFamily: "var(--font-mono, monospace)", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 370px", height: "100%" }}>
        <section style={{ position: "relative", height: "100%", overflow: "hidden" }}>
          <Canvas camera={{ position: [0, 0.08, 4.15], fov: 34, near: 0.1, far: 20 }} dpr={[1, 1.6]} gl={{ antialias: true, powerPreference: "high-performance", alpha: false }} style={{ width: "100%", height: "100%", display: "block" }}>
            <Scene state={state} onReady={(next) => { setStats(next); setError(null); }} onError={setError} />
          </Canvas>

          <div style={{ position: "absolute", left: 22, top: 20, pointerEvents: "none" }}>
            <div style={{ fontSize: 11, letterSpacing: ".28em", color: "#7cf4ff" }}>ASTRA // HUMAN FACE LAB V5</div>
            <div style={{ marginTop: 8, fontSize: 27, fontFamily: "system-ui, sans-serif", fontWeight: 300 }}>Live Facial Humanoid</div>
            <div style={{ marginTop: 8, fontSize: 10, letterSpacing: ".14em", color: "#ffb25f" }}>{state.toUpperCase()} // {autoDemo ? "AUTO DEMO" : "MANUAL"}</div>
          </div>

          <div style={{ position: "absolute", left: 22, bottom: 22, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setAutoDemo((value) => !value)} style={{ ...buttonBase, border: "1px solid rgba(255,166,76,.6)", background: autoDemo ? "rgba(255,155,55,.14)" : "rgba(2,12,21,.8)", color: "#ffc37f" }}>
              DEMO {autoDemo ? "ON" : "OFF"}
            </button>
            {STATES.map((value) => (
              <button key={value} type="button" onClick={() => chooseState(value)} style={{ ...buttonBase, border: `1px solid ${state === value ? "rgba(0,229,255,.85)" : "rgba(150,235,255,.18)"}`, background: state === value ? "rgba(0,229,255,.13)" : "rgba(2,12,21,.8)", color: state === value ? "#9af9ff" : "rgba(220,248,255,.62)" }}>
                {value.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        <aside style={{ borderLeft: "1px solid rgba(87,220,255,.14)", padding: 22, background: "rgba(2,10,17,.97)", overflowY: "auto" }}>
          <a href="/" style={{ color: "rgba(180,242,255,.7)", textDecoration: "none", fontSize: 10, letterSpacing: ".16em" }}>← KEMBALI KE ASTRA</a>

          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 9, letterSpacing: ".18em", color: "rgba(117,242,255,.65)" }}>MODEL AKTIF</div>
            <div style={{ marginTop: 8, fontFamily: "system-ui, sans-serif", fontSize: 18 }}>FaceCap human head</div>
            <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.65, color: "rgba(220,245,255,.48)" }}>
              V5 mengganti robot dengan kepala manusia ber-facial morph. Bust cyan/orange dibuat terpisah agar visual bisa diarahkan ke referensi tanpa mengubah rig wajah.
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)" }}>
            <div style={{ fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 10 }}>FACIAL SYSTEM</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "7px 12px", fontSize: 10, color: "rgba(220,245,255,.58)" }}>
              <span>Human meshes</span><strong style={{ color: "#b9f9ff" }}>{stats?.meshes ?? "..."}</strong>
              <span>Facial morph targets</span><strong style={{ color: stats?.morphTargets ? "#8fffb1" : "#ffbd75" }}>{stats?.morphTargets ?? "..."}</strong>
              <span>Embedded animation clips</span><strong style={{ color: "#b9f9ff" }}>{stats?.animationClips ?? "..."}</strong>
              <span>Blink</span><strong style={{ color: "#8fffb1" }}>LIVE</strong>
              <span>Jaw / mouth</span><strong style={{ color: "#8fffb1" }}>LIVE</strong>
              <span>Head tracking</span><strong style={{ color: "#8fffb1" }}>LIVE</strong>
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)" }}>
            <div style={{ fontSize: 9, letterSpacing: ".16em", color: "rgba(117,242,255,.7)", marginBottom: 10 }}>TES INTERAKSI</div>
            <div style={{ fontSize: 10, lineHeight: 1.8, color: "rgba(220,245,255,.55)" }}>
              <div><strong style={{ color: "#9af9ff" }}>LISTENING:</strong> wajah mengikuti cursor.</div>
              <div><strong style={{ color: "#9af9ff" }}>THINKING:</strong> brow + pose fokus.</div>
              <div><strong style={{ color: "#9af9ff" }}>SPEAKING:</strong> jawOpen + mouth funnel/pucker.</div>
              <div><strong style={{ color: "#9af9ff" }}>SUCCESS:</strong> senyum.</div>
              <div><strong style={{ color: "#9af9ff" }}>ERROR:</strong> frown + pose turun.</div>
            </div>
          </div>

          {error ? (
            <div style={{ marginTop: 20, padding: 12, border: "1px solid rgba(255,95,95,.3)", borderRadius: 6, background: "rgba(255,65,65,.06)", color: "#ffb6b6", fontSize: 10, lineHeight: 1.55 }}>
              {error}
            </div>
          ) : null}

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(87,220,255,.12)", fontSize: 9, lineHeight: 1.7, color: "rgba(220,245,255,.38)" }}>
            Target tahap ini: gerakan wajah manusia yang natural. Efek contour-line seperti video akan ditambahkan setelah face rig ini stabil, tanpa custom shader yang bisa merusak WebGL.
          </div>
        </aside>
      </div>
    </main>
  );
}
