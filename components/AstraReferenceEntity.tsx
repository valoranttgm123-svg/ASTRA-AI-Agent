"use client";

import { useEffect, useRef } from "react";
import type { OrbState } from "./ApexHeroOrb";

type Particle = { x: number; y: number; r: number; a: number; phase: number; drift: number };

type Props = {
  state?: OrbState;
};

const TAU = Math.PI * 2;

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function faceHalfWidth(n: number) {
  const crown = Math.pow(Math.max(0, 1 - Math.pow((n + 0.02) / 1.02, 2)), 0.48);
  const jaw = 0.72 + 0.28 * (1 - Math.max(0, n));
  const chin = n > 0.58 ? 1 - (n - 0.58) * 0.78 : 1;
  return Math.max(0.12, crown * jaw * chin);
}

export default function AstraReferenceEntity({ state = "idle" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<OrbState>(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const rand = mulberry32(16092026);
    const particles: Particle[] = Array.from({ length: 980 }, () => {
      const a = rand() * TAU;
      const shell = 1 + Math.pow(rand(), 1.7) * 0.45;
      return {
        x: Math.cos(a) * shell,
        y: Math.sin(a) * shell,
        r: 0.45 + rand() * 1.8,
        a: 0.14 + rand() * 0.78,
        phase: rand() * TAU,
        drift: 0.25 + rand() * 0.9,
      };
    });

    let raf = 0;
    let cssW = 1;
    let cssH = 1;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      cssW = Math.max(1, rect.width);
      cssH = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 1.35);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const drawEnergyLandscape = (t: number, cx: number, cy: number, scale: number, activity: number) => {
      const baseY = cy + scale * 0.58;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (let side = -1; side <= 1; side += 2) {
        for (let line = 0; line < 34; line += 1) {
          const alpha = 0.035 + (line % 6 === 0 ? 0.075 : 0);
          ctx.strokeStyle = `rgba(0,205,255,${alpha})`;
          ctx.lineWidth = line % 8 === 0 ? 1.05 : 0.48;
          ctx.beginPath();

          const startX = cx + side * scale * 0.66;
          for (let i = 0; i <= 90; i += 1) {
            const u = i / 90;
            const x = startX + side * u * scale * 1.78;
            const envelope = 0.1 + Math.pow(u, 0.72) * 0.72;
            const wave = Math.sin(u * 13.5 + line * 0.33 + t * (0.18 + activity * 0.07));
            const wave2 = Math.sin(u * 28 - line * 0.19 - t * 0.11) * 0.26;
            const y = baseY - envelope * scale * 0.42 + (wave + wave2) * envelope * scale * 0.17 + line * scale * 0.008;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      for (let side = -1; side <= 1; side += 2) {
        for (let strand = 0; strand < 9; strand += 1) {
          ctx.strokeStyle = `rgba(255,164,46,${0.055 + strand * 0.005})`;
          ctx.lineWidth = 0.85;
          ctx.beginPath();
          const sx = cx + side * scale * (0.95 + strand * 0.075);
          for (let i = 0; i <= 50; i += 1) {
            const u = i / 50;
            const x = sx + side * u * scale * 1.18;
            const y = baseY - scale * (0.17 + u * 0.24) + Math.sin(u * 12 + strand + t * 0.25) * scale * (0.018 + u * 0.035);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      ctx.restore();
    };

    const drawShoulders = (t: number, cx: number, cy: number, scale: number, activity: number) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const shoulderY = cy + scale * 0.78;
      const neckTop = cy + scale * 0.39;

      for (let i = 0; i < 58; i += 1) {
        const q = i / 57;
        const y = neckTop + q * scale * 0.94;
        const neck = scale * (0.24 + q * 0.04);
        const shoulder = scale * (0.42 + q * 1.1);
        const half = q < 0.39 ? neck + q * scale * 0.13 : shoulder;
        const alpha = 0.12 + (i % 7 === 0 ? 0.18 : 0);
        ctx.strokeStyle = `rgba(20,226,255,${alpha})`;
        ctx.lineWidth = i % 8 === 0 ? 1.2 : 0.58;
        ctx.beginPath();
        const steps = 90;
        for (let s = 0; s <= steps; s += 1) {
          const u = s / steps;
          const x = cx + (u * 2 - 1) * half;
          const edge = Math.pow(Math.abs(u * 2 - 1), 1.5);
          const curve = edge * scale * (0.07 + q * 0.2);
          const ripple = Math.sin(u * 18 + i * 0.31 + t * 0.22) * scale * 0.004 * activity;
          const yy = y + curve + ripple;
          if (s === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }

      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 15; i += 1) {
          const offset = i * scale * 0.009;
          ctx.strokeStyle = `rgba(255,167,43,${0.08 + i * 0.004})`;
          ctx.lineWidth = i % 4 === 0 ? 1.15 : 0.55;
          ctx.beginPath();
          ctx.moveTo(cx + side * (scale * 0.018 + offset * 0.12), neckTop + scale * 0.06);
          ctx.bezierCurveTo(
            cx + side * (scale * 0.11 + offset),
            cy + scale * 0.62,
            cx + side * (scale * 0.19 + offset * 1.2),
            shoulderY + scale * 0.16,
            cx + side * (scale * 0.08 + offset * 0.6),
            shoulderY + scale * 0.43,
          );
          ctx.stroke();
        }
      }

      ctx.restore();
    };

    const drawHead = (t: number, cx: number, cy: number, scale: number, activity: number, speaking: boolean) => {
      const headH = scale * 1.16;
      const centerY = cy - scale * 0.03;
      const halfW = scale * 0.45;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      const faceGlow = ctx.createRadialGradient(cx, centerY + scale * 0.16, 0, cx, centerY + scale * 0.16, scale * 0.5);
      faceGlow.addColorStop(0, speaking ? "rgba(255,236,165,.9)" : "rgba(255,177,46,.88)");
      faceGlow.addColorStop(0.15, "rgba(255,145,30,.62)");
      faceGlow.addColorStop(0.43, "rgba(255,98,18,.24)");
      faceGlow.addColorStop(1, "rgba(255,98,18,0)");
      ctx.fillStyle = faceGlow;
      ctx.beginPath();
      ctx.ellipse(cx, centerY + scale * 0.14, scale * 0.37, scale * 0.48, 0, 0, TAU);
      ctx.fill();

      const lines = 78;
      for (let i = 0; i < lines; i += 1) {
        const p = i / (lines - 1);
        const n = p * 2 - 1;
        const y = centerY + n * headH * 0.5;
        const widthFactor = faceHalfWidth(n);
        const hw = halfW * widthFactor;
        const alpha = 0.26 + (i % 7 === 0 ? 0.27 : 0);
        const warm = 1 - Math.min(1, Math.abs(n - 0.15) * 2.15);
        const cyanA = alpha * (1 - warm * 0.26);
        const orangeA = alpha * warm * (0.44 + activity * 0.18);

        ctx.lineWidth = i % 9 === 0 ? 1.65 : 0.74;
        ctx.strokeStyle = `rgba(31,231,255,${cyanA})`;
        ctx.beginPath();
        const steps = 84;
        for (let s = 0; s <= steps; s += 1) {
          const u = s / steps;
          const xN = u * 2 - 1;
          const x = cx + xN * hw;
          const centerWarp = Math.exp(-Math.pow(xN / 0.34, 2));
          const nose = centerWarp * scale * 0.018 * (0.2 + warm);
          const organic = Math.sin(xN * 7.2 + i * 0.19 + t * 0.35) * scale * 0.0042 * (0.35 + activity);
          const yy = y + nose + organic;
          if (s === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();

        if (orangeA > 0.025) {
          ctx.strokeStyle = `rgba(255,167,50,${orangeA})`;
          ctx.lineWidth = i % 9 === 0 ? 1.15 : 0.52;
          ctx.beginPath();
          for (let s = 22; s <= 62; s += 1) {
            const u = s / steps;
            const xN = u * 2 - 1;
            const x = cx + xN * hw;
            const centerWarp = Math.exp(-Math.pow(xN / 0.31, 2));
            const yy = y + centerWarp * scale * 0.018 + Math.sin(xN * 6.4 + i * 0.21 + t * 0.31) * scale * 0.0038;
            if (s === 22) ctx.moveTo(x, yy);
            else ctx.lineTo(x, yy);
          }
          ctx.stroke();
        }
      }

      ctx.shadowBlur = scale * 0.055;
      ctx.shadowColor = "rgba(0,230,255,.95)";
      ctx.strokeStyle = "rgba(80,244,255,.93)";
      ctx.lineWidth = Math.max(1.25, scale * 0.0065);
      ctx.beginPath();
      for (let k = 0; k <= 150; k += 1) {
        const a = (k / 150) * TAU;
        const vertical = Math.sin(a);
        const horizontal = Math.cos(a);
        const n = vertical;
        const widthFactor = faceHalfWidth(n);
        const x = cx + horizontal * halfW * widthFactor;
        const y = centerY + vertical * headH * 0.5;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;

      const pulse = 0.5 + 0.5 * Math.sin(t * (speaking ? 6.4 : 2.6));
      ctx.fillStyle = `rgba(255,182,58,${0.11 + pulse * 0.09 + activity * 0.05})`;
      ctx.beginPath();
      ctx.ellipse(cx, centerY + scale * 0.14, scale * (0.08 + pulse * 0.01), scale * (0.055 + pulse * 0.008), 0, 0, TAU);
      ctx.fill();

      ctx.restore();
    };

    const drawParticles = (t: number, cx: number, cy: number, scale: number, activity: number) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const centerY = cy - scale * 0.18;
      for (const p of particles) {
        const angle = Math.atan2(p.y, p.x) + t * 0.012 * p.drift;
        const shellX = Math.cos(angle) * Math.abs(p.x);
        const shellY = Math.sin(angle) * Math.abs(p.y);
        const x = cx + shellX * scale * 0.62;
        const y = centerY + shellY * scale * 0.69 - Math.abs(shellY) * scale * 0.12;
        if (y > cy + scale * 0.45) continue;
        const flicker = 0.45 + 0.55 * Math.sin(t * (1.1 + p.drift) + p.phase);
        const alpha = p.a * (0.28 + flicker * 0.45) * (0.8 + activity * 0.24);
        ctx.fillStyle = `rgba(0,224,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.r * (0.7 + activity * 0.22), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawRings = (t: number, cx: number, cy: number, scale: number, activity: number) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 6; i += 1) {
        const r = scale * (0.67 + i * 0.17 + (Math.sin(t * 0.18 + i) + 1) * 0.008);
        ctx.strokeStyle = `rgba(0,209,255,${0.045 + activity * 0.016})`;
        ctx.lineWidth = 0.65;
        ctx.beginPath();
        ctx.arc(cx, cy - scale * 0.15, r, Math.PI * 1.03, Math.PI * 1.97);
        ctx.stroke();
      }
      ctx.restore();
    };

    const render = (ms: number) => {
      const t = ms / 1000;
      const current = stateRef.current;
      const thinking = current === "thinking";
      const speaking = current === "speaking";
      const activity = speaking ? 1 : thinking ? 0.7 : 0.26;

      ctx.clearRect(0, 0, cssW, cssH);

      const cx = cssW * 0.5;
      const cy = cssH * 0.43 + Math.sin(t * 0.62) * cssH * 0.0035;
      const scale = Math.min(cssW * 0.25, cssH * 0.43);

      const bg = ctx.createRadialGradient(cx, cy, scale * 0.08, cx, cy, scale * 2.1);
      bg.addColorStop(0, "rgba(8,21,34,.18)");
      bg.addColorStop(0.45, "rgba(1,10,20,.44)");
      bg.addColorStop(1, "rgba(0,4,10,.78)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssW, cssH);

      drawRings(t, cx, cy, scale, activity);
      drawEnergyLandscape(t, cx, cy, scale, activity);
      drawShoulders(t, cx, cy, scale, activity);
      drawHead(t, cx, cy, scale, activity, speaking);
      drawParticles(t, cx, cy, scale, activity);

      ctx.save();
      ctx.font = `600 ${Math.max(8, Math.min(11, cssW * 0.006))}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      ctx.letterSpacing = "2px";
      ctx.fillStyle = "rgba(72,235,255,.72)";
      ctx.shadowColor = "rgba(0,229,255,.75)";
      ctx.shadowBlur = 10;
      const label = current === "thinking" ? "STATUS: THINKING" : current === "speaking" ? "STATUS: SPEAKING" : "STATUS: IDLE";
      ctx.fillText(label, cx + scale * 0.82, cy - scale * 0.58);
      ctx.shadowBlur = 0;
      ctx.restore();

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        display: "block",
      }}
    />
  );
}
