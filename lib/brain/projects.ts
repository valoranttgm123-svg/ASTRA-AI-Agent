import path from "node:path";
import { realpath, readdir, readFile, stat } from "node:fs/promises";
export type Project = { id: string; name: string; root: string };
const EXCLUDED = /^(?:node_modules|\.git|\.next|\.astra|\.codex|\.ssh|\.obsidian|\.playwright-cli|coverage|playwright-report|test-results|output|dist|build|secrets?|credentials?|private|data|\.env.*)$/i;
const EXTENSIONS = new Set([".md", ".txt", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".html", ".json", ".yml", ".yaml", ".py", ".rs", ".go"]);
const SECRET_FILE = /(?:^|[\/\\._-])(?:auth|token|credentials?|password|secret|id_rsa|id_ed25519)(?:[\/\\._-]|$)/i;
export function projects(): Project[] {
  if (!process.env.ASTRA_PROJECTS) return [{ id: "astra", name: "ASTRA", root: process.cwd() }];
  const value: unknown = JSON.parse(process.env.ASTRA_PROJECTS);
  if (!Array.isArray(value) || !value.length || value.length > 20) throw new Error("Konfigurasi proyek tidak valid.");
  const seen = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item.id !== "string" || !/^[a-z0-9-]{1,60}$/.test(item.id) || seen.has(item.id) || typeof item.root !== "string" || !path.isAbsolute(item.root)) throw new Error("Konfigurasi proyek tidak valid.");
    seen.add(item.id);
    return { id: item.id, name: String(item.name || item.id).slice(0,80), root: item.root };
  });
}
export async function getProject(id: string): Promise<Project> {
  const project = projects().find((item) => item.id === id);
  if (!project) throw new Error("Proyek tidak diizinkan.");
  const root = await realpath(project.root);
  if (root === path.parse(root).root) throw new Error("Root disk tidak boleh menjadi proyek.");
  return { ...project, root };
}
export function safeRelative(file: string) {
  const parts = file.replaceAll("\\", "/").split("/");
  return file.length < 300 && !path.isAbsolute(file) && !/[:\x00]/.test(file) && parts.every(p => p && p !== "." && p !== ".." && !EXCLUDED.test(p)) && !SECRET_FILE.test(file) && EXTENSIONS.has(path.extname(file).toLowerCase());
}
export async function projectFile(project: Project, file: string) {
  if (!safeRelative(file)) throw new Error("File di luar cakupan baca yang diizinkan.");
  const full = await realpath(path.join(project.root, file));
  const relative = path.relative(project.root, full);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !safeRelative(relative)) throw new Error("Tautan file keluar dari cakupan proyek.");
  const info = await stat(full);
  if (!info.isFile() || info.size > 256_000) throw new Error("File terlalu besar atau bukan teks proyek.");
  const text = await readFile(full, "utf8");
  if (text.includes("\0")) throw new Error("File biner tidak didukung.");
  return redact(text);
}
export function redact(text: string) {
  return text.replace(/\b(?:sk-[a-zA-Z0-9_-]{12,}|gh[pousr]_[a-zA-Z0-9]{16,}|github_pat_[a-zA-Z0-9_]{16,})\b/g, "[REDACTED]")
    .replace(/((?:api[_-]?key|password|secret|access[_-]?token|authorization)\s*[=:]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]");
}
export async function listProjectFiles(project: Project, limit = 300) {
  const files: string[] = []; let scanned = 0;
  async function walk(dir: string, depth: number) {
    if (depth > 5 || files.length >= limit || scanned > 3000) return;
    for (const entry of await readdir(path.join(project.root, dir), { withFileTypes: true })) {
      if (++scanned > 3000 || files.length >= limit) break;
      if (entry.isSymbolicLink() || EXCLUDED.test(entry.name)) continue;
      const relative = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(relative, depth + 1);
      else if (entry.isFile() && safeRelative(relative)) files.push(relative);
    }
  }
  await walk("", 0); return files;
}
