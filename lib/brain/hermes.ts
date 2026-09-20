import type { AstraAgent } from "@/lib/agent/types";

const DEFAULT_HERMES_URL = "http://127.0.0.1:8642";
const DEFAULT_HERMES_MODEL = "hermes-agent";
const DEFAULT_CHAT_TIMEOUT_MS = 45000;
const DEFAULT_STATUS_TIMEOUT_MS = 1200;
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

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

function assertLocalRoot(rootUrl: string) {
  let url: URL;
  try {
    url = new URL(rootUrl);
  } catch {
    throw new Error("Hermes URL tidak valid.");
  }
  if (url.protocol !== "http:" || !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error("Hermes harus memakai endpoint HTTP loopback lokal.");
  }
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
  externalSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abort();
  else externalSignal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abort);
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
    assertLocalRoot(config.rootUrl);
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
  context,
  policyText,
  signal,
}: {
  input: string;
  agent: AstraAgent;
  context?: string;
  policyText?: string;
  signal?: AbortSignal;
}) {
  const config = getHermesConfig();
  if (!config.enabled) {
    throw new Error("Hermes adapter is disabled.");
  }
  assertLocalRoot(config.rootUrl);

  const system = [
    "You are ASTRA, a local-first personal AI agent.",
    `Current routed specialist: ${agent.name}.`,
    `Specialist role: ${agent.role}.`,
    `Specialist capabilities: ${agent.capabilities.join(", ")}.`,
    "Answer in the same language as the user unless they ask otherwise.",
    "Use Hermes tools only when they are available, appropriate, and allowed by ASTRA policy.",
    "Do not claim an external action happened unless the tool actually completed it.",
    policyText || "",
    context || "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await withTimeout(config.chatTimeoutMs, (requestSignal) =>
    fetch(`${config.rootUrl}/v1/chat/completions`, {
      method: "POST",
      headers: hermesHeaders(config.apiKey, true),
      cache: "no-store",
      signal: requestSignal,
      body: JSON.stringify({
        model: config.model,
        stream: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: input },
        ],
      }),
    }), signal,
  );

  if (!response.ok) {
    throw new Error(`Hermes chat failed (HTTP ${response.status}).`);
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
