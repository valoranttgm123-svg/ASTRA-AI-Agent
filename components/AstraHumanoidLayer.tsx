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
        zIndex: 8,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/*
        Central visual well. This intentionally sits above the legacy APEX orb
        and reasoning-web centre so the live humanoid is the primary interface.
        The graph remains visible around the outside edge.
      */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "48%",
          width: "min(900px, 72vw)",
          height: "min(900px, 94vh)",
          transform: "translate(-50%, -50%)",
          borderRadius: "46%",
          background:
            "radial-gradient(ellipse at 50% 43%, rgba(2,8,15,.995) 0%, rgba(2,10,19,.98) 34%, rgba(3,14,25,.93) 50%, rgba(3,19,32,.60) 67%, rgba(3,19,32,.12) 78%, transparent 86%)",
          boxShadow: "inset 0 0 120px rgba(0,220,255,.035)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "49%",
          width: "min(900px, 72vw)",
          height: "min(900px, 94vh)",
          transform: "translate(-50%, -50%)",
          filter: "drop-shadow(0 0 28px rgba(0,229,255,.22))",
        }}
      >
        <AstraLiveHumanoid state={avatarState} speechLevel={speechLevel} />
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "4.5%",
          transform: "translateX(-50%)",
          fontFamily: "var(--font-mono)",
          fontSize: "clamp(7px, 0.66vw, 10px)",
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          color: "rgba(174,247,255,.76)",
          textShadow: "0 0 16px rgba(0,229,255,.58)",
          whiteSpace: "nowrap",
        }}
      >
        {activeAgent ? `ASTRA // ${activeAgent}` : "ASTRA // LIVE HUMANOID"}
      </div>

      <div
        style={{
          position: "absolute",
          left: "calc(50% + min(22vw, 285px))",
          top: "20%",
          fontFamily: "var(--font-mono)",
          fontSize: "clamp(7px, 0.6vw, 9px)",
          fontWeight: 700,
          letterSpacing: "0.15em",
          color: avatarState === "speaking" ? "rgba(255,181,67,.92)" : "rgba(91,238,255,.88)",
          textShadow: avatarState === "speaking" ? "0 0 12px rgba(255,160,45,.55)" : "0 0 12px rgba(0,229,255,.48)",
          whiteSpace: "nowrap",
        }}
      >
        {AVATAR_STATE_LABEL[avatarState]}
      </div>
    </div>
  );
}
