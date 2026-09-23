"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  AstraInputContext,
  AstraInputTrigger,
  AstraOrbState,
  AstraProviderChoice,
} from "@/lib/agent/types";
import type { AstraAvatarState } from "@/lib/avatar/types";
import type {
  AstraBrainChatResult,
  AstraBrainEvent,
  AstraBrainProvider,
  AstraBrainStatus,
} from "@/lib/brain/types";
import type {
  AstraAutomationOccurrenceRequest,
  AstraAutomationOccurrenceResult,
} from "@/lib/automation/approval";
import type {
  AstraAutomationServiceStatus,
} from "@/lib/automation/service";

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
  providerPreference: AstraProviderChoice;
  setProviderPreference: (provider: AstraProviderChoice) => void;
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
  brainStatus: AstraBrainStatus | null;
  brainEvents: AstraBrainEvent[];
  brainTrace: ReasoningTrace | null;
  brainStreaming: boolean;
  automationStreaming: boolean;
  automationServiceStatus: AstraAutomationServiceStatus | null;
  refreshAutomationServiceStatus: () => Promise<AstraAutomationServiceStatus | null>;
  runAutomationOccurrence: (
    request: AstraAutomationOccurrenceRequest,
  ) => Promise<AstraAutomationOccurrenceResult>;
  send: (
    message: string,
    options?: {
      mode?: "chat" | "execute";
      approved?: boolean;
      approvalToken?: string;
      provider?: AstraProviderChoice;
      inputContext?: AstraInputContext;
    },
  ) => Promise<AstraBrainChatResult>;
  execute: (
    message: string,
    provider?: AstraProviderChoice,
  ) => Promise<AstraBrainChatResult>;
  approve: (
    message: string,
    approvalToken: string,
    provider?: AstraProviderChoice,
  ) => Promise<AstraBrainChatResult>;
  beginListening: (trigger?: AstraInputTrigger) => void;
  endListening: () => void;
  stopInteraction: () => void;
  setAvatarState: (state: AstraAvatarState) => void;
  setVoiceEnabled: (enabled: boolean) => void;
};

function textInputContext(): AstraInputContext {
  return {
    source: "text",
    trigger: "keyboard",
    modalities: ["text"],
    consent: {
      microphone: false,
      camera: false,
      image: false,
      screen: false,
    },
    visualContentProvided: false,
  };
}

function voiceInputContext(trigger: AstraInputTrigger): AstraInputContext {
  const gestureTriggered = trigger === "gesture_open_palm";
  return {
    source: "voice",
    trigger,
    modalities: gestureTriggered
      ? ["voice", "gesture", "camera"]
      : ["voice"],
    consent: {
      microphone: true,
      camera: gestureTriggered,
      image: false,
      screen: false,
    },
    visualContentProvided: false,
  };
}

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
  const [providerPreference, setProviderState] = useState<AstraProviderChoice>("auto");
  const providerRef = useRef<AstraProviderChoice>("auto");
  const setProviderPreference = useCallback((value: AstraProviderChoice) => {
    if (!["auto", "ollama", "codex", "nvidia"].includes(value)) return;
    providerRef.current = value; setProviderState(value);
    try { localStorage.setItem("astra-provider", value); } catch { /* Storage may be disabled. */ }
  }, []);
  useEffect(() => {
    try {
      const value = localStorage.getItem("astra-provider");
      if (value === "auto" || value === "ollama" || value === "codex" || value === "nvidia") { providerRef.current = value; setProviderState(value); }
    } catch { /* Default AUTO remains usable. */ }
  }, []);
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
  const [brainStatus, setBrainStatus] = useState<AstraBrainStatus | null>(null);
  const [brainEvents, setBrainEvents] = useState<AstraBrainEvent[]>([]);
  const [brainTrace, setBrainTrace] = useState<ReasoningTrace | null>(null);
  const [brainStreaming, setBrainStreaming] = useState(false);
  const [automationStreaming, setAutomationStreaming] = useState(false);
  const [automationServiceStatus, setAutomationServiceStatus] =
    useState<AstraAutomationServiceStatus | null>(null);

  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionSessionRef = useRef(0);
  const requestSequenceRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const speechSequenceRef = useRef(0);
  const brainTraceSequenceRef = useRef(0);
  const sendRef = useRef<(
    message: string,
    inputContext?: AstraInputContext,
  ) => Promise<AstraBrainChatResult>>(async () => {
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

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/agent", { method: "GET", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as AstraBrainStatus;
      })
      .then((status) => {
        if (cancelled || !status) return;
        setBrainStatus(status);
        setBrainProvider(status.provider);
      })
      .catch(() => {
        // Chat still has routing-only fallback if the status request itself fails.
      });

    return () => {
      cancelled = true;
    };
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

  const appendRuntimeBrainEvent = useCallback((
    event: AstraBrainEvent,
    expectedRequestSequence?: number,
    updateActiveAgent = true,
  ) => {
    if (
      expectedRequestSequence !== undefined &&
      expectedRequestSequence !== requestSequenceRef.current
    ) {
      return;
    }

    setBrainEvents((current) => {
      if (current.some((item) => item.id === event.id)) return current;
      return [...current, event].slice(-24);
    });

    if (event.provider) {
      setBrainProvider(event.provider);
    }

    if (updateActiveAgent && event.agent) {
      setActiveAgent(
        event.agent
          .split("_")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" "),
      );
    }

    if (event.visualNode) {
      setBrainTrace({
        n: ++brainTraceSequenceRef.current,
        trace: [{
          helper: event.visualNode,
          type: event.type,
          at: event.at,
        }],
      });
    }
  }, []);

  const refreshAutomationServiceStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/automation/service", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) return null;

      const payload = (await response.json()) as {
        service?: AstraAutomationServiceStatus;
      };
      const status = payload.service ?? null;
      setAutomationServiceStatus(status);
      return status;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let source: EventSource | null = null;

    void refreshAutomationServiceStatus().then((status) => {
      if (disposed || !status?.enabled) return;

      source = new EventSource("/api/automation/service/stream");

      source.addEventListener("brain", (event) => {
        if (disposed) return;
        try {
          appendRuntimeBrainEvent(
            JSON.parse((event as MessageEvent<string>).data) as AstraBrainEvent,
            undefined,
            false,
          );
        } catch {
          // Ignore malformed telemetry frames; service status remains truthful.
        }
      });

      source.addEventListener("status", (event) => {
        if (disposed) return;
        try {
          setAutomationServiceStatus(
            JSON.parse(
              (event as MessageEvent<string>).data,
            ) as AstraAutomationServiceStatus,
          );
        } catch {
          // Keep the last known service state.
        }
      });
    });

    return () => {
      disposed = true;
      source?.close();
    };
  }, [appendRuntimeBrainEvent, refreshAutomationServiceStatus]);

  const stopAutomationServiceActive = useCallback(() => {
    void fetch("/api/automation/service", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-astra-client": "1",
      },
      body: JSON.stringify({ action: "stop-active" }),
    })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as {
          service?: AstraAutomationServiceStatus;
        };
        if (payload.service) {
          setAutomationServiceStatus(payload.service);
        }
      })
      .catch(() => {
        // Local STOP remains effective for browser-owned work even if the
        // service status call itself is unavailable.
      });
  }, []);

  const send = useCallback(async (
    message: string,
    options?: {
      mode?: "chat" | "execute";
      approved?: boolean;
      approvalToken?: string;
      provider?: AstraProviderChoice;
      inputContext?: AstraInputContext;
    },
  ) => {
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
    setLastResponse(null);
    setOrbState("thinking");
    setAvatarState("thinking");
    setSpeechLevel(0);
    setPlaybackActive(false);
    setActiveAgent("Chief");

    let streamedEventCount = 0;

    const appendBrainEvent = (event: AstraBrainEvent) => {
      if (requestSequence !== requestSequenceRef.current) return;
      streamedEventCount += 1;
      appendRuntimeBrainEvent(event, requestSequence);
    };

    try {
      setBrainStreaming(true);
      const response = await fetch("/api/agent/stream", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          "x-astra-client": "1",
        },
        body: JSON.stringify({
          message: value,
          mode: options?.mode ?? "chat",
          approved: Boolean(options?.approved),
          approvalToken: options?.approvalToken,
          provider: options?.provider ?? providerRef.current,
          inputContext: options?.inputContext ?? textInputContext(),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`ASTRA stream failed (${response.status})`);
      }

      if (!response.body) {
        throw new Error("ASTRA streaming response body is unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const streamState: { result: AstraBrainChatResult | null } = {
        result: null,
      };

      const handleBlock = (rawBlock: string) => {
        const block = rawBlock.replace(/\r/g, "").trim();
        if (!block) return;

        let eventName = "message";
        const dataLines: string[] = [];

        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trimStart());
          }
        }

        if (dataLines.length === 0) return;
        const payload = JSON.parse(dataLines.join("\n")) as unknown;

        if (eventName === "brain") {
          appendBrainEvent(payload as AstraBrainEvent);
          return;
        }

        if (eventName === "result") {
          streamState.result = payload as AstraBrainChatResult;
          return;
        }

        if (eventName === "error") {
          const errorPayload = payload as { message?: string };
          throw new Error(errorPayload.message || "ASTRA Brain stream failed.");
        }
      };

      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;

        buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r/g, "");
        let boundary = buffer.indexOf("\n\n");

        while (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          handleBlock(block);
          boundary = buffer.indexOf("\n\n");
        }
      }

      buffer += decoder.decode().replace(/\r/g, "");
      if (buffer.trim()) handleBlock(buffer);

      const finalResult = streamState.result;
      if (!finalResult) {
        throw new Error("ASTRA stream ended without a final result.");
      }

      if (requestSequence !== requestSequenceRef.current) {
        return finalResult;
      }

      requestControllerRef.current = null;
      setBrainStreaming(false);
      setLastResponse(finalResult);
      setActiveAgent(finalResult.agentName);
      setBrainProvider(finalResult.brain.provider);

      // V15 normally receives lifecycle events live. If a provider/path emits
      // no streaming callbacks, retain V14 compatibility by applying the final
      // event envelope only after the real response arrives.
      if (streamedEventCount === 0) {
        setBrainEvents((current) => [...current, ...finalResult.brain.events].slice(-24));
        const eventTrace = finalResult.brain.events
          .filter((event) => Boolean(event.visualNode))
          .map((event) => ({
            helper: event.visualNode as string,
            type: event.type,
            at: event.at,
          }));

        if (eventTrace.length > 0) {
          setBrainTrace({
            n: ++brainTraceSequenceRef.current,
            trace: eventTrace,
          });
        }
      }

      setBrainStatus((current) => {
        const provider = finalResult.brain.provider;
        const mode =
          provider === "cloud" || provider === "nvidia"
            ? "cloud"
            : provider === "routing_only"
              ? "routing_only"
              : "local";

        const providerName =
          provider === "routing_only"
            ? "Routing-only fallback"
            : provider === "ollama"
              ? "Ollama"
              : provider === "codex"
                ? "Codex"
                : provider === "hermes"
                  ? "Hermes"
                  : provider === "nvidia"
                    ? "NVIDIA JARVIS Mesh"
                    : "Cloud";

        return {
          ready: true,
          provider,
          mode,
          detail:
            provider === "routing_only"
              ? "ASTRA used routing-only fallback for the latest request."
              : `${providerName} handled the latest ASTRA request via live telemetry.`,
          endpoint:
            provider === "nvidia"
              ? current?.features?.nvidia?.endpoint
              : current?.endpoint,
          model:
            finalResult.brain.model ??
            (provider === "nvidia"
              ? current?.features?.nvidia?.model
              : current?.model),
          fallback: current?.fallback ?? "routing_only",
          permissions: finalResult.brain.permissions ?? current?.permissions,
          features: current?.features,
        };
      });
      speak(finalResult.message);
      return finalResult;
    } catch (error) {
      if (requestSequence !== requestSequenceRef.current) {
        throw error;
      }

      requestControllerRef.current = null;
      setBrainStreaming(false);
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
  }, [
    appendRuntimeBrainEvent,
    cancelSpeech,
    clearResetTimer,
    invalidateRecognition,
    settleIdle,
    speak,
  ]);

  const execute = useCallback(
    (message: string, provider?: AstraProviderChoice) =>
      send(message, { mode: "execute", approved: true, provider }),
    [send],
  );

  const approve = useCallback(
    (
      message: string,
      approvalToken: string,
      provider?: AstraProviderChoice,
    ) =>
      send(message, {
        mode: "execute",
        approved: true,
        approvalToken,
        provider,
      }),
    [send],
  );

  const runAutomationOccurrence = useCallback(async (
    request: AstraAutomationOccurrenceRequest,
  ): Promise<AstraAutomationOccurrenceResult> => {
    clearResetTimer();
    invalidateRecognition();
    cancelSpeech();

    const requestSequence = ++requestSequenceRef.current;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    setMicError(null);
    setLastResponse(null);
    setOrbState("thinking");
    setAvatarState("thinking");
    setSpeechLevel(0);
    setPlaybackActive(false);
    setActiveAgent("Ops");
    setBrainStreaming(true);
    setAutomationStreaming(true);

    try {
      const response = await fetch("/api/automation/run/stream", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          "x-astra-client": "1",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`ASTRA automation stream failed (${response.status})`);
      }
      if (!response.body) {
        throw new Error("ASTRA automation streaming body is unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result: AstraAutomationOccurrenceResult | null = null;

      const handleBlock = (rawBlock: string) => {
        const block = rawBlock.replace(/\r/g, "").trim();
        if (!block) return;

        let eventName = "message";
        const dataLines: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trimStart());
          }
        }

        if (dataLines.length === 0) return;
        const payload = JSON.parse(dataLines.join("\n")) as unknown;

        if (eventName === "brain") {
          appendRuntimeBrainEvent(
            payload as AstraBrainEvent,
            requestSequence,
          );
          return;
        }
        if (eventName === "result") {
          result = payload as AstraAutomationOccurrenceResult;
          return;
        }
        if (eventName === "error") {
          const errorPayload = payload as { message?: string };
          throw new Error(
            errorPayload.message || "ASTRA automation stream failed.",
          );
        }
      };

      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;

        buffer += decoder
          .decode(chunk.value, { stream: true })
          .replace(/\r/g, "");

        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          handleBlock(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");
        }
      }

      buffer += decoder.decode().replace(/\r/g, "");
      if (buffer.trim()) handleBlock(buffer);

      if (!result) {
        throw new Error(
          "ASTRA automation stream ended without a final result.",
        );
      }

      const finalResult = result as AstraAutomationOccurrenceResult;
      if (requestSequence !== requestSequenceRef.current) {
        return finalResult;
      }

      requestControllerRef.current = null;
      setBrainStreaming(false);
      setAutomationStreaming(false);

      if (finalResult.brain) {
        setLastResponse(finalResult.brain);
        setBrainProvider(finalResult.brain.brain.provider);
      }

      if (
        finalResult.status === "completed" ||
        finalResult.status === "waiting_occurrence_approval" ||
        finalResult.status === "waiting_level3_approval"
      ) {
        setOrbState("idle");
        setAvatarState("idle");
        setActiveAgent(
          finalResult.status === "completed" ? null : "Ops",
        );
      } else {
        setOrbState("idle");
        setAvatarState(
          finalResult.status === "cancelled" ? "idle" : "error",
        );
        settleIdle(
          finalResult.status === "cancelled" ? 120 : 1200,
        );
      }

      return finalResult;
    } catch (error) {
      if (requestSequence !== requestSequenceRef.current) {
        throw error;
      }

      requestControllerRef.current = null;
      setBrainStreaming(false);
      setAutomationStreaming(false);

      if (error instanceof DOMException && error.name === "AbortError") {
        setOrbState("idle");
        setAvatarState("idle");
        setActiveAgent(null);
        throw error;
      }

      setOrbState("idle");
      setAvatarState("error");
      setActiveAgent("Ops");
      settleIdle(1500);
      throw error;
    }
  }, [
    appendRuntimeBrainEvent,
    cancelSpeech,
    clearResetTimer,
    invalidateRecognition,
    settleIdle,
  ]);

  useEffect(() => {
    sendRef.current = (message: string, inputContext?: AstraInputContext) =>
      send(message, { inputContext });
  }, [send]);

  const beginListening = useCallback((trigger: AstraInputTrigger = "microphone") => {
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
        void sendRef.current(
          finalText,
          voiceInputContext(trigger),
        ).catch((error) => {
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
    stopAutomationServiceActive();

    invalidateRecognition();
    cancelSpeech();

    setMicError(null);
    setMicTranscript("");
    setOrbState("idle");
    setAvatarState("idle");
    setSpeechLevel(0);
    setPlaybackActive(false);
    setActiveAgent(null);
    setBrainStreaming(false);
    setAutomationStreaming(false);
  }, [
    cancelSpeech,
    clearResetTimer,
    invalidateRecognition,
    stopAutomationServiceActive,
  ]);

  const setVoiceEnabled = useCallback((enabled: boolean) => {
    setVoiceEnabledState(enabled);
    if (!enabled) {
      cancelSpeech();
      settleIdle(120);
    }
  }, [cancelSpeech, settleIdle]);

  const value = useMemo(
    () => ({
      providerPreference,
      setProviderPreference,
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
      brainStatus,
      brainEvents,
      brainTrace,
      brainStreaming,
      automationStreaming,
      automationServiceStatus,
      refreshAutomationServiceStatus,
      runAutomationOccurrence,
      send,
      execute,
      approve,
      beginListening,
      endListening,
      stopInteraction,
      setAvatarState,
      setVoiceEnabled,
    }),
    [
      providerPreference,
      setProviderPreference,
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
      brainStatus,
      brainEvents,
      brainTrace,
      brainStreaming,
      automationStreaming,
      automationServiceStatus,
      refreshAutomationServiceStatus,
      runAutomationOccurrence,
      send,
      execute,
      approve,
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
