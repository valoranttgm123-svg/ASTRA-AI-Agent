import type { AstraBrainChatResult, AstraBrainEvent } from "./types";
export async function readBrainStream(response: Response, onEvent: (event: AstraBrainEvent) => void): Promise<AstraBrainChatResult> {
  if (!response.body) throw new Error("Stream ASTRA tidak tersedia.");
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = "", total = 0, result: AstraBrainChatResult | undefined;
  const line = (text: string) => {
    if (!text.trim()) return;
    const item = JSON.parse(text);
    if (item.type === "event") onEvent(item.event);
    else if (item.type === "result") result = item.result;
    else if (item.type === "error") throw new Error(item.error || "Stream gagal.");
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length; if (total > 2_000_000) throw new Error("Stream terlalu besar.");
      buffer += decoder.decode(value, { stream: true }); let at;
      while ((at = buffer.indexOf("\n")) >= 0) { line(buffer.slice(0,at)); buffer = buffer.slice(at+1); }
    }
    buffer += decoder.decode(); if (buffer.trim()) line(buffer);
    if (!result) throw new Error("Koneksi terputus sebelum hasil akhir diterima.");
    return result;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
