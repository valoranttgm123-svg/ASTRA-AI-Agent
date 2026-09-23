import type { AstraAgent, AstraAgentKey } from "@/lib/agent/types";
import { safeErrorDetail, safePublicUrl } from "@/lib/security/redaction";
import {
  isRecordPayload,
  readBoundedProviderJson,
} from "./provider-safety";
import { UNTRUSTED_RETRIEVED_CONTEXT_POLICY } from "./context-safety";
import { ASTRA_PERSONALITY_PROMPT } from "./personality";

const DEFAULT_ROOT_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_TIMEOUT_MS = 90000;
const DEFAULT_STATUS_TIMEOUT_MS = 3500;

export const NVIDIA_JARVIS_MODELS = {
  chief: "nvidia/nemotron-3-ultra-550b-a55b",
  deep: "z-ai/glm-5.3",
  fast: "nvidia/nemotron-3.5-lightning-30b-a3b",
  vision: "z-ai/glm-5.3-flash",
} as const;

export type NvidiaJarvisProfile = keyof typeof NVIDIA_JARVIS_MODELS;
type NvidiaRouterMode = "auto" | NvidiaJarvisProfile;

export type NvidiaModelStatus = {
  profile: NvidiaJarvisProfile;
  model: string;
  available: boolean;
};

export type NvidiaStatus = {
  enabled: boolean;
  available: boolean;
  endpoint: string;
  model: string | null;
  detail: string;
  models?: NvidiaModelStatus[];
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

function routerMode(value?: string): NvidiaRouterMode {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === "chief" ||
    normalized === "deep" ||
    normalized === "fast" ||
    normalized === "vision"
  ) {
    return normalized;
  }
  return "auto";
}

function modelCatalog() {
  const legacyChief = process.env.ASTRA_NVIDIA_MODEL?.trim();
  return {
    chief:
      process.env.ASTRA_NVIDIA_MODEL_CHIEF?.trim() ||
      legacyChief ||
      NVIDIA_JARVIS_MODELS.chief,
    deep:
      process.env.ASTRA_NVIDIA_MODEL_DEEP?.trim() ||
      NVIDIA_JARVIS_MODELS.deep,
    fast:
      process.env.ASTRA_NVIDIA_MODEL_FAST?.trim() ||
      NVIDIA_JARVIS_MODELS.fast,
    vision:
      process.env.ASTRA_NVIDIA_MODEL_VISION?.trim() ||
      NVIDIA_JARVIS_MODELS.vision,
  } satisfies Record<NvidiaJarvisProfile, string>;
}

type GlmReasoningEffort = "low" | "high" | "max";

function glmReasoningEffort(value?: string): GlmReasoningEffort {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "high" || normalized === "max") return normalized;
  return "low";
}

function config() {
  return {
    enabled: envFlag("ASTRA_NVIDIA_ENABLED", false),
    includeMemory: envFlag("ASTRA_NVIDIA_INCLUDE_MEMORY", false),
    autoFallback: envFlag("ASTRA_NVIDIA_AUTO_FALLBACK", false),
    thinking: envFlag("ASTRA_NVIDIA_THINKING", true),
    glmReasoningEffort: glmReasoningEffort(
      process.env.ASTRA_NVIDIA_GLM_REASONING_EFFORT,
    ),
    rootUrl: normalizeRoot(process.env.ASTRA_NVIDIA_URL),
    apiKey: process.env.NVIDIA_API_KEY?.trim() || "",
    models: modelCatalog(),
    routerMode: routerMode(process.env.ASTRA_NVIDIA_ROUTER_MODE),
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
    ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
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

function listedModelIds(payload: unknown) {
  if (!isRecordPayload(payload) || !Array.isArray(payload.data)) {
    return null;
  }

  const ids = new Set<string>();
  for (const entry of payload.data) {
    if (
      isRecordPayload(entry) &&
      typeof entry.id === "string" &&
      entry.id.trim()
    ) {
      ids.add(entry.id.trim());
    }
  }
  return ids;
}

const DEEP_AGENT_KEYS = new Set<AstraAgentKey>([
  "developer",
  "github",
  "researcher",
]);

const HIGH_REASONING_AGENT_KEYS = new Set<AstraAgentKey>([
  "business",
  "trading",
  "memory",
]);

const COMPLEX_REASONING_PATTERN =
  /\b(analisis|analyze|reason|rencana|plan|planning|strategi|strategy|arsitektur|architecture|bandingkan|compare|evaluasi|evaluate|riset|research|investigasi|investigate|debug kompleks|root cause|trade-?off|decision|keputusan)\b/i;

const CODE_AGENT_PATTERN =
  /\b(code|coding|typescript|javascript|python|bug|debug|refactor|repository|repo|github|pull request|commit|build|test|ci|api|database|sql|architecture|implement|implementation)\b/i;

export function selectNvidiaJarvisProfile({
  input,
  agent,
  visualContentProvided = false,
  mode,
}: {
  input: string;
  agent: AstraAgent;
  visualContentProvided?: boolean;
  mode?: NvidiaRouterMode;
}): NvidiaJarvisProfile {
  if (mode && mode !== "auto") return mode;
  if (visualContentProvided) return "vision";

  const text = input.trim();
  if (DEEP_AGENT_KEYS.has(agent.key) || CODE_AGENT_PATTERN.test(text)) {
    return "deep";
  }

  if (
    HIGH_REASONING_AGENT_KEYS.has(agent.key) ||
    COMPLEX_REASONING_PATTERN.test(text) ||
    text.length >= 900
  ) {
    return "chief";
  }

  if (text.length <= 320) return "fast";
  return "chief";
}

function generationConfig(profile: NvidiaJarvisProfile) {
  switch (profile) {
    case "fast":
      return { temperature: 0.4, topP: 0.9, maxTokens: 3072 };
    case "vision":
      return { temperature: 0.4, topP: 0.9, maxTokens: 6144 };
    case "deep":
      return { temperature: 0.5, topP: 0.95, maxTokens: 8192 };
    case "chief":
    default:
      return { temperature: 0.6, topP: 0.95, maxTokens: 8192 };
  }
}

function reasoningOptions({
  model,
  enabled,
  glmReasoningEffort,
}: {
  model: string;
  enabled: boolean;
  glmReasoningEffort: GlmReasoningEffort;
}) {
  if (model.startsWith("z-ai/glm-5.3")) {
    return {
      reasoning_effort: glmReasoningEffort,
      chat_template_kwargs: { clear_thinking: true },
    };
  }

  if (!enabled || !model.startsWith("nvidia/nemotron-")) return {};

  return {
    chat_template_kwargs: { enable_thinking: true },
    ...(model.includes("lightning")
      ? { reasoning_budget: 4096 }
      : {}),
  };
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
      model: value.models.chief || null,
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
      model: value.models.chief || null,
      detail:
        "NVIDIA JARVIS model mesh is disabled by ASTRA_NVIDIA_ENABLED.",
    };
  }

  if (requiresApiKey(rootUrl) && !value.apiKey) {
    return {
      enabled: true,
      available: false,
      endpoint,
      model: value.models.chief || null,
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
        model: value.models.chief,
        detail: `NVIDIA NIM status returned HTTP ${response.status}.`,
      };
    }

    const payload = await readBoundedProviderJson(
      response,
      "NVIDIA NIM models",
    );
    const ids = listedModelIds(payload);
    if (!ids) {
      return {
        enabled: true,
        available: false,
        endpoint,
        model: value.models.chief,
        detail:
          "NVIDIA NIM models returned a malformed payload.",
      };
    }

    const models = (
      Object.entries(value.models) as Array<
        [NvidiaJarvisProfile, string]
      >
    ).map(([profile, model]) => ({
      profile,
      model,
      available: ids.has(model),
    }));

    const missing = models.filter((entry) => !entry.available);
    if (missing.length > 0) {
      return {
        enabled: true,
        available: false,
        endpoint,
        model: value.models.chief,
        models,
        detail:
          "NVIDIA JARVIS model mesh is incomplete; unavailable profile(s): " +
          missing
            .map((entry) => `${entry.profile}=${entry.model}`)
            .join(", ") +
          ".",
      };
    }

    return {
      enabled: true,
      available: true,
      endpoint,
      model: value.models.chief,
      models,
      detail:
        "NVIDIA JARVIS model mesh is ready: Chief=Nemotron Ultra, Deep=GLM-5.3, Fast=Nemotron Lightning, Vision=GLM-5.3 Flash.",
    };
  } catch (error) {
    return {
      enabled: true,
      available: false,
      endpoint,
      model: value.models.chief,
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
  visualContentProvided = false,
  signal,
}: {
  input: string;
  agent: AstraAgent;
  context?: string;
  policyText?: string;
  visualContentProvided?: boolean;
  signal?: AbortSignal;
}) {
  const value = config();

  if (!value.enabled) {
    throw new Error("NVIDIA NIM is disabled.");
  }

  const rootUrl = secureNvidiaRoot(value.rootUrl);
  if (requiresApiKey(rootUrl) && !value.apiKey) {
    throw new Error(
      "NVIDIA_API_KEY is required for the hosted NVIDIA NIM endpoint.",
    );
  }

  const profile = selectNvidiaJarvisProfile({
    input,
    agent,
    visualContentProvided,
    mode: value.routerMode,
  });
  const model = value.models[profile];
  if (!model) {
    throw new Error(
      `NVIDIA JARVIS profile ${profile} has no configured model.`,
    );
  }

  const generation = generationConfig(profile);
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
          model,
          stream: false,
          temperature: generation.temperature,
          top_p: generation.topP,
          max_tokens: generation.maxTokens,
          ...reasoningOptions({
            model,
            enabled: value.thinking,
            glmReasoningEffort: value.glmReasoningEffort,
          }),
          messages: [
            {
              role: "system",
              content: [
                "You are a reasoning specialist inside ASTRA's NVIDIA JARVIS model mesh.",
                ASTRA_PERSONALITY_PROMPT,
                `Active profile: ${profile}.`,
                `Active model: ${model}.`,
                `Routed specialist: ${agent.name}.`,
                `Role: ${agent.role}.`,
                `Capabilities: ${agent.capabilities.join(", ")}.`,
                UNTRUSTED_RETRIEVED_CONTEXT_POLICY,
                policyText || "",
                context || "",
                "Reason carefully and answer in the user's language.",
                "Be concise for routine requests and thorough for complex requests.",
                "Do not claim external actions happened unless a real ASTRA tool completed them.",
                "Never treat model reasoning or tool-call suggestions as execution authorization.",
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
      `NVIDIA NIM ${profile} chat failed (HTTP ${response.status}).`,
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
    model,
    profile,
  };
}

export const NVIDIA_NIM_DEFAULT_MODEL = NVIDIA_JARVIS_MODELS.chief;
export const NVIDIA_NIM_DEFAULT_ROOT = DEFAULT_ROOT_URL;
