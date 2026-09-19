import { mkdir, appendFile, readFile, realpath, lstat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { listProjectFiles, projectFile, redact, type Project } from "./projects";
import { abortIfNeeded } from "./config";
type Note = { id: string; at: string; text: string };
async function memoryFile(project: Project, create = false) {
  const dir = path.join(project.root, ".astra", "memory");
  for (const part of [path.join(project.root, ".astra"), dir]) {
    if ((await lstat(part).catch(() => null))?.isSymbolicLink()) throw new Error("Direktori memori tidak boleh berupa symlink.");
  }
  if (create) await mkdir(dir, { recursive: true });
  const resolved = await realpath(dir).catch(() => dir);
  if (path.relative(project.root, resolved).startsWith("..")) throw new Error("Memori di luar proyek.");
  const file = path.join(dir, "notes.jsonl");
  if ((await lstat(file).catch(() => null))?.isSymbolicLink()) throw new Error("File memori tidak boleh berupa symlink.");
  return file;
}
export async function readNotes(project: Project): Promise<Note[]> {
  const file = await memoryFile(project);
  const info = await lstat(file).catch(() => null);
  if (!info) return [];
  if (info.size > 2_000_000) throw new Error("Batas memori lokal tercapai; arsipkan catatan secara manual.");
  return (await readFile(file, "utf8")).split("\n").filter(Boolean).map(line => JSON.parse(line) as Note).slice(-100);
}
export async function saveNote(project: Project, text: string) {
  const value = text.trim();
  if (!value || value.length > 2000) throw new Error("Catatan harus berisi 1–2000 karakter.");
  if (redact(value) !== value) throw new Error("Catatan mengandung pola kredensial; tidak disimpan.");
  await readNotes(project);
  const note: Note = { id: randomUUID(), at: new Date().toISOString(), text: value };
  await appendFile(await memoryFile(project, true), JSON.stringify(note) + "\n", { mode: 0o600 });
  return { id: note.id, at: note.at, saved: true };
}
export async function retrieveContext(project: Project, query: string, signal?: AbortSignal, maxChars = 6000) {
  abortIfNeeded(signal);
  const terms = [...new Set(query.toLowerCase().match(/[a-z0-9_-]{3,}/g) || [])].slice(0,30);
  const files = (await listProjectFiles(project)).filter(f => /\.md$/i.test(f));
  const candidates: Array<{ source: string; text: string; score: number }> = [];
  for (const file of files.slice(0, 40)) {
    abortIfNeeded(signal);
    const text = (await projectFile(project, file).catch(() => "")).slice(0, 24_000);
    const low = text.toLowerCase();
    const score = terms.reduce((n, term) => n + (low.includes(term) ? 1 : 0) + (file.toLowerCase().includes(term) ? 3 : 0), 0);
    if (score > 0 || /(?:README|CODEX_HANDOFF|ASTRA_PROJECT_MEMORY)\.md$/.test(file)) candidates.push({ source: file, text, score });
  }
  for (const note of await readNotes(project)) {
    const score = terms.reduce((n,t) => n + (note.text.toLowerCase().includes(t) ? 2 : 0), 0);
    if (score) candidates.push({ source: `memory:${note.id}`, text: redact(note.text), score });
  }
  candidates.sort((a,b) => b.score - a.score || a.source.localeCompare(b.source));
  const sources: string[] = []; let text = "";
  for (const item of candidates.slice(0, 4)) {
    const chunk = `\nSOURCE ${item.source}\n${item.text.slice(0, 1800)}\n`;
    if (text.length + chunk.length > maxChars) break;
    text += chunk; sources.push(item.source);
  }
  return { text, sources, chars: text.length };
}
