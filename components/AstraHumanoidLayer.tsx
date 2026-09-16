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
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "47%",
          width: "min(720px, 58vw)",
          height: "min(780px, 88vh)",
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(0,229,255,.105) 0%, rgba(0,185,230,.045) 33%, rgba(0,115,170,.015) 54%, transparent 72%)",
          filter: "blur(8px)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "49%",
          width: "min(940px, 76vw)",
          height: "min(920px, 96vh)",
          transform: "translate(-50%, -50%)",
          filter: "drop-shadow(0 0 32px rgba(0,229,255,.30))",
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
