import type { AstraAgent } from "@/lib/agent/types";

const DEFAULT_HERMES_URL = "http://127.0.0.1:8642";
const DEFAULT_HERMES_MODEL = "hermes-agent";
const DEFAULT_CHAT_TIMEOUT_MS = 45000;
const DEFAULT_STATUS_TIMEOUT_MS = 1200;

export type HermesStatus = {
  enabled: boolean;
  available: boolean;
  endpoint: string;
  model: string;
  detail: string;
};

type HermesChatCompletion = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "off", "no"].includes(value);
}

function normalizeRoot(value?: string) {
  const raw = (value?.trim() || DEFAULT_HERMES_URL).replace(/\/+$/, "");
  return raw.endsWith("/v1") ? raw.slice(0, -3) : raw;
}

function parseTimeout(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 250 ? parsed : fallback;
}

export function getHermesConfig() {
  return {
    enabled: envFlag("ASTRA_HERMES_ENABLED", true),
    rootUrl: normalizeRoot(process.env.ASTRA_HERMES_URL),
    apiKey: process.env.ASTRA_HERMES_API_KEY?.trim() || "",
    model: process.env.ASTRA_HERMES_MODEL?.trim() || DEFAULT_HERMES_MODEL,
    chatTimeoutMs: parseTimeout(
      process.env.ASTRA_HERMES_TIMEOUT_MS,
      DEFAULT_CHAT_TIMEOUT_MS,
    ),
    statusTimeoutMs: parseTimeout(
      process.env.ASTRA_HERMES_STATUS_TIMEOUT_MS,
      DEFAULT_STATUS_TIMEOUT_MS,
    ),
  };
}

function hermesHeaders(apiKey: string, json = false) {
  const headers: Record<string, string> = {};
  if (json) headers["content-type"] = "application/json";
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  return headers;
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

export async function getHermesStatus(): Promise<HermesStatus> {
  const config = getHermesConfig();
  const endpoint = `${config.rootUrl}/v1`;

  if (!config.enabled) {
    return {
      enabled: false,
      available: false,
      endpoint,
      model: config.model,
      detail: "Hermes adapter is disabled by ASTRA_HERMES_ENABLED.",
    };
  }

  try {
    const response = await withTimeout(config.statusTimeoutMs, (signal) =>
      fetch(`${config.rootUrl}/v1/capabilities`, {
        method: "GET",
        headers: hermesHeaders(config.apiKey),
        cache: "no-store",
        signal,
      }),
    );

    if (!response.ok) {
      return {
        enabled: true,
        available: false,
        endpoint,
        model: config.model,
        detail: `Hermes gateway responded with HTTP ${response.status}.`,
      };
    }

    return {
      enabled: true,
      available: true,
      endpoint,
      model: config.model,
      detail: "Hermes gateway is reachable and its API server is responding.",
    };
  } catch (error) {
    const detail =
      error instanceof DOMException && error.name === "AbortError"
        ? "Hermes gateway status check timed out."
        : "Hermes gateway is not reachable.";

    return {
      enabled: true,
      available: false,
      endpoint,
      model: config.model,
      detail,
    };
  }
}

export async function chatWithHermes({
  input,
  agent,
}: {
  input: string;
  agent: AstraAgent;
}) {
  const config = getHermesConfig();
  if (!config.enabled) {
    throw new Error("Hermes adapter is disabled.");
  }

  const system = [
    "You are ASTRA, a local-first personal AI agent.",
    `Current routed specialist: ${agent.name}.`,
    `Specialist role: ${agent.role}.`,
    `Specialist capabilities: ${agent.capabilities.join(", ")}.`,
    "Answer in the same language as the user unless they ask otherwise.",
    "Use Hermes tools only when they are available and appropriate.",
    "Do not claim an external action happened unless the tool actually completed it.",
  ].join("\n");

  const response = await withTimeout(config.chatTimeoutMs, (signal) =>
    fetch(`${config.rootUrl}/v1/chat/completions`, {
      method: "POST",
      headers: hermesHeaders(config.apiKey, true),
      cache: "no-store",
      signal,
      body: JSON.stringify({
        model: config.model,
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
    throw new Error(`Hermes chat failed (HTTP ${response.status})${suffix}`);
  }

  const payload = (await response.json()) as HermesChatCompletion;
  const message = payload.choices?.[0]?.message?.content?.trim();

  if (!message) {
    throw new Error("Hermes returned an empty chat response.");
  }

  return {
    message,
    endpoint: `${config.rootUrl}/v1`,
    model: config.model,
  };
}
