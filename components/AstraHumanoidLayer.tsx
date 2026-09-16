"use client";

import dynamic from "next/dynamic";
import { useAstraRuntime } from "./AstraRuntime";
import AstraHumanoidFallback from "./AstraHumanoidFallback";

const AstraHumanoid3D = dynamic(() => import("./AstraHumanoid3D"), { ssr: false });

export default function AstraHumanoidLayer() {
  const { orbState, activeAgent } = useAstraRuntime();
  const status = orbState === "thinking" ? "THINKING" : orbState === "speaking" ? "SPEAKING" : "IDLE";

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: "0",
        zIndex: 5,
        pointerEvents: "none",
        overflow: "hidden",
        maskImage: "linear-gradient(to bottom, transparent 0%, black 3%, black 94%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 3%, black 94%, transparent 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "48%",
          width: "min(860px, 74vw)",
          height: "min(820px, 90vh)",
          transform: "translate(-50%, -50%)",
          borderRadius: "48%",
          background: "radial-gradient(ellipse at 50% 43%, rgba(3,10,18,.98) 0%, rgba(3,12,22,.9) 26%, rgba(4,18,31,.64) 47%, rgba(4,18,31,.18) 67%, transparent 78%)",
          filter: "blur(1px)",
        }}
      />

      <div style={{ position: "absolute", inset: 0, mixBlendMode: "screen", opacity: 0.82 }}>
        <AstraHumanoidFallback state={orbState} />
      </div>

      <div style={{ position: "absolute", inset: 0, mixBlendMode: "screen", opacity: 0.96 }}>
        <AstraHumanoid3D state={orbState} />
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "7.5%",
          transform: "translateX(-50%)",
          fontFamily: "var(--font-mono)",
          fontSize: "clamp(8px, 0.72vw, 10px)",
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: "rgba(176,248,255,0.72)",
          textShadow: "0 0 16px rgba(0,229,255,0.7)",
          whiteSpace: "nowrap",
        }}
      >
        {activeAgent ? `ASTRA // ${activeAgent}` : "ASTRA // ENTITY CORE"}
      </div>

      <div
        style={{
          position: "absolute",
          left: "calc(50% + min(24vw, 290px))",
          top: "31%",
          fontFamily: "var(--font-mono)",
          fontSize: "clamp(7px, 0.62vw, 9px)",
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: orbState === "speaking" ? "rgba(255,186,76,.9)" : "rgba(76,239,255,.82)",
          textShadow: orbState === "speaking" ? "0 0 13px rgba(255,154,40,.72)" : "0 0 13px rgba(0,229,255,.66)",
          whiteSpace: "nowrap",
        }}
      >
        STATUS: {status}
      </div>
    </div>
  );
}
