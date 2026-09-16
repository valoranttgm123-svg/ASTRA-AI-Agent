"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbState } from "./ApexHeroOrb";

const CYAN = new THREE.Color("#19e6ff");
const ICE = new THREE.Color("#d7fcff");
const GOLD = new THREE.Color("#ffad38");

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addLoop(out: number[], y: number, rx: number, rz: number, segments = 88) {
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const wave0 = Math.sin(a0 * 3 + y * 2.4) * 0.018;
    const wave1 = Math.sin(a1 * 3 + y * 2.4) * 0.018;
    out.push(
      Math.cos(a0) * rx,
      y + wave0,
      Math.sin(a0) * rz,
      Math.cos(a1) * rx,
      y + wave1,
      Math.sin(a1) * rz,
    );
  }
}

function makeBustGeometry() {
  const positions: number[] = [];

  const headLines = 68;
  for (let i = 0; i < headLines; i += 1) {
    const t = i / (headLines - 1);
    const y = 1.35 + t * 2.95;
    const n = (t - 0.5) * 2;
    const profile = Math.sqrt(Math.max(0.02, 1 - n * n));
    const jaw = t < 0.34 ? 0.62 + t * 1.12 : 1;
    const crown = t > 0.87 ? 1 - (t - 0.87) * 2.5 : 1;
    const rx = 1.02 * profile * jaw * crown;
    const rz = 0.58 * profile * (0.92 + Math.sin(t * Math.PI) * 0.08);
    addLoop(positions, y, rx, rz, 88);
  }

  const neckLines = 24;
  for (let i = 0; i < neckLines; i += 1) {
    const t = i / (neckLines - 1);
    const y = 0.15 + t * 1.25;
    const rx = 0.57 + t * 0.16;
    const rz = 0.34 + t * 0.07;
    addLoop(positions, y, rx, rz, 64);
  }

  const shoulderLines = 34;
  for (let i = 0; i < shoulderLines; i += 1) {
    const t = i / (shoulderLines - 1);
    const y = -1.25 + t * 1.48;
    const width = 3.25 - t * 2.55;
    const segments = 96;
    for (let s = 0; s < segments; s += 1) {
      const u0 = s / segments;
      const u1 = (s + 1) / segments;
      const x0 = (u0 * 2 - 1) * width;
      const x1 = (u1 * 2 - 1) * width;
      const curve0 = 0.18 + Math.pow(Math.abs(x0) / width, 1.55) * 0.72;
      const curve1 = 0.18 + Math.pow(Math.abs(x1) / width, 1.55) * 0.72;
      const z0 = -0.28 + (1 - Math.pow(x0 / width, 2)) * 0.46;
      const z1 = -0.28 + (1 - Math.pow(x1 / width, 2)) * 0.46;
      positions.push(x0, y - curve0, z0, x1, y - curve1, z1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function makeParticleGeometry() {
  const random = mulberry32(16092026);
  const points: number[] = [];
  for (let i = 0; i < 1150; i += 1) {
    const a = random() * Math.PI * 2;
    const v = random() * 2 - 1;
    const shell = 1.1 + random() * 0.58;
    const s = Math.sqrt(Math.max(0, 1 - v * v));
    const x = Math.cos(a) * s * 1.08 * shell;
    const y = 2.88 + v * 1.58 * shell;
    const z = Math.sin(a) * s * 0.62 * shell;
    if (y > 0.9) points.push(x, y, z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

function makeWaveGeometry() {
  const p: number[] = [];
  for (const side of [-1, 1]) {
    for (let line = 0; line < 28; line += 1) {
      const phase = line * 0.37;
      const baseY = -0.25 + line * 0.035;
      for (let i = 0; i < 60; i += 1) {
        const t0 = i / 60;
        const t1 = (i + 1) / 60;
        const x0 = side * (0.7 + t0 * 4.0);
        const x1 = side * (0.7 + t1 * 4.0);
        const amp0 = 0.24 + t0 * 0.62;
        const amp1 = 0.24 + t1 * 0.62;
        const y0 = baseY + Math.sin(t0 * 10 + phase) * amp0;
        const y1 = baseY + Math.sin(t1 * 10 + phase) * amp1;
        p.push(x0, y0, -0.72, x1, y1, -0.72);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  return geometry;
}

function makeGlowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,245,205,1)");
  g.addColorStop(0.2, "rgba(255,183,64,.95)");
  g.addColorStop(0.52, "rgba(255,112,20,.38)");
  g.addColorStop(1, "rgba(255,80,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function AstraBust({ state }: { state: OrbState }) {
  const group = useRef<THREE.Group>(null);
  const lineMaterial = useRef<THREE.LineBasicMaterial>(null);
  const particleMaterial = useRef<THREE.PointsMaterial>(null);
  const waveMaterial = useRef<THREE.LineBasicMaterial>(null);
  const glow = useRef<THREE.Sprite>(null);
  const neckGlow = useRef<THREE.Sprite>(null);

  const bustGeometry = useMemo(makeBustGeometry, []);
  const particleGeometry = useMemo(makeParticleGeometry, []);
  const waveGeometry = useMemo(makeWaveGeometry, []);
  const glowTexture = useMemo(makeGlowTexture, []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const thinking = state === "thinking";
    const speaking = state === "speaking";
    const energy = speaking ? 1 : thinking ? 0.78 : 0.48;

    if (group.current) {
      group.current.position.y = 0.04 + Math.sin(t * 0.7) * 0.025;
      group.current.rotation.y = Math.sin(t * 0.18) * 0.045;
      const breath = 1 + Math.sin(t * 1.05) * 0.006;
      group.current.scale.setScalar(breath);
    }

    if (lineMaterial.current) {
      lineMaterial.current.opacity = 0.36 + energy * 0.34;
      lineMaterial.current.color.lerp(thinking ? ICE : CYAN, Math.min(1, dt * 3.5));
    }
    if (particleMaterial.current) {
      particleMaterial.current.opacity = 0.2 + energy * 0.33;
      particleMaterial.current.size = speaking ? 0.035 : thinking ? 0.031 : 0.025;
      particleMaterial.current.color.lerp(thinking ? ICE : CYAN, Math.min(1, dt * 3.5));
    }
    if (waveMaterial.current) {
      waveMaterial.current.opacity = 0.08 + energy * 0.12;
    }
    if (glow.current) {
      const pulse = 1 + Math.sin(t * (speaking ? 4.8 : thinking ? 3.0 : 1.5)) * (speaking ? 0.1 : 0.05);
      glow.current.scale.set(2.15 * pulse, 1.72 * pulse, 1);
      const material = glow.current.material as THREE.SpriteMaterial;
      material.opacity = 0.42 + energy * 0.25;
    }
    if (neckGlow.current) {
      const pulse = 1 + Math.sin(t * 2.2) * 0.06;
      neckGlow.current.scale.set(0.75 * pulse, 2.25 * pulse, 1);
      const material = neckGlow.current.material as THREE.SpriteMaterial;
      material.opacity = 0.16 + energy * 0.18;
    }
  });

  return (
    <group ref={group}>
      <lineSegments geometry={waveGeometry}>
        <lineBasicMaterial ref={waveMaterial} color="#18dfff" transparent opacity={0.13} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>

      <lineSegments geometry={bustGeometry}>
        <lineBasicMaterial ref={lineMaterial} color="#19e6ff" transparent opacity={0.58} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>

      <points geometry={particleGeometry}>
        <pointsMaterial ref={particleMaterial} size={0.027} color="#19e6ff" transparent opacity={0.38} depthWrite={false} sizeAttenuation blending={THREE.AdditiveBlending} />
      </points>

      {glowTexture && (
        <>
          <sprite ref={glow} position={[0, 2.55, 0.72]} scale={[2.15, 1.72, 1]}>
            <spriteMaterial map={glowTexture} color={GOLD} transparent opacity={0.58} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
          <sprite ref={neckGlow} position={[0, 0.45, 0.28]} scale={[0.75, 2.25, 1]}>
            <spriteMaterial map={glowTexture} color={GOLD} transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </>
      )}
    </group>
  );
}

export default function AstraHumanoid3D({ state = "idle" }: { state?: OrbState }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <Canvas
      camera={{ position: [0, 1.25, 8.1], fov: 43, near: 0.1, far: 30 }}
      dpr={1}
      gl={{ alpha: true, antialias: false, powerPreference: "default" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        const canvas = gl.domElement;
        canvas.addEventListener(
          "webglcontextlost",
          (event) => {
            event.preventDefault();
            console.warn("[ASTRA] Bust WebGL context lost; keeping SVG reference fallback visible.");
            setFailed(true);
          },
          { once: true },
        );
      }}
      style={{ width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <AstraBust state={state} />
    </Canvas>
  );
}
