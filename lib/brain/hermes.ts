import type { AstraAgent } from "@/lib/agent/types";
import { readFileSync } from "node:fs";
import { chatWithHermesRun, verifyHermesRunProfile } from "./hermes-runs";
import { isRecordPayload, isStructuredProviderPayload, readBoundedProviderJson } from "./provider-safety";
import { UNTRUSTED_RETRIEVED_CONTEXT_POLICY } from "./context-safety";
import { safeErrorDetail, safePublicUrl } from "@/lib/security/redaction";
import { ASTRA_PERSONALITY_PROMPT } from "./personality";

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
  let apiKey = process.env.ASTRA_HERMES_API_KEY?.trim() || "";
  if (!apiKey && process.env.ASTRA_HERMES_API_KEY_FILE) {
    try { apiKey = readFileSync(process.env.ASTRA_HERMES_API_KEY_FILE,"utf8").trim(); } catch { /* Readiness will fail truthfully. */ }
  }
  return {
    enabled: envFlag("ASTRA_HERMES_ENABLED", true),
    rootUrl: normalizeRoot(process.env.ASTRA_HERMES_URL),
    apiKey,
    runTransport: process.env.ASTRA_HERMES_TRANSPORT === "runs",
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
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException("Hermes request timed out.", "TimeoutError"),
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

export async function getHermesStatus(): Promise<HermesStatus> {
  const config = getHermesConfig();
  const endpoint = safePublicUrl(`${config.rootUrl}/v1`);

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
    if (config.runTransport) {
      await verifyHermesRunProfile(config, AbortSignal.timeout(config.statusTimeoutMs));
      return {enabled:true,available:true,endpoint,model:config.model,detail:"Hermes run/STOP API and the reviewed read-only Sonor profile are reachable; model response speed requires a real request."};
    }
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

    const payload = await readBoundedProviderJson(
      response,
      "Hermes capabilities",
    );
    if (!isStructuredProviderPayload(payload)) {
      return {
        enabled: true,
        available: false,
        endpoint,
        model: config.model,
        detail: "Hermes capabilities returned a malformed payload.",
      };
    }

    return {
      enabled: true,
      available: true,
      endpoint,
      model: config.model,
      detail: "Hermes gateway is reachable and its API server is responding with structured capabilities.",
    };
  } catch (error) {
    const detail =
      error instanceof DOMException && error.name === "AbortError"
        ? "Hermes gateway status check timed out."
        : safeErrorDetail(
          error,
          "Hermes gateway is not reachable.",
          500,
        );

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
  executionRequested = false,
}: {
  input: string;
  agent: AstraAgent;
  context?: string;
  policyText?: string;
  signal?: AbortSignal;
  executionRequested?: boolean;
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
    ASTRA_PERSONALITY_PROMPT,
    "Answer in the same language as the user unless they ask otherwise.",
    "Use Hermes tools only when they are available, appropriate, and allowed by ASTRA policy.",
    "Do not claim an external action happened unless the tool actually completed it.",
    UNTRUSTED_RETRIEVED_CONTEXT_POLICY,
    policyText || "",
    context || "",
  ]
    .filter(Boolean)
    .join("\n");

  if (config.runTransport) {
    if (executionRequested) throw new Error("Reviewed Hermes profile is read-only. Use an approved Codex/tool execution path for changes.");
    return chatWithHermesRun(config, input, system, signal);
  }

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

  const payload = await readBoundedProviderJson(
    response,
    "Hermes chat",
  );
  if (!isRecordPayload(payload)) {
    throw new Error("Hermes returned a malformed chat payload.");
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

  if (!message) {
    throw new Error("Hermes returned an empty chat response.");
  }

  return {
    message,
    endpoint: safePublicUrl(`${config.rootUrl}/v1`),
    model: config.model,
  };
}
