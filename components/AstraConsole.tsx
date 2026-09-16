"use client";

import { FormEvent, useState } from "react";
import { useAstraRuntime } from "./AstraRuntime";

export default function AstraConsole() {
  const { orbState, activeAgent, lastResponse, send } = useAstraRuntime();
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
          <div className="astra-console__subtitle">PERSONAL AI CORE</div>
        </div>
        <div className={`astra-console__state astra-console__state--${orbState}`}>
          <span />
          {activeAgent ? `${activeAgent} · ${orbState}` : orbState}
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
          <p>Ketik perintah untuk mengaktifkan ASTRA Core.</p>
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
