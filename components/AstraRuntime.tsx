"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AstraOrbState } from "@/lib/agent/types";
import type { AstraAvatarState } from "@/lib/avatar/types";
import type {
  AstraBrainChatResult,
  AstraBrainEvent,
  AstraBrainProvider,
} from "@/lib/brain/types";

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorLike = Event & {
  error?: string;
  message?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

type ReasoningTrace = {
  n: number;
  trace: Array<{
    helper: string;
    type: string;
    at: number;
  }>;
};

type AstraRuntimeValue = {
  orbState: AstraOrbState;
  avatarState: AstraAvatarState;
  speechLevel: number;
  playbackActive: boolean;
  voiceEnabled: boolean;
  micSupported: boolean;
  micActive: boolean;
  micTranscript: string;
  micError: string | null;
  activeAgent: string | null;
  lastResponse: AstraBrainChatResult | null;
  brainProvider: AstraBrainProvider | null;
  brainEvents: AstraBrainEvent[];
  brainTrace: ReasoningTrace | null;
  send: (message: string) => Promise<AstraBrainChatResult>;
  beginListening: () => void;
  endListening: () => void;
  stopInteraction: () => void;
  setAvatarState: (state: AstraAvatarState) => void;
  setVoiceEnabled: (enabled: boolean) => void;
};

const AstraRuntimeContext = createContext<AstraRuntimeValue | null>(null);

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructorLike | null {
  if (typeof window === "undefined") return null;
  const browserWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

function micErrorMessage(error?: string) {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Izin mikrofon ditolak.";
    case "audio-capture":
      return "Mikrofon tidak tersedia atau sedang dipakai aplikasi lain.";
    case "network":
      return "Layanan pengenalan suara browser mengalami masalah jaringan.";
    case "no-speech":
      return "Tidak ada suara yang terdeteksi.";
    case "language-not-supported":
      return "Bahasa pengenalan suara tidak didukung browser.";
    case "aborted":
      return null;
    default:
      return error ? `Speech recognition error: ${error}` : "Pengenalan suara gagal.";
  }
}

export function AstraRuntimeProvider({ children }: { children: React.ReactNode }) {
  const [orbState, setOrbState] = useState<AstraOrbState>("idle");
  const [avatarState, setAvatarState] = useState<AstraAvatarState>("idle");
  // Kept for renderer compatibility. It is now an event-driven playback gate:
  // 1 only while speechSynthesis is actually playing, 0 otherwise.
  const [speechLevel, setSpeechLevel] = useState(0);
  const [playbackActive, setPlaybackActive] = useState(false);
  const [voiceEnabledState, setVoiceEnabledState] = useState(true);
  const [micSupported, setMicSupported] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micTranscript, setMicTranscript] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<AstraBrainChatResult | null>(null);
  const [brainProvider, setBrainProvider] = useState<AstraBrainProvider | null>(null);
  const [brainEvents, setBrainEvents] = useState<AstraBrainEvent[]>([]);
  const [brainTrace, setBrainTrace] = useState<ReasoningTrace | null>(null);

  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionSessionRef = useRef(0);
  const requestSequenceRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const speechSequenceRef = useRef(0);
  const brainTraceSequenceRef = useRef(0);
  const sendRef = useRef<(message: string) => Promise<AstraBrainChatResult>>(async () => {
    throw new Error("ASTRA runtime is not ready.");
  });

  const clearResetTimer = useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = null;
  }, []);

  const cancelSpeech = useCallback(() => {
    speechSequenceRef.current += 1;
    setPlaybackActive(false);
    setSpeechLevel(0);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const invalidateRecognition = useCallback((abort = true) => {
    recognitionSessionRef.current += 1;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    setMicActive(false);
    if (recognition && abort) {
      try {
        recognition.abort();
      } catch {
        // Browser recognition may already be stopped.
      }
    }
  }, []);

  useEffect(() => {
    setMicSupported(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  useEffect(() => () => {
    clearResetTimer();
    requestSequenceRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    invalidateRecognition();
    cancelSpeech();
  }, [cancelSpeech, clearResetTimer, invalidateRecognition]);

  const settleIdle = useCallback((delay = 500) => {
    clearResetTimer();
    resetTimer.current = setTimeout(() => {
      setOrbState("idle");
      setAvatarState("idle");
      setSpeechLevel(0);
      setPlaybackActive(false);
      setActiveAgent(null);
    }, delay);
  }, [clearResetTimer]);

  const speak = useCallback((text: string) => {
    clearResetTimer();
    const speechSequence = ++speechSequenceRef.current;

    setPlaybackActive(false);
    setSpeechLevel(0);

    if (
      !voiceEnabledState ||
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      settleIdle(300);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID";
    utterance.rate = 1.02;
    utterance.pitch = 0.94;

    const voices = window.speechSynthesis.getVoices();
    const indonesian = voices.find((voice) => voice.lang.toLowerCase().startsWith("id"));
    if (indonesian) utterance.voice = indonesian;

    utterance.onstart = () => {
      if (speechSequence !== speechSequenceRef.current) return;
      setOrbState("speaking");
      setAvatarState("speaking");
      setPlaybackActive(true);
      setSpeechLevel(1);
    };

    utterance.onpause = () => {
      if (speechSequence !== speechSequenceRef.current) return;
      setPlaybackActive(false);
      setSpeechLevel(0);
    };

    utterance.onresume = () => {
      if (speechSequence !== speechSequenceRef.current) return;
      setOrbState("speaking");
      setAvatarState("speaking");
      setPlaybackActive(true);
      setSpeechLevel(1);
    };

    utterance.onend = () => {
      if (speechSequence !== speechSequenceRef.current) return;
      setPlaybackActive(false);
      setSpeechLevel(0);
      settleIdle(350);
    };

    utterance.onerror = () => {
      if (speechSequence !== speechSequenceRef.current) return;
      setPlaybackActive(false);
      setSpeechLevel(0);
      settleIdle(500);
    };

    window.speechSynthesis.speak(utterance);
  }, [clearResetTimer, settleIdle, voiceEnabledState]);

  const send = useCallback(async (message: string) => {
    const value = message.trim();
    if (!value) throw new Error("ASTRA message is empty.");

    clearResetTimer();
    invalidateRecognition();
    cancelSpeech();

    const requestSequence = ++requestSequenceRef.current;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    setMicError(null);
    setOrbState("thinking");
    setAvatarState("thinking");
    setSpeechLevel(0);
    setPlaybackActive(false);
    setActiveAgent("Chief");

    const requestAt = Date.now();
    const localEvent: AstraBrainEvent = {
      id: `runtime-${requestSequence}-request`,
      type: "request.received",
      at: requestAt,
      agent: "chief_of_staff",
      visualNode: "chief_of_staff",
      label: "Request received",
      detail: "ASTRA Runtime forwarded the request to the Brain Adapter.",
    };
    setBrainEvents((current) => [...current, localEvent].slice(-24));
    setBrainTrace({
      n: ++brainTraceSequenceRef.current,
      trace: [{ helper: "chief_of_staff", type: localEvent.type, at: requestAt }],
    });

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: value }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`ASTRA request failed (${response.status})`);
      }

      const result = (await response.json()) as AstraBrainChatResult;

      if (requestSequence !== requestSequenceRef.current) {
        return result;
      }

      requestControllerRef.current = null;
      setLastResponse(result);
      setActiveAgent(result.agentName);
      setBrainProvider(result.brain.provider);
      setBrainEvents((current) => {
        const seen = new Set(current.map((event) => event.id));
        const merged = [...current];
        for (const event of result.brain.events) {
          if (!seen.has(event.id)) merged.push(event);
        }
        return merged.slice(-24);
      });
      setBrainTrace({
        n: ++brainTraceSequenceRef.current,
        trace: result.brain.visualNodes.map((helper, index) => ({
          helper,
          type: index === 0 ? "request.received" : "router.selected",
          at: Date.now() + index,
        })),
      });
      speak(result.message);
      return result;
    } catch (error) {
      if (requestSequence !== requestSequenceRef.current) {
        throw error;
      }

      requestControllerRef.current = null;
      if (error instanceof DOMException && error.name === "AbortError") {
        setOrbState("idle");
        setAvatarState("idle");
        setActiveAgent(null);
        throw error;
      }

      setOrbState("idle");
      setAvatarState("error");
      setSpeechLevel(0);
      setPlaybackActive(false);
      settleIdle(1500);
      throw error;
    }
  }, [cancelSpeech, clearResetTimer, invalidateRecognition, settleIdle, speak]);

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const beginListening = useCallback(() => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setMicSupported(false);
      setMicError("Browser ini tidak mendukung Speech Recognition.");
      return;
    }

    clearResetTimer();

    // Voice input is the newest interaction and therefore wins over stale work.
    requestSequenceRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    cancelSpeech();
    invalidateRecognition();

    setMicError(null);
    setMicTranscript("");
    setActiveAgent(null);

    const session = recognitionSessionRef.current;
    const recognition = new Recognition();
    recognition.lang = "id-ID";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    let submitted = false;
    let finalBuffer = "";

    recognition.onstart = () => {
      if (session !== recognitionSessionRef.current) return;
      setMicActive(true);
      setOrbState("idle");
      setAvatarState("listening");
    };

    recognition.onresult = (event) => {
      if (session !== recognitionSessionRef.current) return;

      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalBuffer += `${transcript} `;
        } else {
          interim += transcript;
        }
      }

      const display = `${finalBuffer}${interim}`.trim();
      setMicTranscript(display);

      const finalText = finalBuffer.trim();
      if (!submitted && finalText) {
        submitted = true;
        setMicActive(false);
        try {
          recognition.stop();
        } catch {
          // Recognition may already have ended after a final result.
        }
        void sendRef.current(finalText).catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setMicError(error instanceof Error ? error.message : "ASTRA request failed.");
        });
      }
    };

    recognition.onerror = (event) => {
      if (session !== recognitionSessionRef.current) return;
      const message = micErrorMessage(event.error);
      setMicActive(false);
      if (message) {
        setMicError(message);
        setAvatarState("error");
        settleIdle(1200);
      }
    };

    recognition.onend = () => {
      if (session !== recognitionSessionRef.current) return;
      recognitionRef.current = null;
      setMicActive(false);
      if (!submitted) {
        setAvatarState((current) => current === "listening" ? "idle" : current);
        setOrbState((current) => current === "idle" ? "idle" : current);
      }
    };

    try {
      recognition.start();
    } catch (error) {
      recognitionRef.current = null;
      setMicActive(false);
      setMicError(error instanceof Error ? error.message : "Mikrofon tidak dapat dimulai.");
      setAvatarState("error");
      settleIdle(1200);
    }
  }, [cancelSpeech, clearResetTimer, invalidateRecognition, settleIdle]);

  const endListening = useCallback(() => {
    clearResetTimer();
    const recognition = recognitionRef.current;
    recognitionSessionRef.current += 1;
    recognitionRef.current = null;
    setMicActive(false);

    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // Recognition may already be stopped.
      }
    }

    setAvatarState((current) => current === "listening" ? "idle" : current);
    setOrbState("idle");
  }, [clearResetTimer]);

  const stopInteraction = useCallback(() => {
    clearResetTimer();

    requestSequenceRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;

    invalidateRecognition();
    cancelSpeech();

    setMicError(null);
    setMicTranscript("");
    setOrbState("idle");
    setAvatarState("idle");
    setSpeechLevel(0);
    setPlaybackActive(false);
    setActiveAgent(null);
  }, [cancelSpeech, clearResetTimer, invalidateRecognition]);

  const setVoiceEnabled = useCallback((enabled: boolean) => {
    setVoiceEnabledState(enabled);
    if (!enabled) {
      cancelSpeech();
      settleIdle(120);
    }
  }, [cancelSpeech, settleIdle]);

  const value = useMemo(
    () => ({
      orbState,
      avatarState,
      speechLevel,
      playbackActive,
      voiceEnabled: voiceEnabledState,
      micSupported,
      micActive,
      micTranscript,
      micError,
      activeAgent,
      lastResponse,
      brainProvider,
      brainEvents,
      brainTrace,
      send,
      beginListening,
      endListening,
      stopInteraction,
      setAvatarState,
      setVoiceEnabled,
    }),
    [
      orbState,
      avatarState,
      speechLevel,
      playbackActive,
      voiceEnabledState,
      micSupported,
      micActive,
      micTranscript,
      micError,
      activeAgent,
      lastResponse,
      brainProvider,
      brainEvents,
      brainTrace,
      send,
      beginListening,
      endListening,
      stopInteraction,
      setVoiceEnabled,
    ],
  );

  return <AstraRuntimeContext.Provider value={value}>{children}</AstraRuntimeContext.Provider>;
}

export function useAstraRuntime() {
  const value = useContext(AstraRuntimeContext);
  if (!value) throw new Error("useAstraRuntime must be used inside AstraRuntimeProvider");
  return value;
}
