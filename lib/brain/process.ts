import { spawn } from "node:child_process";
import { abortIfNeeded } from "./config";
// No shell interpolation. Kill only the process tree owned by this request.
export function runProcess(command: string, args: string[], options: {
  cwd: string; signal?: AbortSignal; timeoutMs?: number; input?: string;
  onLine?: (line: string) => void; env?: NodeJS.ProcessEnv; captureStderr?: boolean;
}): Promise<string> {
  abortIfNeeded(options.signal);
  return new Promise((resolve, reject) => {
    let output = "", pending = "", bytes = 0, failure: Error | undefined;
    const child = spawn(command, args, { cwd: options.cwd, shell: false, windowsHide: true, env: options.env ?? process.env, stdio: ["pipe", "pipe", "pipe"], detached: process.platform !== "win32" });
    const stop = (error: Error) => {
      failure ??= error;
      if (!child.pid) return;
      if (process.platform === "win32") {
        const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, shell: false, stdio: "ignore" });
        killer.on("error", () => child.kill());
      } else { try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); } }
    };
    const onAbort = () => stop(new DOMException("Permintaan dibatalkan.", "AbortError"));
    options.signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => stop(new Error("Proses melewati batas waktu.")), options.timeoutMs ?? 120_000);
    const cleanup = () => { clearTimeout(timer); options.signal?.removeEventListener("abort", onAbort); };
    child.on("error", () => { cleanup(); reject(new Error("Program tidak tersedia atau tidak diizinkan untuk dijalankan.")); });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 1_000_000) return stop(new Error("Keluaran proses terlalu besar."));
      if (!options.onLine) output += chunk;
      else {
        pending += chunk; let i;
        while ((i = pending.indexOf("\n")) >= 0) { options.onLine(pending.slice(0,i)); pending = pending.slice(i+1); }
      }
    });
    child.stderr.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 1_000_000) stop(new Error("Keluaran proses terlalu besar.")); else if (options.captureStderr) output += chunk.toString("utf8"); });
    child.stdin.on("error", () => {}); child.stdin.end(options.input);
    child.on("close", (code) => {
      cleanup(); if (options.onLine && pending) options.onLine(pending);
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error(`Proses gagal (exit ${code}); periksa instalasi dan izin lokal.`));
      else resolve(output);
    });
    if (options.signal?.aborted) onAbort();
  });
}
