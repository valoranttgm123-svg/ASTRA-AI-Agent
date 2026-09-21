import type { AstraAgent } from "@/lib/agent/types";
import { safeErrorDetail, safePublicUrl } from "@/lib/security/redaction";
import {
  isRecordPayload,
  readBoundedProviderJson,
} from "./provider-safety";
import { UNTRUSTED_RETRIEVED_CONTEXT_POLICY } from "./context-safety";

const DEFAULT_ROOT_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
const DEFAULT_TIMEOUT_MS = 90000;
const DEFAULT_STATUS_TIMEOUT_MS = 3500;

export type NvidiaStatus = {
  enabled: boolean;
  available: boolean;
  endpoint: string;
  model: string | null;
  detail: string;
};

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "off", "no"].includes(value);
}

function parseTimeout(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 500 ? parsed : fallback;
}

function normalizeRoot(value?: string) {
  return (value?.trim() || DEFAULT_ROOT_URL).replace(/\/+$/, "");
}

function loopbackHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "::1" ||
    host === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(host)
  );
}

function secureNvidiaRoot(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("NVIDIA NIM URL is invalid.");
  }

  if (url.username || url.password) {
    throw new Error("NVIDIA NIM URL must not contain embedded credentials.");
  }
  if (url.search || url.hash) {
    throw new Error("NVIDIA NIM URL must not contain query or fragment data.");
  }

  if (loopbackHost(url.hostname)) {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Local NVIDIA NIM must use HTTP or HTTPS.");
    }
    return value.replace(/\/+$/, "");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "integrate.api.nvidia.com" ||
    url.pathname.replace(/\/+$/, "") !== "/v1"
  ) {
    throw new Error(
      "Hosted NVIDIA NIM must use exactly https://integrate.api.nvidia.com/v1.",
    );
  }

  return DEFAULT_ROOT_URL;
}

function config() {
  return {
    enabled: envFlag("ASTRA_NVIDIA_ENABLED", false),
    includeMemory: envFlag("ASTRA_NVIDIA_INCLUDE_MEMORY", false),
    autoFallback: envFlag("ASTRA_NVIDIA_AUTO_FALLBACK", false),
    rootUrl: normalizeRoot(process.env.ASTRA_NVIDIA_URL),
    apiKey: process.env.NVIDIA_API_KEY?.trim() || "",
    model:
      process.env.ASTRA_NVIDIA_MODEL?.trim() ||
      DEFAULT_MODEL,
    timeoutMs: parseTimeout(
      process.env.ASTRA_NVIDIA_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
    ),
    statusTimeoutMs: parseTimeout(
      process.env.ASTRA_NVIDIA_STATUS_TIMEOUT_MS,
      DEFAULT_STATUS_TIMEOUT_MS,
    ),
  };
}

function requiresApiKey(rootUrl: string) {
  const url = new URL(rootUrl);
  return !loopbackHost(url.hostname);
}

function headers(apiKey: string) {
  return {
    accept: "application/json",
    ...(apiKey
      ? { authorization: `Bearer ${apiKey}` }
      : {}),
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
        new DOMException("NVIDIA NIM request timed out.", "TimeoutError"),
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

function modelIsListed(payload: unknown, model: string) {
  if (!isRecordPayload(payload) || !Array.isArray(payload.data)) {
    return false;
  }

  return payload.data.some(
    (entry) =>
      isRecordPayload(entry) &&
      typeof entry.id === "string" &&
      entry.id === model,
  );
}

export function nvidiaMayReceiveMemory() {
  const value = config();
  return value.enabled && value.includeMemory;
}

export function nvidiaAutoFallbackEnabled() {
  const value = config();
  return value.enabled && value.autoFallback;
}

export async function getNvidiaStatus(): Promise<NvidiaStatus> {
  const value = config();
  let rootUrl: string;

  try {
    rootUrl = secureNvidiaRoot(value.rootUrl);
  } catch (error) {
    return {
      enabled: value.enabled,
      available: false,
      endpoint: safePublicUrl(value.rootUrl),
      model: value.model || null,
      detail:
        "NVIDIA NIM URL rejected: " +
        safeErrorDetail(error, "invalid provider URL", 500),
    };
  }

  const endpoint = safePublicUrl(rootUrl);

  if (!value.enabled) {
    return {
      enabled: false,
      available: false,
      endpoint,
      model: value.model || null,
      detail: "NVIDIA NIM is disabled by ASTRA_NVIDIA_ENABLED.",
    };
  }

  if (!value.model) {
    return {
      enabled: true,
      available: false,
      endpoint,
      model: null,
      detail: "NVIDIA NIM model is not configured.",
    };
  }

  if (requiresApiKey(rootUrl) && !value.apiKey) {
    return {
      enabled: true,
      available: false,
      endpoint,
      model: value.model,
      detail:
        "Hosted NVIDIA NIM is enabled but NVIDIA_API_KEY is missing.",
    };
  }

  try {
    const response = await withTimeout(value.statusTimeoutMs, (signal) =>
      fetch(`${rootUrl}/models`, {
        method: "GET",
        headers: headers(value.apiKey),
        cache: "no-store",
        signal,
      }),
    );

    if (!response.ok) {
      return {
        enabled: true,
        available: false,
        endpoint,
        model: value.model,
        detail: `NVIDIA NIM status returned HTTP ${response.status}.`,
      };
    }

    const payload = await readBoundedProviderJson(
      response,
      "NVIDIA NIM models",
    );

    if (!modelIsListed(payload, value.model)) {
      return {
        enabled: true,
        available: false,
        endpoint,
        model: value.model,
        detail:
          "NVIDIA NIM endpoint responded, but the configured model was not listed.",
      };
    }

    return {
      enabled: true,
      available: true,
      endpoint,
      model: value.model,
      detail:
        "NVIDIA NIM is reachable and the configured Nemotron model is available.",
    };
  } catch (error) {
    return {
      enabled: true,
      available: false,
      endpoint,
      model: value.model,
      detail:
        "NVIDIA NIM is not reachable: " +
        safeErrorDetail(error, "unavailable", 500),
    };
  }
}

export async function chatWithNvidia({
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
  const value = config();

  if (!value.enabled) {
    throw new Error("NVIDIA NIM is disabled.");
  }

  const rootUrl = secureNvidiaRoot(value.rootUrl);
  if (!value.model) {
    throw new Error("NVIDIA NIM model is not configured.");
  }
  if (requiresApiKey(rootUrl) && !value.apiKey) {
    throw new Error("NVIDIA_API_KEY is required for the hosted NVIDIA NIM endpoint.");
  }

  const response = await withTimeout(
    value.timeoutMs,
    (requestSignal) =>
      fetch(`${rootUrl}/chat/completions`, {
        method: "POST",
        headers: {
          ...headers(value.apiKey),
          "content-type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          model: value.model,
          stream: false,
          temperature: 0.6,
          top_p: 0.95,
          max_tokens: 4096,
          messages: [
            {
              role: "system",
              content: [
                "You are ASTRA's NVIDIA Nemotron reasoning provider.",
                `Routed specialist: ${agent.name}.`,
                `Role: ${agent.role}.`,
                `Capabilities: ${agent.capabilities.join(", ")}.`,
                UNTRUSTED_RETRIEVED_CONTEXT_POLICY,
                policyText || "",
                context || "",
                "Reason carefully and answer in the user's language.",
                "Do not claim external actions happened unless a real ASTRA tool completed them.",
              ]
                .filter(Boolean)
                .join("\n"),
            },
            { role: "user", content: input },
          ],
        }),
        signal: requestSignal,
      }),
    signal,
  );

  if (!response.ok) {
    throw new Error(
      `NVIDIA NIM chat failed (HTTP ${response.status}).`,
    );
  }

  const payload = await readBoundedProviderJson(
    response,
    "NVIDIA NIM chat",
  );
  if (!isRecordPayload(payload)) {
    throw new Error("NVIDIA NIM returned a malformed chat payload.");
  }

  const choices = payload.choices;
  const first =
    Array.isArray(choices) && choices.length > 0
      ? choices[0]
      : undefined;
  const rawMessage = isRecordPayload(first)
    ? first.message
    : undefined;
  const message =
    isRecordPayload(rawMessage) &&
    typeof rawMessage.content === "string"
      ? rawMessage.content.trim()
      : "";

  if (!message) {
    throw new Error("NVIDIA NIM returned an empty response.");
  }

  return {
    message,
    endpoint: safePublicUrl(rootUrl),
    model: value.model,
  };
}

export const NVIDIA_NIM_DEFAULT_MODEL = DEFAULT_MODEL;
export const NVIDIA_NIM_DEFAULT_ROOT = DEFAULT_ROOT_URL;
