"use client";

import { useEffect, useState } from "react";
import ReasoningWebJs from "./ReasoningWeb";
import ShaderBackgroundJs from "./ShaderBackground";
import { AgentOverview, type NodeSel } from "./ApexWorld";
import { useAstraRuntime } from "./AstraRuntime";

const ReasoningWeb = ReasoningWebJs as unknown as React.ComponentType<{
  state?: string;
  trace?: unknown;
  mode?: string;
  coreless?: boolean;
  onSelect?: (n: NodeSel) => void;
  light?: boolean;
}>;

const ShaderBackground = ShaderBackgroundJs as unknown as React.ComponentType<{
  opacity?: number;
  voiceActive?: boolean;
  gold?: boolean;
}>;

export default function AstraWorld() {
  const { orbState } = useAstraRuntime();
  const [selected, setSelected] = useState<NodeSel | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const webState = orbState === "thinking" ? "processing" : orbState === "speaking" ? "speaking" : "standby";

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", userSelect: "none" }}>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 92% 86% at 50% 42%, #10283c 0%, #0b1b2c 38%, #07111f 72%, #050b14 100%)",
        }}
      />

      {!reduced && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <ShaderBackground opacity={0.10} voiceActive={orbState === "speaking"} gold={false} />
        </div>
      )}

      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          mixBlendMode: "screen",
          background: `radial-gradient(circle at 50% 43%, rgba(13,210,255,${orbState === "speaking" ? 0.20 : 0.11}) 0%, rgba(13,170,228,0.045) 28%, rgba(8,17,31,0) 58%)`,
          transition: "background 0.5s ease",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          WebkitMaskImage: "radial-gradient(circle at 50% 47%, transparent 0%, transparent 24%, rgba(0,0,0,.20) 36%, black 52%)",
          maskImage: "radial-gradient(circle at 50% 47%, transparent 0%, transparent 24%, rgba(0,0,0,.20) 36%, black 52%)",
        }}
      >
        <ReasoningWeb
          state={webState}
          mode="full"
          coreless
          onSelect={(node: NodeSel) => setSelected(node)}
        />
      </div>

      {selected && <AgentOverview sel={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
