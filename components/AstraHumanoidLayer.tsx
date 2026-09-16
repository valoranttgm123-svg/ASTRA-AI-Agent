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
        inset: "2vh 0 3vh",
        zIndex: 2,
        pointerEvents: "none",
        opacity: 0.74,
        maskImage: "linear-gradient(to bottom, transparent 0%, black 9%, black 88%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 9%, black 88%, transparent 100%)",
      }}
    >
      <AstraHumanoid3D state={orbState} />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "13%",
          transform: "translateX(-50%)",
          fontFamily: "var(--font-mono)",
          fontSize: "clamp(8px, 0.8vw, 11px)",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(155,244,255,0.55)",
          textShadow: "0 0 14px rgba(0,229,255,0.45)",
          whiteSpace: "nowrap",
        }}
      >
        {activeAgent ? `ASTRA // ${activeAgent}` : "ASTRA // SYNTHETIC FORM ONLINE"}
      </div>
    </div>
  );
}
