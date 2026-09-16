"use client";

import { useEffect, useRef } from "react";
import type { OrbState } from "./ApexHeroOrb";

type Props = { state?: OrbState };
type Particle = { a: number; shell: number; size: number; alpha: number; phase: number; speed: number };

const TAU = Math.PI * 2;

function rng(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeHeadPath(cx: number, cy: number, s: number) {
  const p = new Path2D();
  const top = cy - s * 0.58;
  p.moveTo(cx, top);
  p.bezierCurveTo(cx - s * 0.20, top - s * 0.015, cx - s * 0.39, cy - s * 0.39, cx - s * 0.43, cy - s * 0.10);
  p.bezierCurveTo(cx - s * 0.47, cy + s * 0.18, cx - s * 0.34, cy + s * 0.43, cx - s * 0.15, cy + s * 0.56);
  p.bezierCurveTo(cx - s * 0.075, cy + s * 0.625, cx + s * 0.075, cy + s * 0.625, cx + s * 0.15, cy + s * 0.56);
  p.bezierCurveTo(cx + s * 0.34, cy + s * 0.43, cx + s * 0.47, cy + s * 0.18, cx + s * 0.43, cy - s * 0.10);
  p.bezierCurveTo(cx + s * 0.39, cy - s * 0.39, cx + s * 0.20, top - s * 0.015, cx, top);
  p.closePath();
  return p;
}

export default function AstraReferenceEntityV4({ state = "idle" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<OrbState>(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const random = rng(16092026);
    const particles: Particle[] = Array.from({ length: 1150 }, () => ({
      a: Math.PI + random() * Math.PI,
      shell: 1.02 + Math.pow(random(), 1.6) * 0.48,
      size: 0.35 + random() * 1.55,
      alpha: 0.18 + random() * 0.70,
      phase: random() * TAU,
      speed: 0.4 + random() * 1.2,
    }));

    let raf = 0;
    let w = 1;
    let h = 1;
    let dpr = 1;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const drawBackdrop = (cx: number, cy: number, s: number) => {
      const g = ctx.createRadialGradient(cx, cy, s * 0.08, cx, cy, s * 1.22);
      g.addColorStop(0, "rgba(2,8,15,.985)");
      g.addColorStop(0.44, "rgba(3,12,23,.94)");
      g.addColorStop(0.68, "rgba(4,19,32,.58)");
      g.addColorStop(1, "rgba(4,19,32,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - s * 1.45, cy - s * 1.12, s * 2.9, s * 2.55);
    };

    const drawEnergyMountains = (t: number, cx: number, cy: number, s: number, energy: number) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const baseY = cy + s * 0.46;
      for (const side of [-1, 1]) {
        for (let line = 0; line < 34; line += 1) {
          const q = line / 33;
          ctx.strokeStyle = `rgba(0,215,255,${0.035 + (line % 6 === 0 ? 0.07 : 0)})`;
          ctx.lineWidth = line % 7 === 0 ? 1.05 : 0.48;
          ctx.beginPath();
          for (let i = 0; i <= 78; i += 1) {
            const u = i / 78;
            const x = cx + side * (s * 0.58 + u * s * 1.35);
            const env = Math.pow(u, 0.7);
            const crest = Math.sin(u * 11.5 + line * 0.29 + t * 0.22) * (0.08 + env * 0.22);
            const fine = Math.sin(u * 29 - line * 0.13 - t * 0.15) * 0.038;
            const y = baseY - s * (0.06 + env * 0.30) + s * (crest + fine) + q * s * 0.16;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        for (let k = 0; k < 8; k += 1) {
          ctx.strokeStyle = `rgba(255,154,32,${0.05 + energy * 0.025})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          for (let i = 0; i <= 56; i += 1) {
            const u = i / 56;
            const x = cx + side * (s * (0.75 + k * 0.055) + u * s * 1.1);
            const y = baseY - s * (0.10 + u * 0.20) + Math.sin(u * 13 + k + t * 0.25) * s * (0.012 + u * 0.035);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    const drawBody = (t: number, cx: number, cy: number, s: number, energy: number) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const neckTop = cy + s * 0.49;
      const chestBottom = cy + s * 1.08;

      for (let i = 0; i < 46; i += 1) {
        const q = i / 45;
        const y = neckTop + q * (chestBottom - neckTop);
        const half = s * (0.15 + Math.pow(q, 1.35) * 1.03);
        ctx.strokeStyle = `rgba(19,225,255,${0.08 + (i % 7 === 0 ? 0.11 : 0)})`;
        ctx.lineWidth = i % 8 === 0 ? 1 : 0.52;
        ctx.beginPath();
        for (let j = 0; j <= 92; j += 1) {
          const u = j / 92;
          const xn = u * 2 - 1;
          const x = cx + xn * half;
          const arch = Math.pow(Math.abs(xn), 1.55) * s * (0.018 + q * 0.10);
          const yy = y + arch + Math.sin(xn * 13 + i * 0.31 + t * 0.18) * s * 0.0025;
          if (j === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }

      for (const side of [-1, 1]) {
        for (let i = 0; i < 13; i += 1) {
          ctx.strokeStyle = `rgba(255,165,38,${0.055 + energy * 0.035})`;
          ctx.lineWidth = i % 4 === 0 ? 1.0 : 0.48;
          ctx.beginPath();
          ctx.moveTo(cx + side * s * (0.02 + i * 0.006), neckTop);
          ctx.bezierCurveTo(
            cx + side * s * (0.06 + i * 0.012), cy + s * 0.62,
            cx + side * s * (0.17 + i * 0.018), cy + s * 0.86,
            cx + side * s * (0.08 + i * 0.016), chestBottom,
          );
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    const drawHead = (t: number, cx: number, cy: number, s: number, energy: number, speaking: boolean) => {
      const head = makeHeadPath(cx, cy, s);

      ctx.save();
      ctx.clip(head);
      ctx.globalCompositeOperation = "lighter";

      const glow = ctx.createRadialGradient(cx, cy + s * 0.08, 0, cx, cy + s * 0.08, s * 0.46);
      glow.addColorStop(0, speaking ? "rgba(255,245,178,.95)" : "rgba(255,191,59,.90)");
      glow.addColorStop(0.18, speaking ? "rgba(255,198,70,.86)" : "rgba(255,157,35,.66)");
      glow.addColorStop(0.46, "rgba(255,102,18,.28)");
      glow.addColorStop(0.78, "rgba(255,87,15,.08)");
      glow.addColorStop(1, "rgba(255,87,15,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - s * 0.6, cy - s * 0.62, s * 1.2, s * 1.25);

      const top = cy - s * 0.56;
      const bottom = cy + s * 0.58;
      const count = 82;
      for (let i = 0; i < count; i += 1) {
        const q = i / (count - 1);
        const y = top + q * (bottom - top);
        const vertical = (q - 0.5) * 2;
        const warm = Math.max(0, 1 - Math.abs(vertical - 0.12) * 1.55);
        const grad = ctx.createLinearGradient(cx - s * 0.48, y, cx + s * 0.48, y);
        grad.addColorStop(0, `rgba(20,226,255,${0.16 + (i % 7 === 0 ? 0.17 : 0)})`);
        grad.addColorStop(0.20, `rgba(20,226,255,${0.22 + energy * 0.04})`);
        grad.addColorStop(0.40, `rgba(255,152,32,${0.13 + warm * (0.25 + energy * 0.12)})`);
        grad.addColorStop(0.50, `rgba(255,202,74,${0.16 + warm * (0.34 + energy * 0.16)})`);
        grad.addColorStop(0.60, `rgba(255,152,32,${0.13 + warm * (0.25 + energy * 0.12)})`);
        grad.addColorStop(0.80, `rgba(20,226,255,${0.22 + energy * 0.04})`);
        grad.addColorStop(1, `rgba(20,226,255,${0.16 + (i % 7 === 0 ? 0.17 : 0)})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = i % 8 === 0 ? 1.25 : 0.62;
        ctx.beginPath();
        for (let j = 0; j <= 110; j += 1) {
          const u = j / 110;
          const x = cx - s * 0.50 + u * s;
          const xn = u * 2 - 1;
          const nose = Math.exp(-Math.pow(xn / 0.22, 2)) * s * 0.010 * warm;
          const ripple = Math.sin(xn * 9.5 + i * 0.21 + t * (0.22 + energy * 0.10)) * s * 0.0028;
          const micro = Math.sin(xn * 23 - i * 0.13) * s * 0.0011;
          const yy = y + nose + ripple + micro;
          if (j === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = "rgba(0,231,255,.95)";
      ctx.shadowBlur = s * 0.055;
      ctx.strokeStyle = "rgba(98,246,255,.97)";
      ctx.lineWidth = Math.max(1.6, s * 0.0065);
      ctx.stroke(head);
      ctx.shadowBlur = s * 0.018;
      ctx.lineWidth = Math.max(0.8, s * 0.0028);
      ctx.strokeStyle = "rgba(190,252,255,.78)";
      ctx.stroke(head);
      ctx.restore();
    };

    const drawParticles = (t: number, cx: number, cy: number, s: number, energy: number) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const p of particles) {
        const a = p.a + t * 0.008 * p.speed;
        const shell = p.shell + Math.sin(t * 0.55 + p.phase) * 0.018;
        const x = cx + Math.cos(a) * s * 0.46 * shell;
        const y = cy + Math.sin(a) * s * 0.61 * shell - s * 0.015;
        const flicker = 0.48 + 0.52 * Math.sin(t * (0.9 + p.speed) + p.phase);
        ctx.fillStyle = `rgba(0,225,255,${p.alpha * (0.35 + flicker * 0.42) * (0.88 + energy * 0.18)})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size * (0.75 + energy * 0.22), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawRings = (t: number, cx: number, cy: number, s: number, energy: number) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 7; i += 1) {
        const pulse = ((t * (0.035 + energy * 0.01) + i / 7) % 1);
        const r = s * (0.64 + pulse * 0.66);
        ctx.strokeStyle = `rgba(0,197,255,${(1 - pulse) * 0.10})`;
        ctx.lineWidth = 0.55;
        ctx.beginPath();
        ctx.arc(cx, cy - s * 0.08, r, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    };

    const frame = (ms: number) => {
      const t = ms / 1000;
      ctx.clearRect(0, 0, w, h);
      const mode = stateRef.current;
      const energy = mode === "speaking" ? 1 : mode === "thinking" ? 0.66 : 0.30;
      const speaking = mode === "speaking";
      const s = Math.min(h * 0.47, w * 0.30);
      const cx = w * 0.53;
      const cy = h * 0.40 + Math.sin(t * 0.55) * 1.6;

      drawBackdrop(cx, cy + s * 0.12, s);
      drawRings(t, cx, cy, s, energy);
      drawEnergyMountains(t, cx, cy, s, energy);
      drawBody(t, cx, cy, s, energy);
      drawHead(t, cx, cy, s, energy, speaking);
      drawParticles(t, cx, cy, s, energy);

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}
