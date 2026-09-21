import type { AstraAgent } from "@/lib/agent/types";
import type { AstraBrainPermissionSnapshot } from "./types";
import { isRecordPayload, isStructuredProviderPayload, readBoundedProviderJson } from "./provider-safety";
import { UNTRUSTED_RETRIEVED_CONTEXT_POLICY } from "./context-safety";
import { safeErrorDetail, safePublicUrl } from "@/lib/security/redaction";

const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_STATUS_TIMEOUT_MS = 2500;

export type CloudStatus = {
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
  return (value?.trim() || "").replace(/\/+$/, "");
}

function secureCloudRoot(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Cloud provider URL is invalid.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Cloud provider URL must use HTTPS or loopback HTTP.");
  }
  if (url.username || url.password) {
    throw new Error("Cloud provider URL must not contain embedded credentials.");
  }

  const hostname = url.hostname.toLowerCase();
  const loopback = [
    "127.0.0.1",
    "localhost",
    "::1",
    "[::1]",
  ].includes(hostname);

  if (url.protocol === "http:" && !loopback) {
    throw new Error(
      "Cloud provider URL must use HTTPS unless it is a loopback endpoint.",
    );
  }

  return value.replace(/\/+$/, "");
}

function config(policy?: AstraBrainPermissionSnapshot) {
  return {
    enabled: envFlag("ASTRA_CLOUD_ENABLED", false),
    includeMemory: envFlag("ASTRA_CLOUD_INCLUDE_MEMORY", false),
    rootUrl: normalizeRoot(process.env.ASTRA_CLOUD_URL),
    apiKey: process.env.ASTRA_CLOUD_API_KEY?.trim() || "",
    model: process.env.ASTRA_CLOUD_MODEL?.trim() || "",
    timeoutMs: parseTimeout(process.env.ASTRA_CLOUD_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    statusTimeoutMs: parseTimeout(
      process.env.ASTRA_CLOUD_STATUS_TIMEOUT_MS,
      DEFAULT_STATUS_TIMEOUT_MS,
    ),
    allowedByPolicy: Boolean(policy?.allowPaidCloud),
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
        new DOMException("Cloud request timed out.", "TimeoutError"),
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

export function cloudMayReceiveMemory(policy?: AstraBrainPermissionSnapshot) {
  const value = config(policy);
  return value.enabled && value.allowedByPolicy && value.includeMemory;
}

export async function getCloudStatus(
  policy?: AstraBrainPermissionSnapshot,
): Promise<CloudStatus> {
  const value = config(policy);
  const endpoint = value.rootUrl ? safePublicUrl(value.rootUrl) : "not configured";

  if (!value.enabled) {
    return {
      enabled: false,
      available: false,
      endpoint,
      model: value.model || null,
      detail: "Optional cloud provider is disabled by ASTRA_CLOUD_ENABLED.",
    };
  }

  if (!value.allowedByPolicy) {
    return {
      enabled: true,
      available: false,
      endpoint,
      model: value.model || null,
      detail:
        "Cloud provider is configured but blocked because ASTRA_ALLOW_PAID_CLOUD is false.",
    };
  }

  if (!value.rootUrl || !value.apiKey || !value.model) {
    return {
      enabled: true,
      available: false,
      endpoint,
      model: value.model || null,
      detail:
        "Cloud provider opt-in is active, but URL, API key, or model is missing.",
    };
  }

  let rootUrl: string;
  try {
    rootUrl = secureCloudRoot(value.rootUrl);
  } catch (error) {
    return {
      enabled: true,
      available: false,
      endpoint,
      model: value.model || null,
      detail:
        "Cloud provider URL rejected: " +
        safeErrorDetail(
          error,
          "invalid provider URL",
          500,
        ),
    };
  }

  try {
    const response = await withTimeout(value.statusTimeoutMs, (signal) =>
      fetch(`${rootUrl}/models`, {
        method: "GET",
        headers: { authorization: `Bearer ${value.apiKey}` },
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
        detail: `Cloud provider status returned HTTP ${response.status}.`,
      };
    }

    const payload = await readBoundedProviderJson(
      response,
      "Cloud models",
    );
    if (!isStructuredProviderPayload(payload)) {
      return {
        enabled: true,
        available: false,
        endpoint,
        model: value.model,
        detail: "Cloud provider models returned a malformed payload.",
      };
    }

    return {
      enabled: true,
      available: true,
      endpoint,
      model: value.model,
      detail: "Explicitly opted-in cloud provider is reachable with a structured models response.",
    };
  } catch (error) {
    return {
      enabled: true,
      available: false,
      endpoint,
      model: value.model,
      detail:
        "Cloud provider is not reachable: " +
        safeErrorDetail(
          error,
          "unavailable",
          500,
        ),
    };
  }
}

export async function chatWithCloud({
  input,
  agent,
  context,
  policyText,
  policy,
  signal,
}: {
  input: string;
  agent: AstraAgent;
  context?: string;
  policyText?: string;
  policy: AstraBrainPermissionSnapshot;
  signal?: AbortSignal;
}) {
  const value = config(policy);

  if (!value.enabled || !value.allowedByPolicy) {
    throw new Error("Paid cloud execution is not explicitly enabled by ASTRA policy.");
  }
  if (!value.rootUrl || !value.apiKey || !value.model) {
    throw new Error("Cloud provider configuration is incomplete.");
  }

  const rootUrl = secureCloudRoot(value.rootUrl);

  const response = await withTimeout(value.timeoutMs, (requestSignal) =>
    fetch(`${rootUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${value.apiKey}`,
      },
      cache: "no-store",
      body: JSON.stringify({
        model: value.model,
        stream: false,
        messages: [
          {
            role: "system",
            content: [
              "You are ASTRA's explicitly opted-in cloud fallback.",
              `Routed specialist: ${agent.name}.`,
              `Role: ${agent.role}.`,
              `Capabilities: ${agent.capabilities.join(", ")}.`,
              UNTRUSTED_RETRIEVED_CONTEXT_POLICY,
              policyText || "",
              context || "",
              "Do not claim external actions happened unless a real tool completed them.",
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
    throw new Error(`Cloud chat failed (HTTP ${response.status}).`);
  }

  const payload = await readBoundedProviderJson(
    response,
    "Cloud chat",
  );
  if (!isRecordPayload(payload)) {
    throw new Error("Cloud provider returned a malformed chat payload.");
  }

  const choices = payload.choices;
  const first =
    Array.isArray(choices) && choices.length > 0
      ? choices[0]
      : undefined;
  const rawMessage =
    isRecordPayload(first) ? first.message : undefined;
  const message =
    isRecordPayload(rawMessage) &&
    typeof rawMessage.content === "string"
      ? rawMessage.content.trim()
      : "";
  if (!message) throw new Error("Cloud provider returned an empty response.");

  return {
    message,
    endpoint: safePublicUrl(rootUrl),
    model: value.model,
  };
}
