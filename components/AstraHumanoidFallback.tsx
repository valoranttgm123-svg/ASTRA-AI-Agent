"use client";

import type { OrbState } from "./ApexHeroOrb";

function headLine(index: number, total: number) {
  const t = index / (total - 1);
  const y = 150 + t * 410;
  const n = (t - 0.5) * 2;
  const profile = Math.sqrt(Math.max(0, 1 - n * n));
  const jaw = t > 0.68 ? 1 - (t - 0.68) * 1.45 : 1;
  const forehead = t < 0.16 ? 0.82 + t * 1.1 : 1;
  const rx = 142 * profile * Math.max(0.5, jaw) * forehead;
  const bulge = 5 + Math.sin(t * Math.PI * 5) * 3 + (t > 0.5 ? 6 : 0);
  return `M ${400 - rx} ${y} Q 400 ${y + bulge} ${400 + rx} ${y}`;
}

function shoulderLine(index: number, total: number) {
  const t = index / (total - 1);
  const y = 610 + t * 225;
  const spread = 205 + t * 150;
  const shoulderY = y - 32 - t * 30;
  return `M ${400 - spread} ${y} Q ${255 - t * 20} ${shoulderY} ${330 - t * 5} ${610 + t * 28} Q 400 ${640 + t * 38} ${470 + t * 5} ${610 + t * 28} Q ${545 + t * 20} ${shoulderY} ${400 + spread} ${y}`;
}

function waveLine(side: -1 | 1, index: number) {
  const baseY = 565 + index * 9;
  const startX = side < 0 ? 35 : 765;
  const endX = side < 0 ? 300 : 500;
  const c1x = side < 0 ? 135 : 665;
  const c2x = side < 0 ? 210 : 590;
  const lift = Math.sin(index * 0.82) * 28;
  return `M ${startX} ${baseY + lift} C ${c1x} ${baseY - 80 - lift} ${c2x} ${baseY + 48 + lift} ${endX} ${baseY - 18}`;
}

export default function AstraHumanoidFallback({ state = "idle" }: { state?: OrbState }) {
  const thinking = state === "thinking";
  const speaking = state === "speaking";
  const cyan = thinking ? "#bffaff" : "#18e7ff";
  const orange = speaking ? "#ffc45d" : "#ff9f32";
  const strength = speaking ? 1 : thinking ? 0.92 : 0.72;
  const headLines = 62;
  const shoulderLines = 28;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
        opacity: strength,
        transition: "opacity .35s ease",
      }}
    >
      <svg
        viewBox="0 0 800 900"
        role="presentation"
        style={{
          width: "min(66vw, 760px)",
          height: "min(92vh, 900px)",
          overflow: "visible",
          animation: "astra-ref-breathe 5s ease-in-out infinite",
          filter: "drop-shadow(0 0 7px rgba(0,229,255,.5)) drop-shadow(0 0 22px rgba(0,183,255,.26))",
        }}
      >
        <defs>
          <radialGradient id="astraFaceEnergy" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff2c3" stopOpacity={speaking ? 0.98 : 0.86} />
            <stop offset="18%" stopColor={orange} stopOpacity="0.92" />
            <stop offset="48%" stopColor="#ff7a22" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#ff7a22" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="astraCyanAura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={cyan} stopOpacity="0.34" />
            <stop offset="65%" stopColor={cyan} stopOpacity="0.08" />
            <stop offset="100%" stopColor={cyan} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="astraNeckEnergy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={orange} stopOpacity="0.12" />
            <stop offset="50%" stopColor={orange} stopOpacity="0.72" />
            <stop offset="100%" stopColor={orange} stopOpacity="0.05" />
          </linearGradient>
          <filter id="astraSoftGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>

        <ellipse cx="400" cy="385" rx="260" ry="330" fill="url(#astraCyanAura)" opacity="0.28" />

        <g fill="none" stroke={cyan} strokeLinecap="round" style={{ mixBlendMode: "screen" }}>
          {Array.from({ length: 18 }).map((_, i) => (
            <path key={`wl-${i}`} d={waveLine(-1, i)} strokeWidth={i % 4 === 0 ? 1.8 : 0.85} opacity={0.08 + (i % 5) * 0.025} />
          ))}
          {Array.from({ length: 18 }).map((_, i) => (
            <path key={`wr-${i}`} d={waveLine(1, i)} strokeWidth={i % 4 === 0 ? 1.8 : 0.85} opacity={0.08 + (i % 5) * 0.025} />
          ))}
        </g>

        <g fill="none" stroke={cyan} strokeLinecap="round" strokeLinejoin="round">
          {Array.from({ length: headLines }).map((_, i) => (
            <path
              key={`head-${i}`}
              d={headLine(i, headLines)}
              strokeWidth={i % 7 === 0 ? 2.25 : 1.25}
              opacity={0.36 + Math.sin((i / headLines) * Math.PI) * 0.56}
            />
          ))}

          <path d="M 285 310 Q 250 355 285 430 Q 302 466 333 492" strokeWidth="2.1" opacity="0.72" />
          <path d="M 515 310 Q 550 355 515 430 Q 498 466 467 492" strokeWidth="2.1" opacity="0.72" />
          <path d="M 310 485 Q 400 575 490 485" strokeWidth="1.7" opacity="0.42" />

          {Array.from({ length: 17 }).map((_, i) => {
            const t = i / 16;
            const x = 330 + t * 140;
            const bend = (t - 0.5) * 26;
            return (
              <path
                key={`neck-${i}`}
                d={`M ${x} 495 Q ${x + bend * 0.28} 585 ${x + bend} 690`}
                strokeWidth={i % 4 === 0 ? 1.8 : 1}
                opacity={0.25 + (1 - Math.abs(t - 0.5) * 2) * 0.4}
              />
            );
          })}

          {Array.from({ length: shoulderLines }).map((_, i) => (
            <path
              key={`shoulder-${i}`}
              d={shoulderLine(i, shoulderLines)}
              strokeWidth={i % 5 === 0 ? 1.8 : 0.9}
              opacity={0.16 + (1 - i / shoulderLines) * 0.38}
            />
          ))}
        </g>

        <ellipse cx="400" cy="365" rx="128" ry="112" fill="url(#astraFaceEnergy)" opacity={thinking ? 0.78 : speaking ? 0.96 : 0.68} filter="url(#astraSoftGlow)" />
        <ellipse cx="400" cy="365" rx="92" ry="74" fill="url(#astraFaceEnergy)" opacity={thinking ? 0.88 : 0.72} />

        <g fill="none" stroke={orange} strokeLinecap="round" style={{ mixBlendMode: "screen" }}>
          {Array.from({ length: 10 }).map((_, i) => {
            const y = 327 + i * 9;
            const half = 52 + Math.sin(i * 0.9) * 12;
            return <path key={`face-energy-${i}`} d={`M ${400 - half} ${y} Q 400 ${y + 12 + Math.sin(i) * 4} ${400 + half} ${y}`} strokeWidth={i % 3 === 0 ? 2.4 : 1.45} opacity={0.38 + i * 0.035} />;
          })}
          <path d="M 400 505 C 388 550 392 610 400 700" strokeWidth="3" opacity="0.82" />
          <path d="M 382 515 C 362 570 375 625 395 686" strokeWidth="1.5" opacity="0.52" />
          <path d="M 418 515 C 438 570 425 625 405 686" strokeWidth="1.5" opacity="0.52" />
        </g>
        <path d="M 370 510 Q 400 550 430 510 L 445 700 Q 400 740 355 700 Z" fill="url(#astraNeckEnergy)" opacity="0.4" />

        <g fill={cyan} style={{ mixBlendMode: "screen" }}>
          {Array.from({ length: 150 }).map((_, i) => {
            const angle = (i * 2.3999632297) % (Math.PI * 2);
            const band = 1 + ((i * 37) % 100) / 100;
            const rx = 158 + band * 45;
            const ry = 218 + band * 68;
            const x = 400 + Math.cos(angle) * rx;
            const y = 340 + Math.sin(angle) * ry - 52;
            const r = 0.8 + (i % 5) * 0.36;
            return <circle key={`p-${i}`} cx={x} cy={y} r={r} opacity={0.14 + (i % 7) * 0.065} />;
          })}
        </g>

        <g fill="none" stroke={cyan} opacity="0.15">
          <circle cx="400" cy="355" r="204" strokeWidth="1" strokeDasharray="2 12" />
          <circle cx="400" cy="355" r="230" strokeWidth="0.8" strokeDasharray="1 18" />
          <circle cx="400" cy="355" r="258" strokeWidth="0.7" strokeDasharray="4 22" />
        </g>
      </svg>

      <style jsx>{`
        @keyframes astra-ref-breathe {
          0%, 100% { transform: translateY(2px) scale(1); }
          50% { transform: translateY(-5px) scale(1.008); }
        }
      `}</style>
    </div>
  );
}
