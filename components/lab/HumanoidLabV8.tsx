"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type AgentState = "idle" | "listening" | "thinking" | "speaking" | "success" | "error";

const STATE_SEQUENCE: AgentState[] = ["idle", "listening", "thinking", "speaking", "success", "idle"];

const CYAN = new THREE.Color("#38ecff");
const CYAN_SOFT = new THREE.Color("#159eb5");

function lineMaterial(color = CYAN, opacity = 0.28) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

function ellipsePoints(rx: number, ry: number, zScale: number, y: number, segments = 96) {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * rx, y + Math.sin(a) * ry * 0.02, Math.sin(a) * zScale));
  }
  return points;
}

function curveLine(points: THREE.Vector3[], color: THREE.Color, opacity: number) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geometry, lineMaterial(color, opacity));
}

function HeadContours({ state }: { state: AgentState }) {
  const group = useMemo(() => {
    const root = new THREE.Group();
    const rows = 62;
    for (let i = 0; i < rows; i += 1) {
      const p = i / (rows - 1);
      const y = THREE.MathUtils.lerp(-0.73, 0.9, p);
      const dome = Math.pow(Math.max(0, Math.sin(Math.PI * p)), 0.52);
      const chinTaper = THREE.MathUtils.smoothstep(p, 0, 0.28);
      const crownTaper = 1 - THREE.MathUtils.smoothstep(p, 0.77, 1);
      const width = 0.27 + dome * 0.47 + chinTaper * 0.05 + crownTaper * 0.02;
      const depth = 0.22 + dome * 0.34;
      const geometry = new THREE.BufferGeometry().setFromPoints(ellipsePoints(width, 0.02, depth, y));
      const material = lineMaterial(CYAN, 0.2 + dome * 0.18);
      const loop = new THREE.LineLoop(geometry, material);
      loop.rotation.x = 0.015 * Math.sin(i * 0.63);
      root.add(loop);
    }
    return root;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    group.rotation.y = Math.sin(t * 0.24) * 0.014;
    group.position.y = Math.sin(t * 0.72) * 0.007;
    const active = state !== "idle";
    const speaking = state === "speaking";
    group.children.forEach((child, index) => {
      const material = (child as THREE.Line).material as THREE.LineBasicMaterial;
      const pulse = speaking ? 0.08 * (0.5 + 0.5 * Math.sin(t * 9 + index * 0.3)) : 0;
      material.opacity = (active ? 0.31 : 0.21) + pulse;
      material.color.lerpColors(CYAN_SOFT, CYAN, active ? 0.76 : 0.5);
    });
  });

  return <primitive object={group} />;
}

function BustContours({ state }: { state: AgentState }) {
  const group = useMemo(() => {
    const root = new THREE.Group();

    for (let i = 0; i < 15; i += 1) {
      const p = i / 14;
      const y = THREE.MathUtils.lerp(-1.08, -0.72, p);
      const width = THREE.MathUtils.lerp(0.36, 0.31, p);
      const depth = THREE.MathUtils.lerp(0.28, 0.24, p);
      const geometry = new THREE.BufferGeometry().setFromPoints(ellipsePoints(width, 0.01, depth, y, 72));
      root.add(new THREE.LineLoop(geometry, lineMaterial(CYAN_SOFT, 0.22)));
    }

    for (let i = 0; i < 34; i += 1) {
      const p = i / 33;
      const y = THREE.MathUtils.lerp(-1.72, -1.06, p);
      const shoulder = Math.sin(p * Math.PI * 0.86);
      const width = 0.58 + shoulder * 1.06;
      const depth = 0.34 + shoulder * 0.24;
      const geometry = new THREE.BufferGeometry().setFromPoints(ellipsePoints(width, 0.01, depth, y, 112));
      root.add(new THREE.LineLoop(geometry, lineMaterial(CYAN_SOFT, 0.13 + shoulder * 0.11)));
    }
    return root;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    group.position.y = Math.sin(t * 0.7) * 0.006;
    group.children.forEach((child, index) => {
      const material = (child as THREE.Line).material as THREE.LineBasicMaterial;
      material.opacity = state === "speaking"
        ? 0.17 + 0.07 * (0.5 + 0.5 * Math.sin(t * 7.4 + index * 0.24))
        : 0.17;
    });
  });

  return <primitive object={group} />;
}

function ParticleCrown({ state }: { state: AgentState }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 1500;
    const data = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const r0 = ((i * 73) % 997) / 997;
      const r1 = ((i * 193) % 991) / 991;
      const angle = i * 2.399963;
      const y = 0.18 + r0 * 1.18;
      const headProfile = Math.max(0.15, Math.sin(Math.PI * Math.min(1, Math.max(0, (y - 0.05) / 1.35))));
      const radius = (0.45 + r1 * 0.42) * (0.58 + headProfile * 0.44);
      data[i * 3] = Math.cos(angle) * radius;
      data[i * 3 + 1] = y;
      data[i * 3 + 2] = Math.sin(angle) * radius * 0.64 - 0.14 + (r1 - 0.5) * 0.18;
    }
    return data;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.rotation.y = t * (state === "thinking" ? 0.09 : 0.035);
    ref.current.rotation.z = Math.sin(t * 0.19) * 0.018;
    const material = ref.current.material as THREE.PointsMaterial;
    material.opacity = state === "idle" ? 0.34 : 0.68;
    material.size = state === "speaking" ? 0.025 : 0.018;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#52efff"
        size={0.018}
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function FaceSignals({ state }: { state: AgentState }) {
  const leftEye = useRef<THREE.Group>(null);
  const rightEye = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Group>(null);
  const blinkStart = useRef(-10);
  const nextBlink = useRef(2.4);

  const eyeLeftLine = useMemo(() => curveLine([
    new THREE.Vector3(-0.42, 0.17, 0.56),
    new THREE.Vector3(-0.3, 0.21, 0.61),
    new THREE.Vector3(-0.17, 0.17, 0.58),
  ], CYAN, 0.58), []);
  const eyeRightLine = useMemo(() => curveLine([
    new THREE.Vector3(0.17, 0.17, 0.58),
    new THREE.Vector3(0.3, 0.21, 0.61),
    new THREE.Vector3(0.42, 0.17, 0.56),
  ], CYAN, 0.58), []);
  const noseLine = useMemo(() => curveLine([
    new THREE.Vector3(0.01, 0.11, 0.61),
    new THREE.Vector3(-0.015, -0.05, 0.67),
    new THREE.Vector3(0.04, -0.15, 0.62),
  ], CYAN_SOFT, 0.3), []);
  const mouthUpper = useMemo(() => curveLine([
    new THREE.Vector3(-0.24, -0.34, 0.57),
    new THREE.Vector3(0, -0.31, 0.63),
    new THREE.Vector3(0.24, -0.34, 0.57),
  ], CYAN, 0.46), []);
  const mouthLower = useMemo(() => curveLine([
    new THREE.Vector3(-0.2, -0.37, 0.57),
    new THREE.Vector3(0, -0.39, 0.62),
    new THREE.Vector3(0.2, -0.37, 0.57),
  ], CYAN_SOFT, 0.34), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (t >= nextBlink.current) {
      blinkStart.current = t;
      nextBlink.current = t + 3.1 + ((Math.sin(t * 8.7) + 1) * 0.5) * 2.4;
    }
    const elapsed = t - blinkStart.current;
    const blink = elapsed >= 0 && elapsed <= 0.17 ? Math.sin((elapsed / 0.17) * Math.PI) : 0;
    const eyeScale = Math.max(0.05, 1 - blink * 0.96);
    if (leftEye.current) leftEye.current.scale.y = eyeScale;
    if (rightEye.current) rightEye.current.scale.y = eyeScale;

    if (mouth.current) {
      const talk = state === "speaking"
        ? 0.5 + 0.5 * Math.sin(t * 8.5) * Math.sin(t * 4.1)
        : 0;
      mouth.current.scale.y = 1 + Math.abs(talk) * 1.8;
      mouth.current.position.y = -Math.abs(talk) * 0.012;
    }
  });

  return (
    <group>
      <group ref={leftEye}><primitive object={eyeLeftLine} /></group>
      <group ref={rightEye}><primitive object={eyeRightLine} /></group>
      <primitive object={noseLine} />
      <group ref={mouth}>
        <primitive object={mouthUpper} />
        <primitive object={mouthLower} />
      </group>
    </group>
  );
}

function EnergyCore({ state }: { state: AgentState }) {
  const faceCore = useRef<THREE.Mesh>(null);
  const chestCore = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const stateBoost = state === "speaking" ? 0.24 : state === "thinking" ? 0.12 : 0;
    const pulse = 1 + Math.sin(t * (state === "speaking" ? 6.5 : 2.4)) * 0.08 + stateBoost;
    faceCore.current?.scale.setScalar(pulse);
    chestCore.current?.scale.setScalar(0.92 + pulse * 0.12);
    if (ring.current) ring.current.rotation.z = t * 0.18;
  });

  return (
    <group>
      <mesh ref={faceCore} position={[0, -0.08, 0.08]}>
        <sphereGeometry args={[0.21, 48, 32]} />
        <meshBasicMaterial color="#ffad32" transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.08, 0.1]}>
        <sphereGeometry args={[0.075, 32, 20]} />
        <meshBasicMaterial color="#ffd06d" transparent opacity={0.72} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={chestCore} position={[0, -1.34, 0.12]}>
        <sphereGeometry args={[0.11, 36, 24]} />
        <meshBasicMaterial color="#ffad32" transparent opacity={0.74} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={ring} position={[0, -1.34, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.24, 0.007, 10, 96]} />
        <meshBasicMaterial color="#ffb43d" transparent opacity={0.42} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SignalHalo({ state }: { state: AgentState }) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    root.current.rotation.z = Math.sin(t * 0.15) * 0.045;
    root.current.scale.setScalar(1 + (state === "thinking" ? 0.025 * Math.sin(t * 3) : 0));
  });

  return (
    <group ref={root} position={[0, -0.02, -0.4]}>
      {[0.98, 1.15, 1.36].map((radius, i) => (
        <mesh key={radius} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, i === 0 ? 0.008 : 0.004, 8, 160]} />
          <meshBasicMaterial
            color={i === 0 ? "#35eaff" : "#0d7690"}
            transparent
            opacity={state === "idle" ? 0.12 - i * 0.02 : 0.22 - i * 0.035}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Entity({ state }: { state: AgentState }) {
  const root = useRef<THREE.Group>(null);
  const smooth = useRef({ yaw: 0, pitch: 0, roll: 0, y: 0 });

  useFrame(({ clock, pointer }, dt) => {
    const t = clock.elapsedTime;
    const lerp = 1 - Math.exp(-dt * 5.8);
    let yaw = Math.sin(t * 0.25) * 0.016;
    let pitch = Math.sin(t * 0.31) * 0.006;
    let roll = Math.sin(t * 0.19) * 0.004;
    let y = Math.sin(t * 0.72) * 0.01;

    if (state === "listening") {
      yaw = pointer.x * 0.17;
      pitch = -pointer.y * 0.075;
      roll = pointer.x * -0.018;
    } else if (state === "thinking") {
      yaw = 0.075 + Math.sin(t * 0.48) * 0.035;
      pitch = -0.032;
      roll = 0.015;
    } else if (state === "speaking") {
      yaw = Math.sin(t * 0.55) * 0.034;
      pitch = Math.sin(t * 1.45) * 0.014;
      y += Math.sin(t * 3.1) * 0.004;
    } else if (state === "success") {
      pitch = -0.026;
      y += 0.018;
    } else if (state === "error") {
      yaw = -0.04;
      pitch = 0.035;
      roll = -0.018;
    }

    smooth.current.yaw = THREE.MathUtils.lerp(smooth.current.yaw, yaw, lerp);
    smooth.current.pitch = THREE.MathUtils.lerp(smooth.current.pitch, pitch, lerp);
    smooth.current.roll = THREE.MathUtils.lerp(smooth.current.roll, roll, lerp);
    smooth.current.y = THREE.MathUtils.lerp(smooth.current.y, y, lerp);

    if (root.current) {
      root.current.rotation.set(smooth.current.pitch, smooth.current.yaw, smooth.current.roll);
      root.current.position.y = smooth.current.y;
    }
  });

  return (
    <group ref={root} position={[0, 0.18, 0]}>
      <mesh scale={[0.72, 0.92, 0.58]} position={[0, 0.05, 0]}>
        <sphereGeometry args={[1, 64, 48]} />
        <meshBasicMaterial color="#02151d" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <HeadContours state={state} />
      <BustContours state={state} />
      <ParticleCrown state={state} />
      <FaceSignals state={state} />
      <EnergyCore state={state} />
      <SignalHalo state={state} />
    </group>
  );
}

function CameraRig() {
  const { camera, gl } = useThree();
  useEffect(() => {
    camera.position.set(0, -0.2, 5.3);
    camera.lookAt(0, -0.38, 0);
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.set(0, -0.35, 0);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4.5;
    controls.maxDistance = 6.5;
    controls.minPolarAngle = Math.PI * 0.39;
    controls.maxPolarAngle = Math.PI * 0.61;
    controls.minAzimuthAngle = -0.42;
    controls.maxAzimuthAngle = 0.42;
    const animate = () => {
      controls.update();
      frame = requestAnimationFrame(animate);
    };
    let frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      controls.dispose();
    };
  }, [camera, gl]);
  return null;
}

function Scene({ state }: { state: AgentState }) {
  return (
    <>
      <color attach="background" args={["#01070c"]} />
      <fog attach="fog" args={["#01070c", 4.6, 8.5]} />
      <ambientLight intensity={0.28} color="#75edff" />
      <pointLight position={[2.5, 1.8, 3]} intensity={1.5} color="#1edcf2" distance={8} />
      <pointLight position={[-2.3, -0.2, 2]} intensity={0.7} color="#074d68" distance={7} />
      <pointLight position={[0, -0.9, 2.2]} intensity={state === "speaking" ? 1.8 : 1.1} color="#ff9d26" distance={4} />
      <Entity state={state} />
      <CameraRig />
    </>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="v8-metric">
      <span>{label}</span>
      <strong className={accent ? "accent" : ""}>{value}</strong>
    </div>
  );
}

export default function HumanoidLabV8() {
  const [state, setState] = useState<AgentState>("idle");
  const [demo, setDemo] = useState(true);
  const [voice, setVoice] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("ASTRA entity online. Awaiting operator input.");
  const [activeAgent, setActiveAgent] = useState("CHIEF");
  const [clock, setClock] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!demo) return;
    let index = 0;
    setState(STATE_SEQUENCE[0]);
    const id = window.setInterval(() => {
      index = (index + 1) % STATE_SEQUENCE.length;
      setState(STATE_SEQUENCE[index]);
    }, 3600);
    return () => window.clearInterval(id);
  }, [demo]);

  const speak = (text: string) => {
    if (!voice || typeof window === "undefined" || !("speechSynthesis" in window)) {
      window.setTimeout(() => setState("idle"), 2400);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID";
    utterance.rate = 0.96;
    utterance.pitch = 0.92;
    utterance.onstart = () => setState("speaking");
    utterance.onend = () => setState("idle");
    utterance.onerror = () => setState("idle");
    window.speechSynthesis.speak(utterance);
  };

  const runPrompt = async () => {
    const message = prompt.trim();
    if (!message || busy) return;
    setDemo(false);
    setBusy(true);
    setState("thinking");
    setResponse("Processing operator request...");
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json() as { message?: string; agentName?: string; agent?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Agent request failed");
      const text = data.message || "Request acknowledged.";
      setActiveAgent((data.agentName || data.agent || "CHIEF").toString().toUpperCase());
      setResponse(text);
      setPrompt("");
      setState("speaking");
      speak(text);
    } catch (error) {
      setState("error");
      setResponse(error instanceof Error ? error.message : "Agent link failed.");
      window.setTimeout(() => setState("idle"), 2200);
    } finally {
      setBusy(false);
    }
  };

  const setManualState = (next: AgentState) => {
    setDemo(false);
    setState(next);
  };

  const testVoice = () => {
    setDemo(false);
    const text = "Halo. Saya ASTRA. Humanoid interface aktif dan siap menerima perintah.";
    setResponse(text);
    setState("speaking");
    speak(text);
  };

  const stateLabel = state.toUpperCase();
  const syncValue = state === "thinking" ? "97.8%" : state === "speaking" ? "99.2%" : "98.6%";
  const latency = state === "thinking" ? "18 ms" : state === "speaking" ? "11 ms" : "14 ms";

  return (
    <main className="v8-root">
      <div className="v8-scanlines" />
      <section className="v8-stage">
        <Canvas
          dpr={[1, 1.65]}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
          camera={{ position: [0, -0.2, 5.3], fov: 36 }}
        >
          <Scene state={state} />
        </Canvas>

        <header className="v8-brand">
          <div className="eyebrow">ASTRA // HUMAN INTERFACE</div>
          <h1>ENTITY <span>01</span></h1>
          <div className="subline"><i className={`dot ${state}`} /> {stateLabel} · LIVE RUNTIME</div>
        </header>

        <div className="v8-clock">
          <span>LOCAL NODE</span>
          <strong>{clock}</strong>
        </div>

        <div className={`v8-wave ${state === "speaking" ? "active" : ""}`} aria-hidden="true">
          {Array.from({ length: 26 }).map((_, i) => <b key={i} style={{ "--i": i } as CSSProperties} />)}
        </div>

        <div className="v8-controls">
          <button className={demo ? "active" : ""} onClick={() => setDemo((v) => !v)}>{demo ? "AUTO DEMO ON" : "AUTO DEMO OFF"}</button>
          {(["idle", "listening", "thinking", "speaking"] as AgentState[]).map((item) => (
            <button key={item} className={!demo && state === item ? "active" : ""} onClick={() => setManualState(item)}>{item.toUpperCase()}</button>
          ))}
          <button className="orange" onClick={testVoice}>TEST VOICE</button>
        </div>
      </section>

      <aside className="v8-hud">
        <a className="back" href="/">← ASTRA CORE</a>

        <div className="hud-title">
          <span>ENTITY TELEMETRY</span>
          <h2>ASTRA-01</h2>
          <p>Interactive humanoid endpoint</p>
        </div>

        <div className="state-card">
          <div>
            <small>CURRENT STATE</small>
            <strong>{stateLabel}</strong>
          </div>
          <div className={`state-orb ${state}`} />
        </div>

        <div className="metrics">
          <Metric label="NEURAL SYNC" value={syncValue} accent />
          <Metric label="ACTIVE AGENT" value={activeAgent} />
          <Metric label="RESPONSE LATENCY" value={latency} />
          <Metric label="VOICE LINK" value={voice ? "ONLINE" : "MUTED"} accent={voice} />
          <Metric label="VISUAL CORE" value="STABLE" />
        </div>

        <div className="meter-block">
          <div className="meter-label"><span>ENTITY COHERENCE</span><b>94%</b></div>
          <div className="meter"><i /></div>
          <div className="meter-label"><span>CONTEXT LINK</span><b>87%</b></div>
          <div className="meter second"><i /></div>
        </div>

        <div className="response-box">
          <span>ASTRA RESPONSE</span>
          <p>{response}</p>
        </div>

        <div className="command-box">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void runPrompt();
              }
            }}
            placeholder="Ketik perintah untuk ASTRA..."
            rows={3}
          />
          <div className="command-actions">
            <button className={voice ? "active" : ""} onClick={() => setVoice((v) => !v)}>VOICE {voice ? "ON" : "OFF"}</button>
            <button className="send" onClick={() => void runPrompt()} disabled={busy || !prompt.trim()}>{busy ? "..." : "EXECUTE"}</button>
          </div>
        </div>

        <footer>
          <span>CORE V8</span><span>WEBGL ACTIVE</span><span>LOCAL SESSION</span>
        </footer>
      </aside>

      <style>{`
        :root { color-scheme: dark; }
        .v8-root { width:100%; height:100%; min-height:620px; display:grid; grid-template-columns:minmax(0,1fr) 360px; background:#01070c; color:#d9faff; font-family:Inter,ui-sans-serif,system-ui,sans-serif; overflow:hidden; position:relative; }
        .v8-stage { position:relative; min-width:0; height:100%; overflow:hidden; background:radial-gradient(circle at 50% 43%,rgba(8,72,86,.2),transparent 31%),linear-gradient(180deg,#020b12 0%,#01070c 72%); }
        .v8-stage:before { content:""; position:absolute; inset:0; z-index:1; pointer-events:none; background:linear-gradient(90deg,rgba(26,219,243,.04) 1px,transparent 1px),linear-gradient(rgba(26,219,243,.035) 1px,transparent 1px); background-size:72px 72px; mask-image:radial-gradient(circle at 50% 50%,black,transparent 73%); }
        .v8-stage canvas { position:absolute!important; inset:0; width:100%!important; height:100%!important; z-index:0; }
        .v8-scanlines { position:fixed; inset:0; pointer-events:none; z-index:20; opacity:.16; background:repeating-linear-gradient(0deg,rgba(255,255,255,.018) 0,rgba(255,255,255,.018) 1px,transparent 1px,transparent 4px); mix-blend-mode:screen; }
        .v8-brand { position:absolute; top:28px; left:32px; z-index:4; pointer-events:none; }
        .v8-brand .eyebrow,.v8-clock span,.hud-title span,.response-box span { font:600 10px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace; letter-spacing:.25em; color:#58dff0; }
        .v8-brand h1 { margin:8px 0 5px; font-size:31px; line-height:1; font-weight:300; letter-spacing:.08em; color:#e6fbff; }
        .v8-brand h1 span { color:#ffb13a; }
        .subline { font:500 10px ui-monospace,monospace; letter-spacing:.14em; color:#6e95a0; display:flex; gap:8px; align-items:center; }
        .dot { width:6px; height:6px; border-radius:50%; background:#4b7280; box-shadow:0 0 10px currentColor; display:inline-block; }
        .dot.listening,.dot.thinking,.dot.speaking,.dot.success { background:#39e9ff; color:#39e9ff; }.dot.error{background:#ff8559;color:#ff8559}.dot.thinking{background:#ffb13a;color:#ffb13a}
        .v8-clock { position:absolute; right:28px; top:28px; z-index:4; text-align:right; display:flex; flex-direction:column; gap:4px; }
        .v8-clock strong { font:300 22px ui-monospace,monospace; letter-spacing:.08em; color:#bfeef4; }
        .v8-wave { position:absolute; z-index:4; left:50%; bottom:94px; transform:translateX(-50%); height:38px; display:flex; align-items:center; gap:3px; opacity:.25; }
        .v8-wave b { width:2px; height:5px; background:#28dff2; box-shadow:0 0 8px #28dff2; border-radius:4px; }
        .v8-wave.active { opacity:.78; }.v8-wave.active b { animation:v8wave .72s ease-in-out infinite alternate; animation-delay:calc(var(--i) * -35ms); }
        @keyframes v8wave { from{height:4px;opacity:.35} to{height:calc(8px + (var(--i) % 7) * 3px);opacity:1} }
        .v8-controls { position:absolute; z-index:5; left:50%; transform:translateX(-50%); bottom:32px; display:flex; align-items:center; gap:7px; padding:7px; border:1px solid rgba(59,214,235,.18); background:rgba(1,11,17,.72); backdrop-filter:blur(12px); border-radius:6px; }
        .v8-controls button,.command-actions button { appearance:none; border:1px solid rgba(62,209,228,.22); background:#031018; color:#6f9da6; height:32px; padding:0 12px; border-radius:3px; font:600 9px ui-monospace,monospace; letter-spacing:.11em; cursor:pointer; transition:.2s ease; }
        .v8-controls button:hover,.command-actions button:hover { border-color:#39dff2;color:#d9fbff; }.v8-controls button.active,.command-actions button.active { color:#67eeff;border-color:#28cfe3;background:rgba(13,155,176,.11);box-shadow:inset 0 0 18px rgba(35,221,244,.05); }.v8-controls button.orange { color:#ffc05f;border-color:rgba(255,175,52,.4); }
        .v8-hud { height:100%; box-sizing:border-box; border-left:1px solid rgba(52,206,226,.14); background:linear-gradient(180deg,rgba(3,15,22,.98),rgba(1,9,14,.98)); padding:26px 25px 18px; display:flex; flex-direction:column; gap:18px; position:relative; z-index:6; box-shadow:-28px 0 80px rgba(0,0,0,.24); overflow:auto; }
        .back { color:#4eb6c3;text-decoration:none;font:600 9px ui-monospace,monospace;letter-spacing:.2em; }.back:hover{color:#7aeeff}
        .hud-title { border-bottom:1px solid rgba(58,190,208,.15); padding:4px 0 17px; }.hud-title h2{margin:8px 0 2px;font-size:25px;font-weight:300;letter-spacing:.06em}.hud-title p{margin:0;color:#58757e;font:500 10px ui-monospace,monospace;}
        .state-card { display:flex; align-items:center; justify-content:space-between; border:1px solid rgba(54,202,222,.14); background:rgba(9,35,44,.22); padding:14px 15px; }.state-card small{display:block;color:#517b84;font:600 8px ui-monospace,monospace;letter-spacing:.18em;margin-bottom:5px}.state-card strong{font:500 17px ui-monospace,monospace;letter-spacing:.12em;color:#cff8ff}.state-orb{width:12px;height:12px;border-radius:50%;background:#607b82;box-shadow:0 0 14px #607b82}.state-orb.listening,.state-orb.speaking,.state-orb.success{background:#3ceaff;box-shadow:0 0 22px #3ceaff}.state-orb.thinking{background:#ffaf35;box-shadow:0 0 22px #ffaf35}.state-orb.error{background:#ff7656;box-shadow:0 0 22px #ff7656}
        .metrics { border-top:1px solid rgba(54,202,222,.12); border-bottom:1px solid rgba(54,202,222,.12); }.v8-metric{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid rgba(54,202,222,.07);font:600 9px ui-monospace,monospace;letter-spacing:.09em}.v8-metric:last-child{border-bottom:0}.v8-metric span{color:#557a83}.v8-metric strong{font-weight:600;color:#b1dce4}.v8-metric strong.accent{color:#57ebfb}
        .meter-block{display:flex;flex-direction:column;gap:7px}.meter-label{display:flex;justify-content:space-between;font:600 8px ui-monospace,monospace;letter-spacing:.12em;color:#557a83}.meter-label b{color:#8cdbe6}.meter{height:3px;background:#08232d;overflow:hidden}.meter i{display:block;width:94%;height:100%;background:linear-gradient(90deg,#0c8398,#47edff);box-shadow:0 0 9px #28dff2}.meter.second i{width:87%;}
        .response-box { min-height:92px; border:1px solid rgba(54,202,222,.13); background:rgba(2,13,19,.66); padding:13px; }.response-box p{margin:9px 0 0;color:#9fc4cb;font:400 11px/1.55 ui-monospace,monospace;max-height:86px;overflow:auto;}
        .command-box { margin-top:auto; border-top:1px solid rgba(54,202,222,.14); padding-top:15px; }.command-box textarea{width:100%;box-sizing:border-box;resize:none;outline:none;border:1px solid rgba(59,211,231,.2);border-radius:4px;background:#020b11;color:#d1f7fd;padding:11px 12px;font:400 11px/1.5 ui-monospace,monospace;}.command-box textarea:focus{border-color:#27cadd;box-shadow:0 0 0 2px rgba(39,202,221,.05)}.command-actions{display:flex;justify-content:space-between;gap:8px;margin-top:8px}.command-actions .send{margin-left:auto;color:#ffc05f;border-color:rgba(255,175,52,.35)}.command-actions button:disabled{opacity:.35;cursor:not-allowed}
        .v8-hud footer{display:flex;justify-content:space-between;color:#355861;font:600 7px ui-monospace,monospace;letter-spacing:.1em;padding-top:4px}
        @media(max-width:980px){.v8-root{grid-template-columns:1fr}.v8-hud{position:absolute;right:12px;top:12px;bottom:12px;width:320px;height:auto;border:1px solid rgba(52,206,226,.16);border-radius:8px;background:rgba(1,10,15,.92)}.v8-brand{left:18px;top:18px}.v8-clock{display:none}.v8-controls{left:18px;transform:none;max-width:calc(100% - 362px);overflow:auto}.v8-stage:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 58%,rgba(1,7,12,.45));pointer-events:none}}
        @media(max-width:700px){.v8-hud{left:10px;right:10px;top:auto;bottom:10px;width:auto;height:41vh}.v8-stage{height:59vh}.v8-root{display:block;overflow:auto}.v8-controls{bottom:42vh;left:10px;right:10px;transform:none;max-width:none;overflow-x:auto}.v8-brand h1{font-size:24px}.v8-brand{top:14px}.metrics,.meter-block{display:none}}
      `}</style>
    </main>
  );
}
