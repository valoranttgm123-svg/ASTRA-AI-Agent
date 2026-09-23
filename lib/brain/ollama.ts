import type { AstraAgent } from "@/lib/agent/types";
import { isRecordPayload, readBoundedProviderJson } from "./provider-safety";
import { UNTRUSTED_RETRIEVED_CONTEXT_POLICY } from "./context-safety";
import { safeErrorDetail, safePublicUrl } from "@/lib/security/redaction";
import { ASTRA_PERSONALITY_PROMPT } from "./personality";

const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_CHAT_TIMEOUT_MS = 60000;
const DEFAULT_STATUS_TIMEOUT_MS = 1200;
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_KEEP_ALIVE = "30m";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export type OllamaStatus = {
  enabled: boolean;
  available: boolean;
  endpoint: string;
  model: string | null;
  installedModels: string[];
  detail: string;
};


function envFlag(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "off", "no"].includes(value);
}

function normalizeRoot(value?: string) {
  return (value?.trim() || DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
}

function parseTimeout(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 250 ? parsed : fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(max, Math.floor(parsed))
    : fallback;
}

function parseKeepAlive(value: string | undefined): string | number {
  const normalized = value?.trim();
  if (!normalized) return DEFAULT_KEEP_ALIVE;

  if (/^-?\d+$/.test(normalized)) {
    return Number(normalized);
  }

  if (/^-?(?:\d+(?:\.\d+)?(?:ns|us|µs|ms|s|m|h))+$/.test(normalized)) {
    return normalized;
  }

  return DEFAULT_KEEP_ALIVE;
}

function assertLocalRoot(rootUrl: string) {
  let url: URL;
  try {
    url = new URL(rootUrl);
  } catch {
    throw new Error("Ollama URL tidak valid.");
  }
  if (url.protocol !== "http:" || !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error("Ollama harus memakai endpoint HTTP loopback lokal.");
  }
}

export function getOllamaConfig() {
  return {
    enabled: envFlag("ASTRA_OLLAMA_ENABLED", true),
    rootUrl: normalizeRoot(process.env.ASTRA_OLLAMA_URL),
    preferredModel: process.env.ASTRA_OLLAMA_MODEL?.trim() || "",
    chatTimeoutMs: parseTimeout(
      process.env.ASTRA_OLLAMA_TIMEOUT_MS,
      DEFAULT_CHAT_TIMEOUT_MS,
    ),
    statusTimeoutMs: parseTimeout(
      process.env.ASTRA_OLLAMA_STATUS_TIMEOUT_MS,
      DEFAULT_STATUS_TIMEOUT_MS,
    ),
    thinking: envFlag("ASTRA_OLLAMA_THINKING", false),
    maxTokens: parsePositiveInt(
      process.env.ASTRA_OLLAMA_MAX_TOKENS,
      DEFAULT_MAX_TOKENS,
      8192,
    ),
    keepAlive: parseKeepAlive(process.env.ASTRA_OLLAMA_KEEP_ALIVE),
    preloadEnabled: envFlag("ASTRA_OLLAMA_PRELOAD_ENABLED", true),
  };
}

async function withTimeout<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
  externalSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abort();
  else externalSignal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException("Ollama request timed out.", "TimeoutError"),
      ),
    timeoutMs,
  );
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abort);
  }
}

async function listInstalledModels(
  rootUrl: string,
  timeoutMs: number,
  externalSignal?: AbortSignal,
) {
  assertLocalRoot(rootUrl);
  const response = await withTimeout(timeoutMs, (signal) =>
    fetch(`${rootUrl}/api/tags`, {
      method: "GET",
      cache: "no-store",
      signal,
    }), externalSignal,
  );

  if (!response.ok) {
    throw new Error(`Ollama tags failed (HTTP ${response.status}).`);
  }

  const payload = await readBoundedProviderJson(
    response,
    "Ollama tags",
  );
  if (!isRecordPayload(payload)) {
    throw new Error("Ollama tags returned a malformed payload.");
  }

  const models = payload.models;
  if (models === undefined) return [];
  if (!Array.isArray(models)) {
    throw new Error("Ollama tags returned a malformed model list.");
  }

  return models
    .map((item) => {
      if (!isRecordPayload(item)) return "";
      const name =
        typeof item.name === "string" ? item.name.trim() : "";
      const model =
        typeof item.model === "string" ? item.model.trim() : "";
      return name || model;
    })
    .filter(Boolean);
}

function chooseModel(preferred: string, installed: string[]) {
  if (preferred) {
    return installed.find((name) => name === preferred) ?? null;
  }

  return installed[0] ?? null;
}

export async function preloadOllamaModel() {
  const config = getOllamaConfig();
  if (!config.enabled || !config.preloadEnabled) return false;

  const installedModels = await listInstalledModels(
    config.rootUrl,
    Math.max(config.statusTimeoutMs, 2000),
  );
  const model = chooseModel(config.preferredModel, installedModels);
  if (!model) return false;

  await withTimeout(config.chatTimeoutMs, async (signal) => {
    const response = await fetch(`${config.rootUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      signal,
      body: JSON.stringify({
        model,
        stream: false,
        keep_alive: config.keepAlive,
        messages: [],
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama preload failed (HTTP ${response.status}).`);
    }

    await readBoundedProviderJson(response, "Ollama preload");
  });

  return true;
}

export async function getOllamaStatus(): Promise<OllamaStatus> {
  const config = getOllamaConfig();
  const endpoint = safePublicUrl(config.rootUrl);

  if (!config.enabled) {
    return {
      enabled: false,
      available: false,
      endpoint,
      model: config.preferredModel || null,
      installedModels: [],
      detail: "Ollama adapter is disabled by ASTRA_OLLAMA_ENABLED.",
    };
  }

  try {
    const installedModels = await listInstalledModels(
      config.rootUrl,
      config.statusTimeoutMs,
    );
    const model = chooseModel(config.preferredModel, installedModels);

    if (!model) {
      return {
        enabled: true,
        available: false,
        endpoint,
        model: config.preferredModel || null,
        installedModels,
        detail:
          "Ollama is reachable, but no local model is installed. Run ollama pull <model> first.",
      };
    }

    return {
      enabled: true,
      available: true,
      endpoint,
      model,
      installedModels,
      detail: `Ollama is reachable with local model ${model}.`,
    };
  } catch (error) {
    const detail =
      error instanceof DOMException && error.name === "AbortError"
        ? "Ollama status check timed out."
        : safeErrorDetail(
          error,
          "Ollama is not reachable.",
          500,
        );

    return {
      enabled: true,
      available: false,
      endpoint,
      model: config.preferredModel || null,
      installedModels: [],
      detail,
    };
  }
}

export async function chatWithOllama({
  input,
  agent,
  context,
  policyText,
  signal,
  onToken,
}: {
  input: string;
  agent: AstraAgent;
  context?: string;
  policyText?: string;
  signal?: AbortSignal;
  onToken?: (token: string) => void;
}) {
  const config = getOllamaConfig();

  if (!config.enabled) {
    throw new Error("Ollama adapter is disabled.");
  }

  const installedModels = await listInstalledModels(
    config.rootUrl,
    Math.max(config.statusTimeoutMs, 2000),
    signal,
  );
  const model = chooseModel(config.preferredModel, installedModels);

  if (!model) {
    throw new Error(config.preferredModel
      ? `Model Ollama ${config.preferredModel} tidak terpasang.`
      : "Ollama is running but has no installed model. Run ollama pull <model>.");
  }

  const system = [
    "You are ASTRA, a local-first personal AI agent.",
    `Current routed specialist: ${agent.name}.`,
    `Specialist role: ${agent.role}.`,
    `Specialist capabilities: ${agent.capabilities.join(", ")}.`,
    ASTRA_PERSONALITY_PROMPT,
    "Answer in the same language as the user unless they ask otherwise.",
    "This Ollama fallback has no external tools attached yet.",
    "Do not claim that files, GitHub, email, browser, shell, or other external actions were completed.",
    "If the user asks for an action requiring a tool, explain that the local model can reason about it but execution needs Hermes/Codex/tools.",
    UNTRUSTED_RETRIEVED_CONTEXT_POLICY,
    policyText || "",
    context || "",
  ]
    .filter(Boolean)
    .join("\n");

  const message = await withTimeout(
    config.chatTimeoutMs,
    async (requestSignal) => {
      const streaming = Boolean(onToken);
      const response = await fetch(`${config.rootUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        signal: requestSignal,
        body: JSON.stringify({
          model,
          stream: streaming,
          think: config.thinking,
          keep_alive: config.keepAlive,
          options: { num_predict: config.maxTokens },
          messages: [
            { role: "system", content: system },
            { role: "user", content: input },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama chat failed (HTTP ${response.status}).`);
      }

      if (!streaming) {
        const payload = await readBoundedProviderJson(
          response,
          "Ollama chat",
        );
        if (!isRecordPayload(payload)) {
          throw new Error("Ollama returned a malformed chat payload.");
        }

        const rawMessage = payload.message;
        const text =
          isRecordPayload(rawMessage) &&
          typeof rawMessage.content === "string"
            ? rawMessage.content.trim()
            : "";

        if (!text) {
          throw new Error("Ollama returned an empty chat response.");
        }
        return text;
      }

      if (!response.body) {
        throw new Error("Ollama streaming response body is unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let collected = "";
      let receivedBytes = 0;
      const maxBytes = 1_000_000;

      const consumeLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let payload: unknown;
        try {
          payload = JSON.parse(trimmed) as unknown;
        } catch {
          throw new Error("Ollama streaming response contained malformed JSON.");
        }
        if (!isRecordPayload(payload)) {
          throw new Error("Ollama streaming response contained a malformed payload.");
        }

        const rawMessage = payload.message;
        const token =
          isRecordPayload(rawMessage) &&
          typeof rawMessage.content === "string"
            ? rawMessage.content
            : "";

        if (token) {
          collected += token;
          onToken?.(token);
        }
      };

      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        receivedBytes += chunk.value.byteLength;
        if (receivedBytes > maxBytes) {
          throw new Error("Ollama streaming response exceeded the size limit.");
        }

        buffer += decoder.decode(chunk.value, { stream: true });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          consumeLine(buffer.slice(0, newline));
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) consumeLine(buffer);

      const text = collected.trim();
      if (!text) {
        throw new Error("Ollama returned an empty chat response.");
      }
      return text;
    },
    signal,
  );

  return {
    message,
    endpoint: safePublicUrl(config.rootUrl),
    model,
  };
}
