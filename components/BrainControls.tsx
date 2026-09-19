"use client";
import { useState } from "react";
import { useAstraRuntime } from "./AstraRuntime";
import type { ProviderChoice } from "@/lib/brain/types";
export default function BrainControls() {
  const runtime = useAstraRuntime();
  const [tool, setTool] = useState("project.list_files"), [args, setArgs] = useState("{}");
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>) => {
    setError(null); setBusy(true);
    try { await action(); } catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : "Tindakan gagal."); }
    finally { setBusy(false); }
  };
  const models = runtime.brainStatus?.providers.find(p => p.provider === "ollama")?.models || [];
  const tasks = [...new Set(runtime.brainEvents.map(e => e.requestId))].reverse().slice(0, 12);
  const [selectedTask, setSelectedTask] = useState("");
  const task = tasks.includes(selectedTask) ? selectedTask : tasks[0];
  const events = runtime.brainEvents.filter(e => e.requestId === task);
  const toolInfo = runtime.brainStatus?.tools.find(t => t.name === tool);
  return <div className="brain-controls">
    {runtime.pendingRequest && runtime.lastResponse?.brain.approval && <section className="brain-approval" aria-label="Persetujuan tindakan">
      <strong>{runtime.lastResponse.brain.approval.label}</strong>
      <p>{runtime.lastResponse.brain.approval.detail}</p>
      <pre>{runtime.pendingRequest.tool ? JSON.stringify(runtime.pendingRequest.tool, null, 2) : runtime.pendingRequest.message}</pre>
      <button disabled={busy} onClick={() => void run(runtime.approveRequest)}>Setujui sekali</button>
      <button onClick={runtime.dismissApproval}>Tolak</button>
    </section>}
    <details>
      <summary>Provider, proyek, dan tool</summary>
      <div className="brain-settings">
        <label>Proyek<select value={runtime.projectId} onChange={e => runtime.setProjectId(e.target.value)}>{runtime.brainStatus?.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Provider<select value={runtime.providerChoice} onChange={e => runtime.setProviderChoice(e.target.value as ProviderChoice)}>
          <option value="auto">Otomatis · lokal</option><option value="ollama">Ollama</option><option value="hermes">Hermes</option><option value="codex">Codex · ChatGPT</option>
        </select></label>
        {runtime.providerChoice === "ollama" && <label>Model lokal<select value={runtime.selectedModel} onChange={e => runtime.setSelectedModel(e.target.value)}><option value="">Default server</option>{models.map(m => <option key={m}>{m}</option>)}</select></label>}
        {runtime.providerChoice === "codex" && <p>Codex mengirim tugas ke ChatGPT, bukan model lokal. Persetujuan diperlukan sebelum mengirim.</p>}
        <button disabled={busy} onClick={() => void run(runtime.refreshStatus)}>Perbarui status</button>
        <ul className="brain-health">{runtime.brainStatus?.providers.map(p => <li key={p.provider}><strong>{p.provider}: {p.available ? "terjangkau" : "belum tersedia"}</strong><span>{p.detail}</span></li>)}</ul>
        <label>Tool<select value={tool} onChange={e => {
          setTool(e.target.value);
          const schema = runtime.brainStatus?.tools.find(t => t.name === e.target.value)?.inputSchema;
          const fields = schema?.properties as Record<string, unknown> | undefined;
          setArgs(JSON.stringify(Object.fromEntries(Object.keys(fields || {}).map(k => [k, ""])), null, 2));
        }}>{runtime.brainStatus?.tools.map(t => <option key={t.name} value={t.name}>{t.name}{t.requiresApproval ? " · izin" : " · baca"}</option>)}</select></label>
        <p>{toolInfo?.description}</p>
        <label>Argumen tool (JSON)<textarea value={args} onChange={e => setArgs(e.target.value)} maxLength={6000} rows={3} /></label>
        <button disabled={busy || runtime.orbState === "thinking"} onClick={() => void run(() => runtime.send("Jalankan " + tool, { tool: { name: tool, arguments: JSON.parse(args) } }))}>Jalankan tool</button>
        {runtime.brainStatus?.codexWriteEnabled && runtime.providerChoice === "codex" && <label>Mode Codex<select value={runtime.codexMode} onChange={e => runtime.setCodexMode(e.target.value as "read-only" | "workspace-write")}><option value="read-only">Baca saja</option><option value="workspace-write">Tulis dalam proyek · izin per tugas</option></select></label>}
        <p className="brain-privacy">Memori disimpan hanya melalui memory.save. Tidak ada penyimpanan transkrip otomatis. Pengenalan suara browser dapat memakai layanan daring.</p>
      </div>
    </details>
    <details>
      <summary>Alur tugas · {events.length} event nyata</summary>
      <label className="brain-task-select">Task<select value={task || ""} onChange={e => setSelectedTask(e.target.value)}>{tasks.map((id,i) => <option key={id} value={id}>Task {tasks.length-i} · {id.slice(0,8)}</option>)}</select></label>
      {!events.length ? <p>Belum ada pekerjaan dijalankan.</p> : <ol className="brain-timeline">{events.map(e => <li key={e.id} data-event={e.type}><time>+{((e.at - events[0].at)/1000).toFixed(1)}s</time><div><strong>{e.label}</strong>{e.tool && <code>{e.tool}</code>}{e.detail && <p>{e.detail}</p>}</div></li>)}</ol>}
      {runtime.lastResponse?.brain.sources?.length ? <p>Sumber konteks: {runtime.lastResponse.brain.sources.join(", ")}</p> : null}
      <p className="brain-privacy">Riwayat event hanya di tab ini. Ini catatan eksekusi, bukan isi penalaran internal.</p>
    </details>
    {error && <p role="alert" className="astra-console__error">{error}</p>}
  </div>;
}
