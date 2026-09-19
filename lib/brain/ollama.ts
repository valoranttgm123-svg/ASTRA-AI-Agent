import type { AstraAgent } from "@/lib/agent/types";

const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_CHAT_TIMEOUT_MS = 60000;
const DEFAULT_STATUS_TIMEOUT_MS = 1200;

export type OllamaStatus = {
  enabled: boolean;
  available: boolean;
  endpoint: string;
  model: string | null;
  installedModels: string[];
  detail: string;
};

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
};

type OllamaChatResponse = {
  message?: {
    role?: string;
    content?: string;
  };
  done?: boolean;
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
  };
}

async function withTimeout<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function listInstalledModels(rootUrl: string, timeoutMs: number) {
  const response = await withTimeout(timeoutMs, (signal) =>
    fetch(`${rootUrl}/api/tags`, {
      method: "GET",
      cache: "no-store",
      signal,
    }),
  );

  if (!response.ok) {
    throw new Error(`Ollama tags failed (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as OllamaTagsResponse;
  return (payload.models ?? [])
    .map((item) => item.name?.trim() || item.model?.trim() || "")
    .filter(Boolean);
}

function chooseModel(preferred: string, installed: string[]) {
  if (preferred) {
    const exact = installed.find((name) => name === preferred);
    if (exact) return exact;

    const byBase = installed.find(
      (name) => name.split(":")[0] === preferred.split(":")[0],
    );
    if (byBase) return byBase;
  }

  return installed[0] ?? null;
}

export async function getOllamaStatus(): Promise<OllamaStatus> {
  const config = getOllamaConfig();
  const endpoint = config.rootUrl;

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
        : error instanceof Error
          ? error.message
          : "Ollama is not reachable.";

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
}: {
  input: string;
  agent: AstraAgent;
}) {
  const config = getOllamaConfig();

  if (!config.enabled) {
    throw new Error("Ollama adapter is disabled.");
  }

  const installedModels = await listInstalledModels(
    config.rootUrl,
    Math.max(config.statusTimeoutMs, 2000),
  );
  const model = chooseModel(config.preferredModel, installedModels);

  if (!model) {
    throw new Error(
      "Ollama is running but has no installed model. Run ollama pull <model>.",
    );
  }

  const system = [
    "You are ASTRA, a local-first personal AI agent.",
    `Current routed specialist: ${agent.name}.`,
    `Specialist role: ${agent.role}.`,
    `Specialist capabilities: ${agent.capabilities.join(", ")}.`,
    "Answer in the same language as the user unless they ask otherwise.",
    "This Ollama fallback has no external tools attached yet.",
    "Do not claim that files, GitHub, email, browser, shell, or other external actions were completed.",
    "If the user asks for an action requiring a tool, explain that the local model can reason about it but execution needs Hermes/Codex/tools.",
  ].join("\n");

  const response = await withTimeout(config.chatTimeoutMs, (signal) =>
    fetch(`${config.rootUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      signal,
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: input },
        ],
      }),
    }),
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const suffix = body ? ` — ${body.slice(0, 240)}` : "";
    throw new Error(`Ollama chat failed (HTTP ${response.status})${suffix}`);
  }

  const payload = (await response.json()) as OllamaChatResponse;
  const message = payload.message?.content?.trim();

  if (!message) {
    throw new Error("Ollama returned an empty chat response.");
  }

  return {
    message,
    endpoint: config.rootUrl,
    model,
  };
}
