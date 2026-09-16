"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { AgentResponse, AstraOrbState } from "@/lib/agent/types";

type AstraRuntimeValue = {
  orbState: AstraOrbState;
  activeAgent: string | null;
  lastResponse: AgentResponse | null;
  send: (message: string) => Promise<AgentResponse>;
};

const AstraRuntimeContext = createContext<AstraRuntimeValue | null>(null);

export function AstraRuntimeProvider({ children }: { children: React.ReactNode }) {
  const [orbState, setOrbState] = useState<AstraOrbState>("idle");
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<AgentResponse | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pulseOrb = useCallback(() => {
    const target = document.querySelector<HTMLElement>('[aria-label="Apex core - tap to energize"]');
    target?.click();
  }, []);

  const send = useCallback(async (message: string) => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setOrbState("thinking");
    setActiveAgent("Chief");
    pulseOrb();

    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      setOrbState("idle");
      setActiveAgent(null);
      throw new Error(`ASTRA request failed (${response.status})`);
    }

    const result = (await response.json()) as AgentResponse;
    setLastResponse(result);
    setActiveAgent(result.agentName);
    setOrbState("speaking");
    pulseOrb();

    resetTimer.current = setTimeout(() => {
      setOrbState("idle");
      setActiveAgent(null);
      pulseOrb();
    }, 6000);

    return result;
  }, [pulseOrb]);

  const value = useMemo(
    () => ({ orbState, activeAgent, lastResponse, send }),
    [orbState, activeAgent, lastResponse, send],
  );

  return <AstraRuntimeContext.Provider value={value}>{children}</AstraRuntimeContext.Provider>;
}

export function useAstraRuntime() {
  const value = useContext(AstraRuntimeContext);
  if (!value) throw new Error("useAstraRuntime must be used inside AstraRuntimeProvider");
  return value;
}
