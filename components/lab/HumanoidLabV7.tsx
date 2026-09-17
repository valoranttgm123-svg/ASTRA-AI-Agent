"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const FACE_MODEL = "https://threejs.org/examples/models/gltf/facecap.glb";

type AgentState = "idle" | "listening" | "thinking" | "speaking" | "success" | "error";
type FaceStats = { meshes: number; morphTargets: number };

type LoadedFace = {
  scene: THREE.Group;
  morphMeshes: THREE.Mesh[];
  scale: number;
  offset: THREE.Vector3;
  stats: FaceStats;
};

const STATES: AgentState[] = ["idle", "listening", "thinking", "speaking", "success", "error"];

function normalizeMorph(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function setMorph(mesh: THREE.Mesh, names: string[], value: number, alpha: number) {
  if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
  for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
    const normalized = normalizeMorph(name);
    if (!names.some((needle) => normalized.includes(needle))) continue;
    mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(
      mesh.morphTargetInfluences[index] ?? 0,
      value,
      alpha,
    );
  }
}

function sanitizeGlb(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546c67) return buffer;

  const version = view.getUint32(4, true);
  if (version !== 2) return buffer;

  let offset = 12;
  const chunks: Array<{ type: number; data: Uint8Array }> = [];

  while (offset + 8 <= buffer.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const data = new Uint8Array(buffer.slice(offset + 8, offset + 8 + length));
    chunks.push({ type, data });
    offset += 8 + length;
  }

  const jsonChunk = chunks.find((chunk) => chunk.type === 0x4e4f534a);
  if (!jsonChunk) return buffer;

  const text = new TextDecoder().decode(jsonChunk.data).replace(/\u0000+$/g, "").trim();
  const json = JSON.parse(text) as Record<string, any>;

  delete json.images;
  delete json.textures;
  delete json.samplers;

  if (Array.isArray(json.materials)) {
    for (const material of json.materials) {
      if (material?.pbrMetallicRoughness) {
        delete material.pbrMetallicRoughness.baseColorTexture;
        delete material.pbrMetallicRoughness.metallicRoughnessTexture;
      }
      delete material.normalTexture;
      delete material.occlusionTexture;
      delete material.emissiveTexture;
    }
  }

  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const paddedLength = Math.ceil(encoded.byteLength / 4) * 4;
  const paddedJson = new Uint8Array(paddedLength);
  paddedJson.fill(0x20);
  paddedJson.set(encoded);
  jsonChunk.data = paddedJson;

  const totalLength = 12 + chunks.reduce((sum, chunk) => sum + 8 + chunk.data.byteLength, 0);
  const output = new ArrayBuffer(totalLength);
  const out = new DataView(output);
  out.setUint32(0, magic, true);
  out.setUint32(4, version, true);
  out.setUint32(8, totalLength, true);

  let write = 12;
  for (const chunk of chunks) {
    out.setUint32(write, chunk.data.byteLength, true);
    out.setUint32(write + 4, chunk.type, true);
    new Uint8Array(output, write + 8, chunk.data.byteLength).set(chunk.data);
    write += 8 + chunk.data.byteLength;
  }

  return output;
}

async function loadFace(): Promise<LoadedFace> {
  const response = await fetch(FACE_MODEL, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Face model HTTP ${response.status}`);
  const clean = sanitizeGlb(await response.arrayBuffer());
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(clean, "");

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

    mesh.material = new THREE.MeshStandardMaterial({
      color: "#04131b",
      emissive: "#007b91",
      emissiveIntensity: 0.72,
      roughness: 0.42,
      metalness: 0.04,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
      morphMeshes.push(mesh);
      Object.keys(mesh.morphTargetDictionary).forEach((name) => morphNames.add(name));
    }
  });

  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  return {
    scene,
    morphMeshes,
    scale: size.y > 0.0001 ? 2.45 / size.y : 1,
    offset: new THREE.Vector3(-center.x, -center.y + 0.25 / (size.y > 0.0001 ? 2.45 / size.y : 1), -center.z),
    stats: { meshes, morphTargets: morphNames.size },
  };
}

function ContourShell({ active, speaking }: { active: boolean; speaking: boolean }) {
  const group = useRef<THREE.Group>(null);
  const lines = useMemo(() => {
    const result: THREE.BufferGeometry[] = [];
    const count = 54;
    for (let i = 0; i < count; i += 1) {
      const p = i / (count - 1);
      const y = THREE.MathUtils.lerp(-0.82, 1.04, p);
      const normalized = (y + 0.04) / 0.98;
      const ellipse = Math.sqrt(Math.max(0, 1 - normalized * normalized));
      const width = 0.72 * (0.42 + ellipse * 0.76);
      const depth = 0.46 * (0.45 + ellipse * 0.68);
      const points: THREE.Vector3[] = [];
      const segments = 80;
      for (let s = 0; s <= segments; s += 1) {
        const a = (s / segments) * Math.PI * 2;
        const frontBias = Math.cos(a) > 0 ? 1.0 : 0.9;
        points.push(new THREE.Vector3(Math.cos(a) * width, y, Math.sin(a) * depth * frontBias));
      }
      result.push(new THREE.BufferGeometry().setFromPoints(points));
    }
    return result;
  }, []);

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.23) * 0.025;
    group.current.position.y = Math.sin(clock.elapsedTime * 0.9) * 0.008;
  });

  return (
    <group ref={group} position={[0, 0.22, -0.05]}>
      {lines.map((geometry, index) => (
        <line key={index} geometry={geometry}>
          <lineBasicMaterial
            color={speaking ? "#69f5ff" : "#20cbe2"}
            transparent
            opacity={active ? 0.46 : 0.26}
            blending={THREE.AdditiveBlending}
          />
        </line>
      ))}
    </group>
  );
}

function ParticleCrown({ active }: { active: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 1050;
    const data = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const a = i * 2.399963;
      const y = ((i * 41) % 100) / 100;
      const r = 0.62 + ((i * 17) % 100) / 240;
      data[i * 3] = Math.cos(a) * r * (0.5 + y * 0.55);
      data[i * 3 + 1] = 0.28 + y * 1.15;
      data[i * 3 + 2] = Math.sin(a) * r * 0.55 - 0.18;
    }
    return data;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.045;
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.18) * 0.018;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#36eaff"
        size={active ? 0.023 : 0.016}
        transparent
        opacity={active ? 0.72 : 0.38}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Avatar({ face, state }: { face: LoadedFace; state: AgentState }) {
  const root = useRef<THREE.Group>(null);
  const smooth = useRef({ yaw: 0, pitch: 0, roll: 0, mouth: 0, y: 0 });
  const blinkStart = useRef(-1);
  const nextBlink = useRef(2.2);

  useFrame(({ clock, pointer }, dt) => {
    const t = clock.elapsedTime;
    const response = 1 - Math.exp(-dt * 6.2);
    let yaw = Math.sin(t * 0.28) * 0.018;
    let pitch = Math.sin(t * 0.35) * 0.008;
    let roll = Math.sin(t * 0.21) * 0.006;
    let y = Math.sin(t * 1.15) * 0.008;

    if (state === "listening") {
      yaw = pointer.x * 0.18;
      pitch = -pointer.y * 0.08;
    } else if (state === "thinking") {
      yaw = 0.08 + Math.sin(t * 0.45) * 0.035;
      pitch = -0.035;
      roll = 0.012;
    } else if (state === "speaking") {
      yaw = Math.sin(t * 0.55) * 0.03;
      pitch = Math.sin(t * 1.35) * 0.016;
      y += Math.abs(Math.sin(t * 2.4)) * 0.006;
    } else if (state === "success") {
      pitch = -0.026 + Math.sin(t * 2.1) * 0.012;
    } else if (state === "error") {
      pitch = 0.022;
      yaw = -0.035;
      roll = -0.022;
    }

    smooth.current.yaw = THREE.MathUtils.lerp(smooth.current.yaw, yaw, response);
    smooth.current.pitch = THREE.MathUtils.lerp(smooth.current.pitch, pitch, response);
    smooth.current.roll = THREE.MathUtils.lerp(smooth.current.roll, roll, response);
    smooth.current.y = THREE.MathUtils.lerp(smooth.current.y, y, response);

    if (root.current) {
      root.current.rotation.set(smooth.current.pitch, smooth.current.yaw, smooth.current.roll);
      root.current.position.y = smooth.current.y;
    }

    if (t >= nextBlink.current && blinkStart.current < 0) {
      blinkStart.current = t;
      nextBlink.current = t + 3 + ((Math.sin(t * 3.8) + 1) * 0.5) * 2;
    }

    let blink = 0;
    if (blinkStart.current >= 0) {
      const elapsed = t - blinkStart.current;
      if (elapsed < 0.15) blink = Math.sin((elapsed / 0.15) * Math.PI);
      else blinkStart.current = -1;
    }

    const talk = state === "speaking"
      ? 0.08 + Math.abs(Math.sin(t * 7.0) * 0.22 + Math.sin(t * 11.8) * 0.11)
      : 0;
    smooth.current.mouth = THREE.MathUtils.lerp(smooth.current.mouth, talk, 1 - Math.exp(-dt * 12));

    for (const mesh of face.morphMeshes) {
      if (mesh.morphTargetInfluences) {
        for (let i = 0; i < mesh.morphTargetInfluences.length; i += 1) {
          mesh.morphTargetInfluences[i] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[i] ?? 0, 0, 1 - Math.exp(-dt * 7));
        }
      }
      setMorph(mesh, ["eyeblinkleft", "eyeblinkl"], blink, 0.92);
      setMorph(mesh, ["eyeblinkright", "eyeblinkr"], blink, 0.92);
      setMorph(mesh, ["jawopen"], smooth.current.mouth, 0.84);
      setMorph(mesh, ["mouthsmileleft", "mouthsmileright"], state === "success" ? 0.18 : 0, 0.65);
      setMorph(mesh, ["browdownleft", "browdownright"], state === "thinking" ? 0.1 : 0, 0.62);
    }
  });

  const active = state !== "idle";
  const speaking = state === "speaking";

  return (
    <group ref={root}>
      <group scale={face.scale}>
        <primitive object={face.scene} position={face.offset} />
      </group>
      <ContourShell active={active} speaking={speaking} />
      <ParticleCrown active={active} />

      <mesh position={[0, -0.86, 0]}>
        <cylinderGeometry args={[0.28, 0.4, 0.68, 48, 1, true]} />
        <meshStandardMaterial color="#03131a" emissive="#008da2" emissiveIntensity={0.55} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <mesh position={[0, -1.25, -0.02]} scale={[1.5, 0.48, 0.74]}>
        <sphereGeometry args={[1, 64, 36, 0, Math.PI * 2, 0, Math.PI * 0.54]} />
        <meshStandardMaterial color="#031219" emissive="#007f94" emissiveIntensity={0.46} transparent opacity={0.22} wireframe depthWrite={false} />
      </mesh>

      <mesh position={[0, -0.18, 0.42]}>
        <sphereGeometry args={[0.11, 32, 32]} />
        <meshBasicMaterial color="#ff9d32" transparent opacity={speaking ? 0.95 : 0.58} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <pointLight position={[0, -0.16, 0.65]} intensity={speaking ? 3.8 : 2.1} color="#ff9d32" distance={3.8} />
    </group>
  );
}

function CameraRig() {
  const { camera, gl } = useThree();
  const controls = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const next = new OrbitControls(camera, gl.domElement);
    next.enableDamping = true;
    next.enablePan = false;
    next.dampingFactor = 0.06;
    next.target.set(0, -0.18, 0);
    next.minDistance = 3.4;
    next.maxDistance = 5.8;
    next.minAzimuthAngle = -0.55;
    next.maxAzimuthAngle = 0.55;
    next.minPolarAngle = 1.12;
    next.maxPolarAngle = 1.84;
    next.update();
    controls.current = next;
    return () => next.dispose();
  }, [camera, gl]);

  useFrame(() => controls.current?.update());
  return null;
}

function Scene({ face, state }: { face: LoadedFace | null; state: AgentState }) {
  const active = state !== "idle";
  return (
    <>
      <color attach="background" args={["#01070b"]} />
      <fog attach="fog" args={["#01070b", 6, 13]} />
      <ambientLight intensity={0.18} />
      <hemisphereLight args={["#4ceaff", "#01070b", 0.7]} />
      <pointLight position={[-2.2, 1.2, 2.2]} intensity={active ? 2.2 : 1.2} color="#0eddf3" distance={6} />
      <pointLight position={[2.0, 0.4, 1.7]} intensity={0.75} color="#5eefff" distance={5} />

      <mesh position={[0, -0.05, -0.78]}>
        <ringGeometry args={[1.48, 1.495, 128]} />
        <meshBasicMaterial color="#1ad9eb" transparent opacity={active ? 0.3 : 0.16} />
      </mesh>
      <mesh position={[0, -0.05, -0.8]}>
        <ringGeometry args={[1.78, 1.785, 128]} />
        <meshBasicMaterial color="#0b6e7c" transparent opacity={0.16} />
      </mesh>

      {face ? <Avatar face={face} state={state} /> : null}
      <CameraRig />
    </>
  );
}

const buttonBase: CSSProperties = {
  borderRadius: 4,
  padding: "8px 11px",
  fontFamily: "inherit",
  fontSize: 9,
  letterSpacing: ".12em",
  cursor: "pointer",
};

export default function HumanoidLabV7() {
  const [face, setFace] = useState<LoadedFace | null>(null);
  const [state, setState] = useState<AgentState>("idle");
  const [autoDemo, setAutoDemo] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void loadFace()
      .then((loaded) => alive && setFace(loaded))
      .catch((cause) => {
        console.error(cause);
        if (alive) setError("Gagal memuat geometry humanoid. Refresh halaman dan cek koneksi.");
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!autoDemo) return;
    let index = 0;
    const timer = window.setInterval(() => {
      index = (index + 1) % STATES.length;
      setState(STATES[index]);
    }, 3400);
    return () => window.clearInterval(timer);
  }, [autoDemo]);

  const chooseState = useCallback((next: AgentState) => {
    setAutoDemo(false);
    setState(next);
  }, []);

  const activeLabel = state.toUpperCase();

  return (
    <main style={{ height: "100vh", background: "#01070b", color: "#dffaff", fontFamily: "var(--font-mono, monospace)", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", height: "100%" }}>
        <section style={{ position: "relative", minWidth: 0 }}>
          <Canvas
            style={{ width: "100%", height: "100%", display: "block" }}
            camera={{ position: [0, 0.0, 4.25], fov: 31, near: 0.1, far: 30 }}
            dpr={[1, 1.55]}
            gl={{ antialias: true, powerPreference: "high-performance" }}
          >
            <Scene face={face} state={state} />
          </Canvas>

          <div style={{ position: "absolute", left: 24, top: 20, pointerEvents: "none" }}>
            <div style={{ fontSize: 10, letterSpacing: ".3em", color: "#61efff" }}>ASTRA // ENTITY INTERFACE V7</div>
            <div style={{ marginTop: 10, fontFamily: "system-ui, sans-serif", fontWeight: 300, fontSize: 29 }}>Interactive Holographic Agent</div>
            <div style={{ marginTop: 9, fontSize: 9, letterSpacing: ".18em", color: state === "speaking" ? "#ffb15e" : "rgba(151,241,255,.72)" }}>{activeLabel} // {autoDemo ? "AUTO" : "MANUAL"}</div>
          </div>

          <div style={{ position: "absolute", left: 24, top: "46%", width: 160, pointerEvents: "none" }}>
            <div style={{ fontSize: 8, letterSpacing: ".17em", color: "rgba(103,234,255,.55)" }}>COGNITIVE STATE</div>
            <div style={{ marginTop: 7, height: 1, background: "linear-gradient(90deg,rgba(61,233,255,.65),transparent)" }} />
            <div style={{ marginTop: 8, fontSize: 11, color: "rgba(225,251,255,.74)" }}>{activeLabel}</div>
          </div>

          <div style={{ position: "absolute", right: 26, top: "43%", textAlign: "right", pointerEvents: "none" }}>
            <div style={{ fontSize: 8, letterSpacing: ".17em", color: "rgba(103,234,255,.52)" }}>ENTITY LINK</div>
            <div style={{ marginTop: 8, fontSize: 10, color: "rgba(225,251,255,.68)" }}>FACE MORPH // ACTIVE</div>
            <div style={{ marginTop: 4, fontSize: 10, color: "rgba(225,251,255,.48)" }}>AGENT STATE // SYNC</div>
          </div>

          <div style={{ position: "absolute", left: 24, bottom: 24, display: "flex", gap: 7, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setAutoDemo((value) => !value)} style={{ ...buttonBase, border: "1px solid rgba(255,167,76,.48)", background: autoDemo ? "rgba(255,154,54,.11)" : "rgba(2,12,18,.82)", color: "#ffc17b" }}>
              DEMO {autoDemo ? "ON" : "OFF"}
            </button>
            {STATES.map((value) => (
              <button key={value} type="button" onClick={() => chooseState(value)} style={{ ...buttonBase, border: `1px solid ${state === value ? "rgba(54,234,255,.82)" : "rgba(145,233,255,.16)"}`, background: state === value ? "rgba(0,218,242,.11)" : "rgba(2,12,18,.82)", color: state === value ? "#9af8ff" : "rgba(220,247,255,.54)" }}>
                {value.toUpperCase()}
              </button>
            ))}
          </div>

          {!face && !error ? (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
              <div style={{ fontSize: 10, letterSpacing: ".24em", color: "rgba(125,241,255,.76)" }}>INITIALIZING ENTITY...</div>
            </div>
          ) : null}
        </section>

        <aside style={{ borderLeft: "1px solid rgba(81,220,244,.12)", background: "rgba(2,10,15,.96)", padding: 22, overflowY: "auto" }}>
          <a href="/" style={{ color: "rgba(183,243,255,.62)", textDecoration: "none", fontSize: 9, letterSpacing: ".15em" }}>← KEMBALI KE ASTRA</a>

          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 8, letterSpacing: ".18em", color: "rgba(97,239,255,.58)" }}>ENTITY</div>
            <div style={{ marginTop: 8, fontFamily: "system-ui, sans-serif", fontSize: 17, fontWeight: 300 }}>ASTRA H-01</div>
            <div style={{ marginTop: 7, fontSize: 9, lineHeight: 1.65, color: "rgba(211,244,251,.43)" }}>
              Original ASTRA holographic agent interface. Inspired by cinematic AI systems, not a copy of APEX artwork/source.
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid rgba(81,220,244,.1)" }}>
            <div style={{ fontSize: 8, letterSpacing: ".18em", color: "rgba(97,239,255,.58)" }}>LIVE TELEMETRY</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px 12px", marginTop: 12, fontSize: 9, color: "rgba(211,244,251,.5)" }}>
              <span>State</span><strong style={{ color: "#9af8ff" }}>{activeLabel}</strong>
              <span>Face geometry</span><strong style={{ color: face ? "#98ffbd" : "#ffc17b" }}>{face ? "READY" : "LOADING"}</strong>
              <span>Morph targets</span><strong style={{ color: "#baf7ff" }}>{face?.stats.morphTargets ?? 0}</strong>
              <span>Meshes</span><strong style={{ color: "#baf7ff" }}>{face?.stats.meshes ?? 0}</strong>
              <span>Textures</span><strong style={{ color: "#98ffbd" }}>DISABLED</strong>
              <span>Agent link</span><strong style={{ color: "#98ffbd" }}>SIMULATED</strong>
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid rgba(81,220,244,.1)" }}>
            <div style={{ fontSize: 8, letterSpacing: ".18em", color: "rgba(97,239,255,.58)" }}>INTERACTION MAP</div>
            <div style={{ marginTop: 10, fontSize: 9, lineHeight: 1.8, color: "rgba(211,244,251,.47)" }}>
              <div>LISTENING → follows pointer</div>
              <div>THINKING → focus posture</div>
              <div>SPEAKING → face morph + orange core</div>
              <div>SUCCESS / ERROR → response pose</div>
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid rgba(81,220,244,.1)" }}>
            <div style={{ fontSize: 8, letterSpacing: ".18em", color: "rgba(97,239,255,.58)" }}>NEXT</div>
            <div style={{ marginTop: 9, fontSize: 9, lineHeight: 1.7, color: "rgba(211,244,251,.43)" }}>
              Voice input, TTS amplitude, viseme mapping, and real ASTRA runtime state will be connected after visual approval.
            </div>
          </div>

          {error ? <div style={{ marginTop: 20, padding: 11, border: "1px solid rgba(255,91,91,.26)", borderRadius: 5, color: "#ffb1b1", background: "rgba(255,61,61,.05)", fontSize: 9, lineHeight: 1.55 }}>{error}</div> : null}
        </aside>
      </div>
    </main>
  );
}
