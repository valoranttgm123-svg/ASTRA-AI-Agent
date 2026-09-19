import type { AstraAgent } from "@/lib/agent/types";
import type { AstraBrainPermissionSnapshot } from "./types";

const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_STATUS_TIMEOUT_MS = 2500;

export type CloudStatus = {
  enabled: boolean;
  available: boolean;
  endpoint: string;
  model: string | null;
  detail: string;
};

type CloudChatCompletion = {
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

function parseTimeout(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 500 ? parsed : fallback;
}

function normalizeRoot(value?: string) {
  return (value?.trim() || "").replace(/\/+$/, "");
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
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
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
  const endpoint = value.rootUrl || "not configured";

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

  try {
    const response = await withTimeout(value.statusTimeoutMs, (signal) =>
      fetch(`${value.rootUrl}/models`, {
        method: "GET",
        headers: { authorization: `Bearer ${value.apiKey}` },
        cache: "no-store",
        signal,
      }),
    );

    return {
      enabled: true,
      available: response.ok,
      endpoint,
      model: value.model,
      detail: response.ok
        ? "Explicitly opted-in cloud provider is reachable."
        : `Cloud provider status returned HTTP ${response.status}.`,
    };
  } catch (error) {
    return {
      enabled: true,
      available: false,
      endpoint,
      model: value.model,
      detail:
        error instanceof Error
          ? `Cloud provider is not reachable: ${error.message}`
          : "Cloud provider is not reachable.",
    };
  }
}

export async function chatWithCloud({
  input,
  agent,
  context,
  policyText,
  policy,
}: {
  input: string;
  agent: AstraAgent;
  context?: string;
  policyText?: string;
  policy: AstraBrainPermissionSnapshot;
}) {
  const value = config(policy);

  if (!value.enabled || !value.allowedByPolicy) {
    throw new Error("Paid cloud execution is not explicitly enabled by ASTRA policy.");
  }
  if (!value.rootUrl || !value.apiKey || !value.model) {
    throw new Error("Cloud provider configuration is incomplete.");
  }

  const response = await withTimeout(value.timeoutMs, (signal) =>
    fetch(`${value.rootUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${value.apiKey}`,
      },
      cache: "no-store",
      signal,
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
      signal,
    }),
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Cloud chat failed (HTTP ${response.status})${body ? ` — ${body.slice(0, 240)}` : ""}`,
    );
  }

  const payload = (await response.json()) as CloudChatCompletion;
  const message = payload.choices?.[0]?.message?.content?.trim();
  if (!message) throw new Error("Cloud provider returned an empty response.");

  return {
    message,
    endpoint: value.rootUrl,
    model: value.model,
  };
}
