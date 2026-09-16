"use client";

import { useAstraRuntime } from "./AstraRuntime";
import AstraReferenceEntityV4 from "./AstraReferenceEntityV4";

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
        maskImage: "linear-gradient(to bottom, transparent 0%, black 1.5%, black 97%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 1.5%, black 97%, transparent 100%)",
      }}
    >
      <AstraReferenceEntityV4 state={orbState} />

      <div
        style={{
          position: "absolute",
          left: "53%",
          top: "4.5%",
          transform: "translateX(-50%)",
          fontFamily: "var(--font-mono)",
          fontSize: "clamp(7px, 0.65vw, 9px)",
          letterSpacing: "0.26em",
          textTransform: "uppercase",
          color: "rgba(165,245,255,0.58)",
          textShadow: "0 0 14px rgba(0,229,255,0.48)",
          whiteSpace: "nowrap",
        }}
      >
        {activeAgent ? `ASTRA // ${activeAgent}` : "ASTRA // ENTITY CORE"}
      </div>
    </div>
  );
}
