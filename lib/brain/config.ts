export function flag(name: string, fallback = false) {
  const value = process.env[name]?.trim().toLowerCase();
  return value ? ["1", "true", "on", "yes"].includes(value) : fallback;
}
export function timeout(value: string | undefined, fallback: number) {
  const ms = Number(value);
  return Number.isFinite(ms) && ms >= 250 && ms <= 300_000 ? ms : fallback;
}
export function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Permintaan dibatalkan.", "AbortError");
}
export async function bounded<T>(ms: number, parent: AbortSignal | undefined, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  abortIfNeeded(parent);
  const controller = new AbortController();
  const abort = () => controller.abort();
  parent?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, ms);
  try { return await run(controller.signal); }
  finally { clearTimeout(timer); parent?.removeEventListener("abort", abort); }
}
export function localProviderUrl(raw: string) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Protokol provider tidak didukung.");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password) throw new Error("Provider lokal harus memakai loopback tanpa kredensial di URL.");
  return url.toString().replace(/\/$/, "");
}
