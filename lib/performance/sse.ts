export type ParsedSseBlock = {
  event: string;
  data: unknown;
};

export function parseSseBlock(block: string): ParsedSseBlock | null {
  const lines = block
    .replace(/\r/g, "")
    .split("\n");

  let event = "";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (!event || dataLines.length === 0) return null;

  const raw = dataLines.join("\n");
  try {
    return {
      event,
      data: JSON.parse(raw) as unknown,
    };
  } catch {
    return {
      event,
      data: raw,
    };
  }
}

export function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
