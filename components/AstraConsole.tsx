"use client";

import { FormEvent, useState } from "react";
import { useAstraRuntime } from "./AstraRuntime";
import BrainControls from "./BrainControls";

export default function AstraConsole() {
  const {
    orbState,
    activeAgent,
    lastResponse,
    send,
    beginListening,
    endListening,
    micSupported,
    micActive,
    micTranscript,
    micError,
    voiceEnabled,
    setVoiceEnabled,
    stopInteraction,
  } = useAstraRuntime();

  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runtimeBusy = busy || orbState === "thinking";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = message.trim();
    if (!value || runtimeBusy) return;

    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await send(value);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "ASTRA request failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = () => {
    setError(null);
    if (micActive) endListening();
    else beginListening();
  };

  return (
    <section className="astra-console" aria-label="ASTRA command console">
      <div className="astra-console__head">
        <div>
          <div className="astra-console__brand">ASTRA</div>
          <div className="astra-console__subtitle">PERSONAL AI CORE</div>
        </div>
        <div className={`astra-console__state astra-console__state--${orbState}`}>
          <span />
          {activeAgent ? `${activeAgent} · ${orbState}` : orbState}
        </div>
      </div>

      <div className="astra-console__output" aria-live="polite">
        {error || micError ? (
          <p className="astra-console__error">{error ?? micError}</p>
        ) : micActive || micTranscript ? (
          <>
            <div className="astra-console__agent">
              {micActive ? "MIC · LISTENING" : "VOICE INPUT"}
            </div>
            <p>{micTranscript || "Silakan bicara..."}</p>
          </>
        ) : lastResponse ? (
          <>
            <div className="astra-console__agent">{lastResponse.agentName}</div>
            <p>{lastResponse.message}</p>
          </>
        ) : (
          <p>Ketik perintah atau gunakan mikrofon untuk mengaktifkan ASTRA Core.</p>
        )}
      </div>

      <BrainControls />
      <form onSubmit={submit} className="astra-console__form">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Contoh: cek repo dan cari error..."
          aria-label="Perintah ASTRA"
          maxLength={4000}
          autoComplete="off"
        />

        <button
          type="button"
          onClick={toggleMic}
          disabled={!micSupported}
          aria-pressed={micActive}
          title={micSupported ? "Voice input" : "Speech Recognition tidak didukung browser ini"}
        >
          {micActive ? "STOP MIC" : micSupported ? "MIC" : "MIC N/A"}
        </button>

        <button
          type="button"
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          aria-pressed={voiceEnabled}
          title="Toggle ASTRA spoken responses"
        >
          {voiceEnabled ? "VOICE ON" : "VOICE OFF"}
        </button>

        <button type="submit" disabled={runtimeBusy || !message.trim()}>
          {runtimeBusy ? "RUNNING" : "SEND"}
        </button>
        <button type="button" onClick={stopInteraction}>STOP</button>
      </form>
    </section>
  );
}
