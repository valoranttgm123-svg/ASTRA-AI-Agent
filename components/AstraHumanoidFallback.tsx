"use client";

import type { OrbState } from "./ApexHeroOrb";

export default function AstraHumanoidFallback({ state = "idle" }: { state?: OrbState }) {
  const active = state !== "idle";
  const speaking = state === "speaking";
  const stroke = speaking ? "#f5a623" : "#00e5ff";
  const glow = speaking ? "rgba(245,166,35,0.8)" : "rgba(0,229,255,0.8)";

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
        opacity: active ? 0.54 : 0.42,
        filter: `drop-shadow(0 0 12px ${glow}) drop-shadow(0 0 28px ${glow})`,
        transition: "opacity .35s ease, filter .35s ease",
      }}
    >
      <svg
        viewBox="0 0 500 900"
        role="presentation"
        style={{
          width: "min(42vw, 430px)",
          height: "min(84vh, 790px)",
          overflow: "visible",
          animation: "astra-holo-breathe 4.2s ease-in-out infinite",
        }}
      >
        <defs>
          <radialGradient id="astraCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="35%" stopColor={stroke} stopOpacity="0.85" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="astraBodyFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.82" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.28" />
          </linearGradient>
        </defs>

        <g fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="250" cy="115" rx="64" ry="82" opacity="0.78" />
          <path d="M205 88 Q250 60 295 88" opacity="0.34" />
          <path d="M220 125 Q250 143 280 125" opacity="0.28" />
          <circle cx="230" cy="113" r="4" fill={stroke} opacity="0.9" />
          <circle cx="270" cy="113" r="4" fill={stroke} opacity="0.9" />

          <path d="M225 195 L180 245 L135 380 L118 540" opacity="0.82" />
          <path d="M275 195 L320 245 L365 380 L382 540" opacity="0.82" />
          <path d="M225 195 Q250 178 275 195" />
          <path d="M200 230 Q250 260 300 230" opacity="0.55" />
          <path d="M195 245 Q175 355 200 470 Q225 520 250 530 Q275 520 300 470 Q325 355 305 245" opacity="0.86" />
          <path d="M250 205 L250 530" opacity="0.45" />
          <path d="M210 320 Q250 348 290 320" opacity="0.35" />
          <path d="M205 395 Q250 420 295 395" opacity="0.28" />

          <path d="M200 470 L175 565 L160 770" opacity="0.88" />
          <path d="M300 470 L325 565 L340 770" opacity="0.88" />
          <path d="M160 770 L140 835 L188 835" opacity="0.72" />
          <path d="M340 770 L360 835 L312 835" opacity="0.72" />

          <ellipse cx="250" cy="365" rx="54" ry="54" opacity="0.58" />
          <ellipse cx="250" cy="365" rx="36" ry="36" opacity="0.38" />
          <circle cx="250" cy="365" r="14" fill={stroke} opacity="0.92" />
          <circle cx="250" cy="365" r="64" strokeDasharray="6 12" opacity="0.26" style={{ animation: "astra-holo-spin 8s linear infinite", transformOrigin: "250px 365px" }} />
          <circle cx="250" cy="365" r="86" strokeDasharray="3 18" opacity="0.16" style={{ animation: "astra-holo-spin-rev 12s linear infinite", transformOrigin: "250px 365px" }} />
        </g>

        <path d="M205 195 Q250 170 295 195 L305 245 Q325 355 300 470 Q275 520 250 530 Q225 520 200 470 Q175 355 195 245 Z" fill="url(#astraBodyFade)" opacity="0.08" />
        <circle cx="250" cy="365" r="88" fill="url(#astraCoreGlow)" opacity={active ? 0.24 : 0.15} />

        <g stroke={stroke} strokeWidth="1" opacity="0.18">
          {Array.from({ length: 11 }).map((_, i) => (
            <line key={i} x1="130" x2="370" y1={255 + i * 42} y2={255 + i * 42} />
          ))}
        </g>
      </svg>

      <style jsx>{`
        @keyframes astra-holo-breathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-4px) scale(1.008); }
        }
        @keyframes astra-holo-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes astra-holo-spin-rev {
          to { transform: rotate(-360deg); }
        }
      `}</style>
    </div>
  );
}
