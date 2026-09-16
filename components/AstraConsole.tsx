"use client";

import { FormEvent, useState } from "react";
import { useAstraRuntime } from "./AstraRuntime";

export default function AstraConsole() {
  const {
    avatarState,
    activeAgent,
    lastResponse,
    send,
    voiceEnabled,
    setVoiceEnabled,
  } = useAstraRuntime();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = message.trim();
    if (!value || busy) return;

    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await send(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ASTRA request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="astra-console" aria-label="ASTRA command console">
      <div className="astra-console__head">
        <div>
          <div className="astra-console__brand">ASTRA</div>
          <div className="astra-console__subtitle">LIVE HUMANOID CORE</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            aria-pressed={voiceEnabled}
            title="Toggle ASTRA voice"
            style={{
              border: "1px solid rgba(78,228,255,.24)",
              background: voiceEnabled ? "rgba(0,229,255,.09)" : "rgba(255,255,255,.025)",
              color: voiceEnabled ? "rgba(117,242,255,.92)" : "rgba(255,255,255,.42)",
              borderRadius: 5,
              padding: "5px 8px",
              fontFamily: "var(--font-mono)",
              fontSize: 8,
              letterSpacing: ".12em",
              cursor: "pointer",
            }}
          >
            VOICE {voiceEnabled ? "ON" : "OFF"}
          </button>
          <div className={`astra-console__state astra-console__state--${avatarState}`}>
            <span />
            {activeAgent ? `${activeAgent} · ${avatarState}` : avatarState}
          </div>
        </div>
      </div>

      <div className="astra-console__output" aria-live="polite">
        {error ? (
          <p className="astra-console__error">{error}</p>
        ) : lastResponse ? (
          <>
            <div className="astra-console__agent">{lastResponse.agentName}</div>
            <p>{lastResponse.message}</p>
          </>
        ) : (
          <p>Ketik perintah. Humanoid akan bereaksi mengikuti state ASTRA.</p>
        )}
      </div>

      <form onSubmit={submit} className="astra-console__form">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Contoh: cek repo dan cari error..."
          aria-label="Perintah ASTRA"
          maxLength={4000}
          autoComplete="off"
        />
        <button type="submit" disabled={busy || !message.trim()}>
          {busy ? "RUNNING" : "SEND"}
        </button>
      </form>
    </section>
  );
}
