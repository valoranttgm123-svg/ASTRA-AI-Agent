"use client";

import { useAstraRuntime } from "./AstraRuntime";
import AstraReferenceEntity from "./AstraReferenceEntity";

export default function AstraHumanoidLayer() {
  const { orbState, activeAgent } = useAstraRuntime();

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        pointerEvents: "none",
        overflow: "hidden",
        maskImage: "linear-gradient(to bottom, transparent 0%, black 2%, black 96%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 2%, black 96%, transparent 100%)",
      }}
    >
      <AstraReferenceEntity state={orbState} />

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "6.5%",
          transform: "translateX(-50%)",
          fontFamily: "var(--font-mono)",
          fontSize: "clamp(8px, 0.72vw, 10px)",
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: "rgba(176,248,255,0.68)",
          textShadow: "0 0 16px rgba(0,229,255,0.62)",
          whiteSpace: "nowrap",
        }}
      >
        {activeAgent ? `ASTRA // ${activeAgent}` : "ASTRA // ENTITY CORE"}
      </div>
    </div>
  );
}
