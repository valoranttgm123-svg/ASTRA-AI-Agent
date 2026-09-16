"use client";

import { useAstraRuntime } from "./AstraRuntime";
import AstraLiveHumanoid from "./AstraLiveHumanoid";
import { AVATAR_STATE_LABEL } from "@/lib/avatar/types";

export default function AstraHumanoidLayer() {
  const { avatarState, speechLevel, activeAgent } = useAstraRuntime();

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "46%",
          width: "min(760px, 60vw)",
          height: "min(840px, 92vh)",
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(ellipse at 50% 44%, rgba(0,229,255,.08), rgba(2,12,22,.62) 47%, transparent 72%)",
          filter: "blur(0.2px)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "49%",
          width: "min(760px, 64vw)",
          height: "min(860px, 92vh)",
          transform: "translate(-50%, -50%)",
        }}
      >
        <AstraLiveHumanoid state={avatarState} speechLevel={speechLevel} />
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "5%",
          transform: "translateX(-50%)",
          fontFamily: "var(--font-mono)",
          fontSize: "clamp(7px, 0.66vw, 10px)",
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          color: "rgba(174,247,255,.72)",
          textShadow: "0 0 16px rgba(0,229,255,.52)",
          whiteSpace: "nowrap",
        }}
      >
        {activeAgent ? `ASTRA // ${activeAgent}` : "ASTRA // LIVE HUMANOID"}
      </div>

      <div
        style={{
          position: "absolute",
          left: "calc(50% + min(22vw, 250px))",
          top: "22%",
          fontFamily: "var(--font-mono)",
          fontSize: "clamp(7px, 0.6vw, 9px)",
          fontWeight: 700,
          letterSpacing: "0.15em",
          color: avatarState === "speaking" ? "rgba(255,181,67,.88)" : "rgba(91,238,255,.82)",
          whiteSpace: "nowrap",
        }}
      >
        {AVATAR_STATE_LABEL[avatarState]}
      </div>
    </div>
  );
}
