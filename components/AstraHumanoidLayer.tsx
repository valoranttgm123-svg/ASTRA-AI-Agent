"use client";

import dynamic from "next/dynamic";
import { useAstraRuntime } from "./AstraRuntime";

const AstraHumanoid3D = dynamic(() => import("./AstraHumanoid3D"), { ssr: false });

export default function AstraHumanoidLayer() {
  const { orbState, activeAgent } = useAstraRuntime();

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: "1vh 0 2vh",
        zIndex: 5,
        pointerEvents: "none",
        opacity: 0.92,
        mixBlendMode: "screen",
        maskImage: "linear-gradient(to bottom, transparent 0%, black 6%, black 91%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 6%, black 91%, transparent 100%)",
      }}
    >
      <AstraHumanoid3D state={orbState} />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "8%",
          transform: "translateX(-50%)",
          fontFamily: "var(--font-mono)",
          fontSize: "clamp(8px, 0.8vw, 11px)",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(190,250,255,0.78)",
          textShadow: "0 0 18px rgba(0,229,255,0.75)",
          whiteSpace: "nowrap",
        }}
      >
        {activeAgent ? `ASTRA // ${activeAgent}` : "ASTRA // SYNTHETIC FORM ONLINE"}
      </div>
    </div>
  );
}
