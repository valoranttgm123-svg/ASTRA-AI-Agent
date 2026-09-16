"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AgentResponse, AstraOrbState } from "@/lib/agent/types";
import type { AstraAvatarState } from "@/lib/avatar/types";

type AstraRuntimeValue = {
  orbState: AstraOrbState;
  avatarState: AstraAvatarState;
  speechLevel: number;
  voiceEnabled: boolean;
  activeAgent: string | null;
  lastResponse: AgentResponse | null;
  send: (message: string) => Promise<AgentResponse>;
  beginListening: () => void;
  endListening: () => void;
  setAvatarState: (state: AstraAvatarState) => void;
  setVoiceEnabled: (enabled: boolean) => void;
};

const AstraRuntimeContext = createContext<AstraRuntimeValue | null>(null);

export function AstraRuntimeProvider({ children }: { children: React.ReactNode }) {
  const [orbState, setOrbState] = useState<AstraOrbState>("idle");
  const [avatarState, setAvatarState] = useState<AstraAvatarState>("idle");
  const [speechLevel, setSpeechLevel] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<AgentResponse | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    if (speechTimer.current) clearInterval(speechTimer.current);
    resetTimer.current = null;
    speechTimer.current = null;
  }, []);

  useEffect(() => () => {
    clearTimers();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [clearTimers]);

  const settleIdle = useCallback((delay = 800) => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setOrbState("idle");
      setAvatarState("idle");
      setSpeechLevel(0);
      setActiveAgent(null);
    }, delay);
  }, []);

  const speak = useCallback((text: string) => {
    setOrbState("speaking");
    setAvatarState("speaking");

    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      settleIdle(5200);
      return;
    }

    window.speechSynthesis.cancel();
    if (speechTimer.current) clearInterval(speechTimer.current);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID";
    utterance.rate = 1.02;
    utterance.pitch = 0.94;

    const voices = window.speechSynthesis.getVoices();
    const indonesian = voices.find((voice) => voice.lang.toLowerCase().startsWith("id"));
    if (indonesian) utterance.voice = indonesian;

    const startedAt = performance.now();
    speechTimer.current = setInterval(() => {
      const t = (performance.now() - startedAt) / 1000;
      const level = 0.18 + Math.abs(Math.sin(t * 10.8)) * 0.46 + Math.abs(Math.sin(t * 5.3)) * 0.16;
      setSpeechLevel(Math.min(1, level));
    }, 70);

    utterance.onend = () => {
      if (speechTimer.current) clearInterval(speechTimer.current);
      speechTimer.current = null;
      setSpeechLevel(0);
      settleIdle(500);
    };

    utterance.onerror = () => {
      if (speechTimer.current) clearInterval(speechTimer.current);
      speechTimer.current = null;
      setSpeechLevel(0);
      settleIdle(700);
    };

    window.speechSynthesis.speak(utterance);
  }, [settleIdle, voiceEnabled]);

  const beginListening = useCallback(() => {
    clearTimers();
    setOrbState("idle");
    setAvatarState("listening");
    setSpeechLevel(0);
  }, [clearTimers]);

  const endListening = useCallback(() => {
    setAvatarState((current) => current === "listening" ? "idle" : current);
  }, []);

  const send = useCallback(async (message: string) => {
    clearTimers();
    setOrbState("thinking");
    setAvatarState("thinking");
    setSpeechLevel(0);
    setActiveAgent("Chief");

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(`ASTRA request failed (${response.status})`);
      }

      const result = (await response.json()) as AgentResponse;
      setLastResponse(result);
      setActiveAgent(result.agentName);
      speak(result.message);
      return result;
    } catch (error) {
      setOrbState("idle");
      setAvatarState("error");
      setSpeechLevel(0);
      settleIdle(1800);
      throw error;
    }
  }, [clearTimers, settleIdle, speak]);

  const value = useMemo(
    () => ({
      orbState,
      avatarState,
      speechLevel,
      voiceEnabled,
      activeAgent,
      lastResponse,
      send,
      beginListening,
      endListening,
      setAvatarState,
      setVoiceEnabled,
    }),
    [
      orbState,
      avatarState,
      speechLevel,
      voiceEnabled,
      activeAgent,
      lastResponse,
      send,
      beginListening,
      endListening,
    ],
  );

  return <AstraRuntimeContext.Provider value={value}>{children}</AstraRuntimeContext.Provider>;
}

export function useAstraRuntime() {
  const value = useContext(AstraRuntimeContext);
  if (!value) throw new Error("useAstraRuntime must be used inside AstraRuntimeProvider");
  return value;
}
