import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isRecordPayload, readBoundedProviderJson } from "./provider-safety";

type Gateway = {rootUrl:string;apiKey:string;chatTimeoutMs:number;model:string};

async function request(config: Gateway, route: string, signal: AbortSignal, body?: unknown) {
  const response = await fetch(config.rootUrl + route, {
    method: body === undefined ? "GET" : "POST", redirect: "error", cache: "no-store", signal,
    headers: {authorization: `Bearer ${config.apiKey}`, "content-type":"application/json"},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Hermes gateway HTTP ${response.status}.`); }
  return response;
}
async function json(config: Gateway, route: string, signal: AbortSignal, body?: unknown) {
  return readBoundedProviderJson(await request(config, route, signal, body), "Hermes run", 256_000);
}

export async function verifyHermesRunProfile(config: Gateway, signal: AbortSignal) {
  if (!config.apiKey) throw new Error("Hermes local gateway authentication is not configured.");
  const profilePath = process.env.ASTRA_HERMES_PROFILE;
  const bridgeScript = process.env.ASTRA_HERMES_SONOR_MCP_SCRIPT;
  if (!profilePath || !bridgeScript || process.env.ASTRA_HERMES_READONLY_REVIEWED !== "true") throw new Error("Hermes read-only profile has not been reviewed.");
  let profile;
  try { profile = JSON.parse(await readFile(profilePath, "utf8")); }
  catch { throw new Error("Hermes reviewed profile is unavailable or malformed."); }
  const sonor = profile?.mcp_servers?.sonor;
  if (JSON.stringify(profile?.platform_toolsets?.api_server) !== '["mcp-sonor"]' ||
      Object.keys(profile?.mcp_servers || {}).join() !== "sonor" ||
      sonor?.command !== process.execPath ||
      JSON.stringify(sonor?.args) !== JSON.stringify([path.resolve(bridgeScript)]) ||
      sonor?.sampling?.enabled !== false || profile?.model?.openai_runtime === "codex_app_server") {
    throw new Error("Hermes profile is not the reviewed read-only Sonor toolset.");
  }
  signal.throwIfAborted();
  const caps = await json(config, "/v1/capabilities", signal);
  if (!isRecordPayload(caps) || caps.platform !== "hermes-agent" || !isRecordPayload(caps.features) || !caps.features.run_status || !caps.features.run_stop) throw new Error("Hermes gateway lacks verified run status/STOP support.");
  const toolsets = await json(config, "/v1/toolsets", signal);
  if (!isRecordPayload(toolsets) || !Array.isArray(toolsets.data) || toolsets.data.some(row => !isRecordPayload(row) || (row.enabled && !["sonor","mcp-sonor"].includes(String(row.name))))) throw new Error("Hermes gateway exposes tools outside the read-only Sonor profile.");
}

export async function chatWithHermesRun(config: Gateway, input: string, instructions: string, externalSignal?: AbortSignal) {
  const timeout = AbortSignal.timeout(config.chatTimeoutMs);
  const signal = externalSignal ? AbortSignal.any([externalSignal, timeout]) : timeout;
  await verifyHermesRunProfile(config, signal);
  let runId = "";
  let terminal = false;
  try {
    const started = await json(config, "/v1/runs", signal, {
      input, instructions, session_id: "astra-" + randomUUID(),
      model_options: {reasoning: {enabled:false}, reasoning_effort:"none"},
    });
    if (!isRecordPayload(started) || typeof started.run_id !== "string" || !/^run_[A-Za-z0-9_-]{1,120}$/.test(started.run_id)) throw new Error("Hermes returned an invalid run id.");
    runId = started.run_id;
    const response = await request(config, `/v1/runs/${runId}/events`, signal);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Hermes run event stream is unavailable.");
    const decoder = new TextDecoder(); let buffer = "", total = 0;
    try {
      while (!terminal) {
        const {done,value} = await reader.read(); if (done) break;
        total += value.byteLength;
        buffer += decoder.decode(value,{stream:true}).replace(/\r/g, "");
        if (total > 2_000_000 || buffer.length > 256_000) throw new Error("Hermes run events exceeded the ASTRA size limit.");
        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0,boundary); buffer = buffer.slice(boundary+2);
          const type = block.match(/^event:\s*(.+)$/m)?.[1];
          if (type && ["run.completed","run.failed","run.cancelled","run.interrupted"].includes(type)) terminal = true;
        }
      }
    } finally { await reader.cancel().catch(() => {}); }
    const result = await json(config, `/v1/runs/${runId}`, signal);
    if (!isRecordPayload(result) || result.status !== "completed" || typeof result.output !== "string" || !result.output.trim()) throw new Error("Hermes run did not complete with a verified response.");
    terminal = true;
    return {message: result.output.trim(),endpoint: config.rootUrl + "/v1",model: isRecordPayload(result.runtime) && typeof result.runtime.model === "string" ? result.runtime.model : config.model};
  } finally {
    if (runId && !terminal) await json(config, `/v1/runs/${runId}/stop`, AbortSignal.timeout(4000), {}).catch(() => {});
  }
}
