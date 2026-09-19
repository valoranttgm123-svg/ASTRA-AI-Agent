import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { flag, bounded, abortIfNeeded } from "./config";
import { listProjectFiles, projectFile, redact, type Project } from "./projects";
import { retrieveContext, saveNote } from "./memory";
import { runProcess } from "./process";
import type { ToolCall, ToolInfo } from "./types";

const stringSchema = (name: string) => ({ type: "object", properties: { [name]: { type: "string" } }, required: [name], additionalProperties: false });
const BUILTINS: ToolInfo[] = [
  { name: "project.list_files", description: "Daftar file teks proyek yang diizinkan", requiresApproval: false, inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "project.read_file", description: "Baca file teks proyek; tanpa rahasia dan traversal", requiresApproval: false, inputSchema: stringSchema("path") },
  { name: "git.status", description: "Status Git lokal, tanpa perubahan", requiresApproval: false, inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "memory.search", description: "Temukan konteks proyek dan catatan lokal", requiresApproval: false, inputSchema: stringSchema("query") },
  { name: "memory.save", description: "Simpan catatan yang dipilih ke memori lokal; bukan transkrip otomatis", requiresApproval: true, inputSchema: stringSchema("text") },
];
type McpConfig = { id: string; url: string; tokenEnv?: string; tools: Array<{ name: string; readOnly?: boolean }> };
function mcpConfigs(): McpConfig[] {
  const raw = process.env.ASTRA_MCP_SERVERS;
  if (!raw) return [];
  const items = JSON.parse(raw) as McpConfig[];
  if (!Array.isArray(items) || items.length > 8) throw new Error("Konfigurasi MCP tidak valid.");
  const ids = new Set<string>();
  for (const item of items) {
    const url = new URL(item.url);
    if (!/^[a-z0-9_-]{1,40}$/.test(item.id) || ids.has(item.id) || !["http:","https:"].includes(url.protocol) || url.username || url.password || !Array.isArray(item.tools) || item.tools.length > 30) throw new Error("Konfigurasi MCP tidak valid.");
    if (!["localhost","127.0.0.1","[::1]"].includes(url.hostname) && (!flag("ASTRA_MCP_ALLOW_REMOTE") || url.protocol !== "https:")) throw new Error("MCP jarak jauh memerlukan HTTPS dan opt-in server.");
    if (item.tools.some(t => !/^[a-zA-Z0-9_.-]{1,80}$/.test(t.name))) throw new Error("Nama tool MCP tidak valid.");
    ids.add(item.id);
  }
  return items;
}
async function withMcp<T>(config: McpConfig, signal: AbortSignal | undefined, run: (client: Client, signal: AbortSignal) => Promise<T>, ms = 15_000) {
  const client = new Client({ name: "astra", version: "1.0.0" }, { capabilities: {} });
  return bounded(ms, signal, async (limited) => {
    const token = config.tokenEnv ? process.env[config.tokenEnv] : undefined;
    const transport = new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: { headers: token ? { Authorization: `Bearer ${token}` } : {}, redirect: "error" },
      fetch: (url, init) => fetch(url, { ...init, signal: limited, redirect: "error" }),
    });
    const cancel = () => { void client.close().catch(() => {}); };
    limited.addEventListener("abort", cancel, { once: true });
    try { await client.connect(transport); abortIfNeeded(limited); return await run(client, limited); }
    finally { limited.removeEventListener("abort", cancel); await client.close().catch(() => {}); }
  });
}

export async function discoverTools(signal?: AbortSignal): Promise<{ tools: ToolInfo[]; errors: string[] }> {
  const tools = [...BUILTINS], errors: string[] = [];
  await Promise.all(mcpConfigs().map(async config => {
    try {
      const remote = await withMcp(config, signal, async (client, limited) => {
        const found = []; let cursor: string | undefined;
        for (let page = 0; page < 5; page++) {
          const result = await client.listTools(cursor ? { cursor } : {}, { signal: limited });
          found.push(...result.tools); cursor = result.nextCursor; if (!cursor) break;
        }
        return found;
      }, 2500);
      for (const allowed of config.tools) {
        const found = remote.find(t => t.name === allowed.name);
        if (found) tools.push({ name: `mcp:${config.id}:${allowed.name}`, description: redact(found.description || found.name).slice(0,160), requiresApproval: !allowed.readOnly, inputSchema: found.inputSchema });
      }
    } catch { errors.push(`MCP ${config.id} tidak tersedia atau tidak diizinkan.`); }
  }));
  return { tools, errors };
}

export function toolPolicy(name: string) {
  const builtin = BUILTINS.find(t => t.name === name);
  if (builtin) return builtin;
  const [,id, toolName] = name.split(":");
  const server = mcpConfigs().find(s => s.id === id);
  const allowed = server?.tools.find(t => t.name === toolName);
  if (!name.startsWith("mcp:") || name.split(":").length !== 3 || !allowed || !server) throw new Error("Tool tidak ada di allowlist server.");
  if (!allowed.readOnly && !flag("ASTRA_ALLOW_EXTERNAL_ACTIONS")) throw new Error("Tool eksternal dengan efek samping dinonaktifkan.");
  return { name, requiresApproval: !allowed.readOnly, server, toolName };
}

export async function executeTool(call: ToolCall, project: Project, signal?: AbortSignal) {
  abortIfNeeded(signal); const policy = toolPolicy(call.name);
  const text = (key: string) => {
    const value = call.arguments[key];
    if (typeof value !== "string" || !value.trim() || value.length > 4000) throw new Error(`Argumen ${key} tidak valid.`);
    return value;
  };
  let result: unknown;
  switch (call.name) {
    case "project.list_files": result = await listProjectFiles(project); break;
    case "project.read_file": result = await projectFile(project, text("path")); break;
    case "memory.search": result = await retrieveContext(project, text("query"), signal); break;
    case "memory.save": result = await saveNote(project, text("text")); break;
    case "git.status": result = await runProcess("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false", "status", "--short", "--branch"], { cwd: project.root, signal, timeoutMs: 5000 }); break;
    default: {
      if (!("server" in policy)) throw new Error("Tool tidak tersedia.");
      const reply = await withMcp(policy.server, signal, (client, limited) => client.callTool({ name: policy.toolName, arguments: call.arguments }, undefined, { signal: limited, timeout: 15_000 }));
      if (reply.isError) throw new Error("MCP melaporkan kegagalan tool; tindakan tidak dianggap selesai.");
      const content = reply.content as Array<{ type: string; text?: string }>;
      result = content?.filter(c => c.type === "text").map(c => c.text || "").join("\n") || "Tool selesai; tidak ada keluaran teks.";
    }
  }
  abortIfNeeded(signal);
  return redact(typeof result === "string" ? result : JSON.stringify(result, null, 2)).slice(0, 24_000);
}
