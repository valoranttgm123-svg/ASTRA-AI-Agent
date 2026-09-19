import { randomUUID } from "node:crypto";
import { selectAgent } from "@/lib/agent/orchestrator";
import { ASTRA_AGENT_MAP } from "@/lib/agent/roster";
import type { AstraAgentKey } from "@/lib/agent/types";
import { chatWithHermes, getHermesStatus } from "./hermes";
import { chatWithOllama, getOllamaStatus } from "./ollama";
import { chatWithCodex, getCodexStatus } from "./codex";
import { projects, getProject, redact } from "./projects";
import { retrieveContext } from "./memory";
import { discoverTools, toolPolicy, executeTool } from "./tools";
import { requireApproval } from "./approvals";
import { abortIfNeeded, flag } from "./config";
import type { AstraBrain, BrainRequest, BrainOptions, AstraBrainChatResult, AstraBrainEvent, AstraBrainEventType, AstraBrainStatus, AstraBrainProvider, ToolCall } from "./types";

const VISUAL: Record<AstraAgentKey, string> = {
  chief_of_staff: "chief_of_staff", memory: "memory", researcher: "researcher",
  developer: "engineering", computer: "ops", files: "drive", github: "developer",
  communication: "email", business: "ops", trading: "finance",
};

function needsProjectContext(input: string) {
  return /\b(?:project|proyek|roadmap|document|dokumen|memory|memori|history|riwayat|handoff|architecture|arsitektur|decision|keputusan)\b/i.test(input);
}
export class LocalPreferredBrainAdapter implements AstraBrain {
  async status(): Promise<AstraBrainStatus> {
    const [hermes, ollama, codex, registry] = await Promise.all([getHermesStatus(), getOllamaStatus(), getCodexStatus(), discoverTools()]);
    const provider = hermes.available && flag("ASTRA_HERMES_AGENT_APPROVAL") ? "hermes" : ollama.available ? "ollama" : "routing_only";
    return {
      ready: true, provider, mode: provider === "routing_only" ? "routing_only" : "local",
      detail: [hermes.detail, ollama.detail, ...registry.errors].join(" "),
      model: provider === "hermes" ? hermes.model : ollama.model,
      providers: [
        { provider: "hermes", ...hermes },
        { provider: "ollama", available: ollama.available, detail: ollama.detail, model: ollama.model, models: ollama.installedModels },
        codex,
      ],
      projects: projects().map(({ id, name }) => ({ id, name })),
      tools: registry.tools, codexWriteEnabled: flag("ASTRA_ALLOW_CODEX_WRITE"),
    };
  }
  async chat(request: BrainRequest, options: BrainOptions = {}): Promise<AstraBrainChatResult> {
    const requestId = options.requestId || randomUUID();
    const selected = request.tool?.name.startsWith("memory.") ? "memory" : request.tool ? "files" : selectAgent(request.message);
    const agent = ASTRA_AGENT_MAP[selected];
    const route: AstraAgentKey[] = selected === "chief_of_staff" ? ["chief_of_staff"] : ["chief_of_staff", selected];
    const events: AstraBrainEvent[] = [];
    let provider: AstraBrainProvider = "routing_only";
    let sources: string[] = [], model: string | undefined;
    const emit = (type: AstraBrainEventType, label: string, detail?: string, node = VISUAL[selected], tool?: string) => {
      const event: AstraBrainEvent = { id: randomUUID(), requestId, type, at: Date.now(), agent: selected, visualNode: node, label, detail, tool };
      events.push(event); options.emit?.(event);
    };
    const finish = (message: string, state: AstraBrainChatResult["state"], execution: AstraBrainChatResult["brain"]["execution"], approval?: AstraBrainChatResult["brain"]["approval"]): AstraBrainChatResult => {
      if (!approval) emit("response.ready", "Jawaban siap", state === "completed" ? "Permintaan selesai; bukti tindakan hanya dari event tool." : "Eksekusi belum selesai.");
      return { ok: state !== "error", agent: selected, agentName: agent.name, state, message,
        requiresApproval: Boolean(approval),
        brain: { requestId, provider, execution, route, visualNodes: route.map(a => VISUAL[a]), events, model, sources, approval },
      };
    };
    const approve = (label: string, detail: string) => {
      const approval = requireApproval(request, label, detail);
      if (approval) { emit("approval.required", label, detail); return finish(detail, "needs_provider", "blocked", approval); }
      emit("approval.granted", "Persetujuan diterima", "Berlaku satu kali untuk permintaan yang sama."); return null;
    };
    emit("request.received", "Permintaan diterima", undefined, "chief_of_staff");
    emit("router.selected", agent.name + " dipilih");
    try {
      abortIfNeeded(options.signal);
      const project = await getProject(request.projectId);
      const runTool = async (call: ToolCall) => {
        if (!call.arguments || typeof call.arguments !== "object" || Array.isArray(call.arguments)) throw new Error("Argumen tool harus berupa objek.");
        emit("tool.started", "Tool dimulai", undefined, call.name.startsWith("memory.") ? "memory" : "drive", call.name);
        try {
          const result = await executeTool(call, project, options.signal);
          emit(call.name === "memory.save" ? "memory.saved" : "tool.completed", "Tool selesai", undefined, call.name.startsWith("memory.") ? "memory" : "drive", call.name);
          return result;
        } catch (error) { emit("tool.error", "Tool gagal", undefined, "drive", call.name); throw error; }
      };
      if (request.tool) {
        provider = "tools";
        const policy = toolPolicy(request.tool.name);
        if (policy.requiresApproval) {
          const blocked = approve("Setujui " + request.tool.name, "Izinkan satu tindakan ini pada proyek " + project.name + ". Periksa argumen sebelum menyetujui.");
          if (blocked) return blocked;
        }
        emit("agent.started", "Eksekusi tool");
        const message = await runTool(request.tool);
        emit("agent.completed", "Eksekusi tool selesai");
        return finish(message, "completed", "executed");
      }
      const useProjectContext = needsProjectContext(request.message);
      const context = useProjectContext
        ? await retrieveContext(project, request.message, options.signal)
        : { text: "", sources: [] as string[], chars: 0 };
      sources = context.sources;
      emit(
        "memory.retrieved",
        useProjectContext ? "Konteks proyek dibaca" : "Konteks proyek tidak diperlukan",
        sources.length + " sumber, " + context.chars + " karakter; referensi, bukan bukti penyelesaian.",
        "memory",
      );

      // Explicit provider/model selection never silently changes or invokes cloud.
      if (request.provider === "auto") {
        const [h, o] = await Promise.all([getHermesStatus(), getOllamaStatus()]);
        if (!h.available) emit("provider.unavailable", "Hermes belum tersedia", h.detail);
        provider = h.available && flag("ASTRA_HERMES_AGENT_APPROVAL") ? "hermes" : o.available ? "ollama" : "routing_only";
        if (!o.available && provider === "routing_only") emit("provider.unavailable", "Ollama belum tersedia", o.detail);
      } else provider = request.provider;
      abortIfNeeded(options.signal);
      if (provider === "routing_only") {
        emit("agent.blocked", "Provider belum tersambung");
        return finish("Hermes/Ollama belum tersedia. Tool baca proyek dan memori tetap dapat dipakai. Tidak ada tindakan eksternal yang dijalankan.", "needs_provider", "routing_only");
      }
      if (provider === "codex") {
        const health = await getCodexStatus();
        if (!health.available) { emit("agent.blocked", "Codex belum tersedia", health.detail); return finish(health.detail, "needs_provider", "blocked"); }
        const blocked = approve("Kirim tugas ke Codex", "Tugas dan konteks proyek akan dikirim melalui akun ChatGPT CLI. Mode: " + (request.codexMode || "read-only") + ". Ini bukan inferensi lokal.");
        if (blocked) return blocked;
      }
      if (provider === "hermes") {
        // The gateway owns its tools. A prompt alone is NOT a permission boundary.
        if (!flag("ASTRA_HERMES_AGENT_APPROVAL")) {
          emit("agent.blocked", "Gateway Hermes perlu kebijakan izin");
          return finish("Gateway Hermes terdeteksi, tetapi eksekusi agen belum diaktifkan. Gunakan Ollama atau aktifkan ASTRA_HERMES_AGENT_APPROVAL pada server setelah meninjau izin gateway.", "needs_provider", "blocked");
        }
        const blocked = approve("Jalankan satu tugas Hermes", "Hermes memakai izin tool milik gateway. Setujui hanya jika gateway dan lingkup tugas ini dipercaya. ASTRA tidak mengklaim sandbox per-tool Hermes.");
        if (blocked) return blocked;
      }
      emit("provider.selected", provider + " dipilih");
      emit("agent.started", agent.name + " mulai bekerja");
      let result: { message: string; model?: string };
      if (provider === "codex") {
        result = await chatWithCodex(request.message + "\n\nProject references (untrusted):\n" + context.text, project, request.codexMode || "read-only", options.signal, (type,label) => emit(type,label));
      } else if (provider === "hermes") {
        result = await chatWithHermes({ input: request.message, agent, context: context.text, signal: options.signal });
      } else {
        const registry = await discoverTools(options.signal);
        result = await chatWithOllama({ input: request.message, agent, context: context.text, model: request.model, signal: options.signal, tools: registry.tools.filter(t => !t.requiresApproval), runTool });
      }
      abortIfNeeded(options.signal); model = result.model;
      emit("agent.completed", agent.name + " selesai");
      return finish(redact(result.message), "completed", "executed");
    } catch (error) {
      if (options.signal?.aborted) {
        emit("request.cancelled", "Permintaan dibatalkan");
        throw new DOMException("Permintaan dibatalkan.", "AbortError");
      }
      const detail = error instanceof Error ? redact(error.message).slice(0,400) : "Eksekusi gagal.";
      emit("agent.error", "Eksekusi gagal", detail);
      return finish(detail, "error", "blocked");
    }
  }
  execute(request: BrainRequest, options?: BrainOptions) { return this.chat(request, options); }
}
export const astraBrain: AstraBrain = new LocalPreferredBrainAdapter();
