"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbState } from "./ApexHeroOrb";

const CYAN = new THREE.Color("#00e5ff");
const ICE = new THREE.Color("#d8fbff");
const GOLD = new THREE.Color("#f5a623");

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addEllipsoid(
  out: number[],
  random: () => number,
  count: number,
  center: [number, number, number],
  radius: [number, number, number],
) {
  for (let i = 0; i < count; i += 1) {
    const u = random() * 2 - 1;
    const a = random() * Math.PI * 2;
    const shell = 0.72 + random() * 0.28;
    const s = Math.sqrt(1 - u * u);
    out.push(
      center[0] + Math.cos(a) * s * radius[0] * shell,
      center[1] + u * radius[1] * shell,
      center[2] + Math.sin(a) * s * radius[2] * shell,
    );
  }
}

function addLimb(
  out: number[],
  random: () => number,
  count: number,
  a: [number, number, number],
  b: [number, number, number],
  radius: number,
) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const axis = end.clone().sub(start).normalize();
  const helper = Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const side = new THREE.Vector3().crossVectors(axis, helper).normalize();
  const up = new THREE.Vector3().crossVectors(side, axis).normalize();

  for (let i = 0; i < count; i += 1) {
    const t = random();
    const angle = random() * Math.PI * 2;
    const r = radius * (0.35 + random() * 0.65);
    const p = start.clone().lerp(end, t)
      .addScaledVector(side, Math.cos(angle) * r)
      .addScaledVector(up, Math.sin(angle) * r);
    out.push(p.x, p.y, p.z);
  }
}

function makeHumanoidPoints() {
  const random = mulberry32(26092026);
  const p: number[] = [];

  addEllipsoid(p, random, 300, [0, 2.35, 0], [0.58, 0.72, 0.48]);
  addLimb(p, random, 70, [0, 1.7, 0], [0, 1.45, 0], 0.22);
  addEllipsoid(p, random, 560, [0, 0.65, 0], [1.02, 1.35, 0.43]);
  addEllipsoid(p, random, 220, [0, -0.62, 0], [0.83, 0.5, 0.42]);

  addLimb(p, random, 190, [-0.82, 1.15, 0], [-1.55, 0.15, 0.02], 0.22);
  addLimb(p, random, 170, [-1.55, 0.15, 0.02], [-1.72, -0.9, 0.08], 0.18);
  addLimb(p, random, 190, [0.82, 1.15, 0], [1.55, 0.15, 0.02], 0.22);
  addLimb(p, random, 170, [1.55, 0.15, 0.02], [1.72, -0.9, 0.08], 0.18);

  addLimb(p, random, 250, [-0.48, -0.78, 0], [-0.58, -2.0, 0.03], 0.27);
  addLimb(p, random, 230, [-0.58, -2.0, 0.03], [-0.62, -3.05, 0.12], 0.22);
  addLimb(p, random, 250, [0.48, -0.78, 0], [0.58, -2.0, 0.03], 0.27);
  addLimb(p, random, 230, [0.58, -2.0, 0.03], [0.62, -3.05, 0.12], 0.22);

  return new Float32Array(p);
}

function makeSkeletonGeometry() {
  const segments: Array<[number, number, number]> = [
    [0, 2.9, 0], [0, 1.55, 0],
    [-0.95, 1.2, 0], [0.95, 1.2, 0],
    [-0.95, 1.2, 0], [-1.55, 0.15, 0],
    [-1.55, 0.15, 0], [-1.72, -0.9, 0],
    [0.95, 1.2, 0], [1.55, 0.15, 0],
    [1.55, 0.15, 0], [1.72, -0.9, 0],
    [0, 1.45, 0], [0, -0.72, 0],
    [-0.55, -0.7, 0], [0.55, -0.7, 0],
    [-0.55, -0.7, 0], [-0.58, -2.0, 0],
    [-0.58, -2.0, 0], [-0.62, -3.05, 0],
    [0.55, -0.7, 0], [0.58, -2.0, 0],
    [0.58, -2.0, 0], [0.62, -3.05, 0],
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(segments.flat(), 3));
  return geometry;
}

function Humanoid({ state }: { state: OrbState }) {
  const group = useRef<THREE.Group>(null);
  const pointsMaterial = useRef<THREE.PointsMaterial>(null);
  const lineMaterial = useRef<THREE.LineBasicMaterial>(null);
  const core = useRef<THREE.Mesh>(null);
  const scanA = useRef<THREE.Mesh>(null);
  const scanB = useRef<THREE.Mesh>(null);

  const positions = useMemo(makeHumanoidPoints, []);
  const skeleton = useMemo(makeSkeletonGeometry, []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const thinking = state === "thinking";
    const speaking = state === "speaking";
    const energy = speaking ? 1 : thinking ? 0.72 : 0.35;

    if (group.current) {
      group.current.position.y = -0.3 + Math.sin(t * 0.72) * 0.035;
      group.current.rotation.y = Math.sin(t * 0.21) * 0.09 + (thinking ? Math.sin(t * 1.8) * 0.025 : 0);
      const breath = 1 + Math.sin(t * 1.25) * 0.008;
      group.current.scale.set(breath, breath, breath);
    }

    if (pointsMaterial.current) {
      pointsMaterial.current.opacity = THREE.MathUtils.lerp(pointsMaterial.current.opacity, 0.34 + energy * 0.34, 0.08);
      pointsMaterial.current.size = THREE.MathUtils.lerp(pointsMaterial.current.size, speaking ? 0.046 : thinking ? 0.041 : 0.034, 0.08);
      const target = speaking ? GOLD : thinking ? ICE : CYAN;
      pointsMaterial.current.color.lerp(target, Math.min(1, dt * 4));
    }

    if (lineMaterial.current) {
      lineMaterial.current.opacity = 0.12 + energy * 0.22;
      lineMaterial.current.color.lerp(speaking ? GOLD : CYAN, Math.min(1, dt * 3));
    }

    if (core.current) {
      const pulse = 1 + Math.sin(t * (speaking ? 7 : thinking ? 4.3 : 1.8)) * (speaking ? 0.16 : 0.08);
      core.current.scale.setScalar(pulse);
      core.current.rotation.y += dt * (speaking ? 1.6 : thinking ? 0.9 : 0.35);
    }

    if (scanA.current) {
      scanA.current.position.y = -2.65 + ((t * (thinking ? 0.72 : 0.38)) % 5.5);
      scanA.current.rotation.z += dt * 0.12;
    }
    if (scanB.current) {
      scanB.current.position.y = 2.55 - ((t * (speaking ? 1.05 : 0.5)) % 5.5);
      scanB.current.rotation.z -= dt * 0.1;
    }
  });

  return (
    <group ref={group}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={pointsMaterial}
          size={0.034}
          color="#00e5ff"
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>

      <lineSegments geometry={skeleton}>
        <lineBasicMaterial
          ref={lineMaterial}
          color="#00e5ff"
          transparent
          opacity={0.24}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      <mesh position={[0, 0.62, 0.22]} ref={core}>
        <icosahedronGeometry args={[0.24, 1]} />
        <meshBasicMaterial color="#bff8ff" wireframe transparent opacity={0.72} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, 0.62, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.38, 0.018, 8, 64]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.48} blending={THREE.AdditiveBlending} />
      </mesh>

      <mesh ref={scanA} position={[0, -2.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.08, 0.008, 6, 64]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <mesh ref={scanB} position={[0, 2.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.82, 0.008, 6, 64]} />
        <meshBasicMaterial color="#f5a623" transparent opacity={0.15} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default function AstraHumanoid3D({ state = "idle" }: { state?: OrbState }) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <Canvas
      camera={{ position: [0, 0.05, 8.2], fov: 44, near: 0.1, far: 30 }}
      dpr={1}
      gl={{ alpha: true, antialias: false, powerPreference: "default" }}
      onCreated={({ gl }) => {
        const canvas = gl.domElement;
        canvas.addEventListener(
          "webglcontextlost",
          (event) => {
            event.preventDefault();
            console.warn("[ASTRA] Humanoid WebGL context lost; switching to persistent fallback.");
            setFailed(true);
          },
          { once: true },
        );
      }}
      style={{ width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <Humanoid state={state} />
    </Canvas>
  );
}
