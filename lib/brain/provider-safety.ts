const DEFAULT_MAX_PROVIDER_JSON_CHARS = 1_000_000;

function contentLength(response: Response) {
  const raw = response.headers.get("content-length");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export async function readBoundedProviderJson(
  response: Response,
  label: string,
  maxChars = DEFAULT_MAX_PROVIDER_JSON_CHARS,
): Promise<unknown> {
  const declaredLength = contentLength(response);
  if (declaredLength !== null && declaredLength > maxChars) {
    throw new Error(label + " response exceeded the ASTRA size limit.");
  }

  const raw = await response.text();
  if (raw.length > maxChars) {
    throw new Error(label + " response exceeded the ASTRA size limit.");
  }

  if (!raw.trim()) {
    throw new Error(label + " returned an empty JSON response.");
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(label + " returned malformed JSON.");
  }
}

export function isStructuredProviderPayload(value: unknown) {
  return Boolean(value) && typeof value === "object";
}

export function isRecordPayload(
  value: unknown,
): value is Record<string, unknown> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}
