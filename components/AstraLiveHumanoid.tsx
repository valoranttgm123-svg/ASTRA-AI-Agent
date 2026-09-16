"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { AstraAvatarState } from "@/lib/avatar/types";

type Props = {
  state: AstraAvatarState;
  speechLevel?: number;
};

function damp(current: number, target: number, speed: number, dt: number) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * dt));
}

function LiveRig({ state, speechLevel = 0 }: Props) {
  const root = useRef<THREE.Group>(null);
  const shoulders = useRef<THREE.Group>(null);
  const neck = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const leftEye = useRef<THREE.Mesh>(null);
  const rightEye = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Group>(null);

  const particles = useMemo(() => {
    const data: number[] = [];
    let seed = 94321;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 760; i += 1) {
      const a = rand() * Math.PI * 2;
      const u = rand() * 2 - 1;
      const shell = 1.02 + rand() * 0.38;
      const s = Math.sqrt(Math.max(0, 1 - u * u));
      data.push(
        Math.cos(a) * s * 0.92 * shell,
        2.22 + u * 1.08 * shell,
        Math.sin(a) * s * 0.76 * shell,
      );
    }
    return new Float32Array(data);
  }, []);

  useFrame(({ clock, pointer }, dt) => {
    const t = clock.elapsedTime;
    const isListening = state === "listening";
    const isThinking = state === "thinking";
    const isSpeaking = state === "speaking";
    const isExecuting = state === "executing";
    const isSuccess = state === "success";
    const isError = state === "error";

    let yawTarget = pointer.x * 0.16;
    let pitchTarget = -pointer.y * 0.07;
    let rollTarget = 0;

    if (isListening) {
      yawTarget = pointer.x * 0.22;
      pitchTarget = -0.035 - pointer.y * 0.05 + Math.sin(t * 1.45) * 0.012;
    } else if (isThinking) {
      yawTarget = 0.14 + Math.sin(t * 0.7) * 0.12;
      pitchTarget = -0.055 + Math.sin(t * 0.9) * 0.022;
    } else if (isSpeaking) {
      yawTarget = pointer.x * 0.09 + Math.sin(t * 0.62) * 0.055;
      pitchTarget = Math.sin(t * 1.25) * 0.026;
    } else if (isExecuting) {
      yawTarget = -0.12 + Math.sin(t * 0.42) * 0.04;
      pitchTarget = -0.035;
    } else if (isSuccess) {
      yawTarget = 0;
      pitchTarget = Math.sin(t * 3.2) * 0.055 - 0.02;
    } else if (isError) {
      yawTarget = -0.08;
      pitchTarget = 0.035;
      rollTarget = -0.055;
    }

    if (head.current) {
      head.current.rotation.y = damp(head.current.rotation.y, yawTarget, 5.5, dt);
      head.current.rotation.x = damp(head.current.rotation.x, pitchTarget, 5.5, dt);
      head.current.rotation.z = damp(head.current.rotation.z, rollTarget, 4.5, dt);
    }

    const breath = Math.sin(t * 1.45) * 0.018;
    if (shoulders.current) {
      shoulders.current.position.y = damp(shoulders.current.position.y, -0.64 + breath, 3.2, dt);
      const sx = 1 + breath * 0.12;
      shoulders.current.scale.x = damp(shoulders.current.scale.x, sx, 3.2, dt);
    }

    if (neck.current) {
      neck.current.rotation.y = head.current ? head.current.rotation.y * 0.26 : 0;
      neck.current.rotation.x = head.current ? head.current.rotation.x * 0.18 : 0;
    }

    const speechWave = isSpeaking
      ? Math.max(
          speechLevel,
          0.18 + Math.abs(Math.sin(t * 10.7)) * 0.48 + Math.abs(Math.sin(t * 6.1)) * 0.16,
        )
      : 0;
    if (jaw.current) {
      jaw.current.rotation.x = damp(jaw.current.rotation.x, speechWave * 0.24, 14, dt);
      jaw.current.position.y = damp(jaw.current.position.y, -0.47 - speechWave * 0.055, 14, dt);
    }

    const blinkCycle = t % 4.8;
    const blink = blinkCycle > 4.55 ? Math.max(0.06, Math.abs(Math.sin((blinkCycle - 4.55) * Math.PI * 8))) : 1;
    const eyeScaleY = blinkCycle > 4.55 ? 1 - blink * 0.92 : 1;
    if (leftEye.current) leftEye.current.scale.y = damp(leftEye.current.scale.y, eyeScaleY, 24, dt);
    if (rightEye.current) rightEye.current.scale.y = damp(rightEye.current.scale.y, eyeScaleY, 24, dt);

    if (root.current) {
      const lean = isListening ? 0.045 : isThinking ? 0.015 : isSpeaking ? 0.025 : 0;
      root.current.position.z = damp(root.current.position.z, lean, 3.5, dt);
      root.current.position.y = Math.sin(t * 0.68) * 0.014;
    }

    if (halo.current) {
      halo.current.rotation.z += dt * (isThinking ? 0.24 : isSpeaking ? 0.16 : 0.07);
      halo.current.rotation.y = Math.sin(t * 0.22) * 0.12;
    }
  });

  const active = state !== "idle";
  const speaking = state === "speaking";
  const thinking = state === "thinking";
  const energy = speaking ? "#ffae38" : thinking ? "#d9fdff" : "#17edff";

  return (
    <group ref={root} position={[0, -0.12, 0]} scale={[1.12, 1.12, 1.12]}>
      <group ref={shoulders} position={[0, -0.64, 0]}>
        <mesh scale={[2.15, 0.72, 0.72]}>
          <sphereGeometry args={[1, 72, 48]} />
          <meshStandardMaterial
            color="#0a5260"
            emissive={energy}
            emissiveIntensity={active ? 1.55 : 1.08}
            transparent
            opacity={0.56}
            roughness={0.32}
            metalness={0.08}
            depthWrite={false}
          />
        </mesh>
        <mesh scale={[2.18, 0.74, 0.74]}>
          <sphereGeometry args={[1, 40, 28]} />
          <meshBasicMaterial color={energy} wireframe transparent opacity={0.24} depthWrite={false} />
        </mesh>
      </group>

      <group ref={neck} position={[0, 0.25, 0]}>
        <mesh scale={[0.5, 0.92, 0.48]}>
          <cylinderGeometry args={[0.58, 0.66, 1.25, 48, 8, true]} />
          <meshStandardMaterial
            color="#0b4a56"
            emissive={energy}
            emissiveIntensity={1.25}
            transparent
            opacity={0.52}
            depthWrite={false}
          />
        </mesh>
      </group>

      <group ref={head} position={[0, 1.72, 0]}>
        <mesh scale={[0.9, 1.12, 0.78]}>
          <sphereGeometry args={[1, 96, 64]} />
          <meshStandardMaterial
            color="#0a414c"
            emissive={energy}
            emissiveIntensity={active ? 1.85 : 1.28}
            transparent
            opacity={0.62}
            roughness={0.26}
            metalness={0.06}
            depthWrite={false}
          />
        </mesh>
        <mesh scale={[0.908, 1.13, 0.79]}>
          <sphereGeometry args={[1, 52, 38]} />
          <meshBasicMaterial color={energy} wireframe transparent opacity={active ? 0.34 : 0.27} depthWrite={false} />
        </mesh>

        <mesh ref={leftEye} position={[-0.31, 0.12, 0.72]} scale={[0.2, 0.038, 0.038]}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshBasicMaterial color="#e0ffff" transparent opacity={active ? 1 : 0.86} depthWrite={false} />
        </mesh>
        <mesh ref={rightEye} position={[0.31, 0.12, 0.72]} scale={[0.2, 0.038, 0.038]}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshBasicMaterial color="#e0ffff" transparent opacity={active ? 1 : 0.86} depthWrite={false} />
        </mesh>

        <group ref={jaw} position={[0, -0.47, 0.04]}>
          <mesh scale={[0.61, 0.36, 0.6]}>
            <sphereGeometry args={[1, 48, 32, 0, Math.PI * 2, Math.PI * 0.44, Math.PI * 0.56]} />
            <meshStandardMaterial
              color="#0b4652"
              emissive={speaking ? "#ff9d2e" : energy}
              emissiveIntensity={speaking ? 2.1 : 1.1}
              transparent
              opacity={0.54}
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>

      <points position={[0, 0, -0.03]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particles, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.024}
          color={energy}
          transparent
          opacity={active ? 0.88 : 0.64}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>

      <group ref={halo} position={[0, 1.75, -0.55]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.45, 0.015, 8, 110]} />
          <meshBasicMaterial color="#17edff" transparent opacity={0.38} depthWrite={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2.4, 0.2, 0.15]}>
          <torusGeometry args={[1.72, 0.011, 8, 110]} />
          <meshBasicMaterial color={speaking ? "#ffae38" : "#17edff"} transparent opacity={0.24} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

export default function AstraLiveHumanoid({ state, speechLevel = 0 }: Props) {
  return (
    <Canvas
      camera={{ position: [0, 1.08, 5.55], fov: 42, near: 0.1, far: 30 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <ambientLight intensity={0.62} />
      <pointLight position={[0, 3.5, 3.8]} intensity={4.2} color="#9afaff" />
      <pointLight position={[-2.8, 1.3, 2.2]} intensity={1.7} color="#16eaff" />
      <pointLight position={[2.8, 0.8, 2.4]} intensity={1.45} color="#ff9f31" />
      <LiveRig state={state} speechLevel={speechLevel} />
    </Canvas>
  );
}
