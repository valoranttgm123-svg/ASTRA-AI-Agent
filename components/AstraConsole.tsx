"use client";

import { FormEvent, useState } from "react";
import type {
  AstraApprovalRequest,
  AstraProviderChoice,
} from "@/lib/agent/types";
import { useAstraRuntime } from "./AstraRuntime";

type PendingExecution = {
  message: string;
  provider: AstraProviderChoice;
};

function ApprovalPanel({
  approval,
  busy,
  onApprove,
  onCancel,
}: {
  approval: AstraApprovalRequest;
  busy: boolean;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const scope = Object.entries(approval.scope);
  const expires = new Date(approval.expiresAt).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="astra-console__approval" role="alert">
      <div className="astra-console__approval-head">
        LEVEL 3 · EXTERNAL ACTION
      </div>
      <p>{approval.title}</p>
      <div className="astra-console__approval-meta">
        <span>TOOL · {approval.toolId}</span>
        {approval.projectId ? (
          <span>PROJECT · {approval.projectId}</span>
        ) : null}
        <span>EXPIRES · {expires}</span>
      </div>

      {scope.length > 0 ? (
        <div className="astra-console__approval-scope">
          {scope.map(([key, value]) => (
            <span key={key}>
              {key.toUpperCase()} · {String(value)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="astra-console__approval-actions">
        <button
          type="button"
          onClick={onApprove}
          disabled={busy}
          title="Approve only this exact Level-3 action"
        >
          {busy ? "APPROVING" : "APPROVE LEVEL 3"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          title="Do not execute this external action"
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

export default function AstraConsole() {
  const {
    orbState,
    activeAgent,
    lastResponse,
    send,
    execute,
    approve,
    beginListening,
    endListening,
    micSupported,
    micActive,
    micTranscript,
    micError,
    voiceEnabled,
    setVoiceEnabled,
  } = useAstraRuntime();

  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<AstraProviderChoice>("auto");
  const [pendingExecution, setPendingExecution] =
    useState<PendingExecution | null>(null);

  const runtimeBusy = busy || orbState === "thinking";
  const approval =
    pendingExecution && lastResponse?.approvalRequest
      ? lastResponse.approvalRequest
      : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = message.trim();
    if (!value || runtimeBusy) return;

    setBusy(true);
    setError(null);
    setPendingExecution(null);
    setMessage("");
    try {
      await send(value, { provider });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "ASTRA request failed");
    } finally {
      setBusy(false);
    }
  };

  const executeTask = async () => {
    const value = message.trim();
    if (!value || runtimeBusy) return;

    const requestProvider = provider;
    setBusy(true);
    setError(null);
    setPendingExecution(null);
    setMessage("");
    try {
      const result = await execute(value, requestProvider);
      if (result.approvalRequest) {
        setPendingExecution({
          message: value,
          provider: requestProvider,
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "ASTRA execution failed");
    } finally {
      setBusy(false);
    }
  };

  const approveLevel3 = async () => {
    if (!approval || !pendingExecution || runtimeBusy) return;

    setBusy(true);
    setError(null);
    try {
      const result = await approve(
        pendingExecution.message,
        approval.token,
        pendingExecution.provider,
      );

      if (result.approvalRequest) {
        setPendingExecution((current) =>
          current
            ? {
                message: current.message,
                provider: current.provider,
              }
            : null,
        );
      } else {
        setPendingExecution(null);
      }
    } catch (err) {
      setPendingExecution(null);
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(
        err instanceof Error
          ? err.message
          : "ASTRA Level-3 approval failed",
      );
    } finally {
      setBusy(false);
    }
  };

  const cancelApproval = () => {
    setPendingExecution(null);
    setError(null);
  };

  const toggleMic = () => {
    setError(null);
    setPendingExecution(null);
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
            <div className="astra-console__agent">
              {lastResponse.agentName} ·{" "}
              {lastResponse.brain.execution.toUpperCase()}
            </div>
            <p>{lastResponse.message}</p>
            {approval ? (
              <ApprovalPanel
                approval={approval}
                busy={runtimeBusy}
                onApprove={() => void approveLevel3()}
                onCancel={cancelApproval}
              />
            ) : null}
          </>
        ) : (
          <p>
            Ketik perintah atau gunakan mikrofon untuk mengaktifkan ASTRA Core.
          </p>
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

        <select
          value={provider}
          onChange={(event) =>
            setProvider(event.target.value as AstraProviderChoice)
          }
          aria-label="Provider AI"
          title="Auto memilih rute lokal; Ollama untuk chat privat; Codex untuk engineering; NVIDIA Nemotron Ultra untuk reasoning cloud opsional"
        >
          <option value="auto">AUTO</option>
          <option value="ollama">OLLAMA</option>
          <option value="codex">CHATGPT / CODEX</option>
          <option value="nvidia">NVIDIA · NEMOTRON ULTRA</option>
        </select>

        <button
          type="button"
          onClick={toggleMic}
          disabled={!micSupported}
          aria-pressed={micActive}
          title={
            micSupported
              ? "Voice input"
              : "Speech Recognition tidak didukung browser ini"
          }
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

        <button
          type="button"
          onClick={() => void executeTask()}
          disabled={runtimeBusy || !message.trim()}
          title="Approve Level-2 safe-local execution only"
        >
          {runtimeBusy ? "RUNNING" : "EXECUTE TASK"}
        </button>

        <button type="submit" disabled={runtimeBusy || !message.trim()}>
          {runtimeBusy ? "RUNNING" : "SEND"}
        </button>
      </form>
    </section>
  );
}
