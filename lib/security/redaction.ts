const DEFAULT_MAX_PUBLIC_ERROR_CHARS = 1000;

const SENSITIVE_QUERY_KEYS = new Set([
  "access_token",
  "api_key",
  "apikey",
  "auth",
  "authorization",
  "key",
  "password",
  "secret",
  "signature",
  "sig",
  "token",
]);

function redactUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.username) url.username = "[redacted]";
    if (url.password) url.password = "[redacted]";

    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.set(key, "[redacted]");
      }
    }

    return url.toString();
  } catch {
    return raw;
  }
}

export function redactSensitiveText(
  value: string,
  maxChars = DEFAULT_MAX_PUBLIC_ERROR_CHARS,
) {
  let text = value.replace(/\0/g, "").trim();

  text = text.replace(
    /\b(authorization\s*:\s*(?:bearer|basic)\s+)[^\s,;]+/gi,
    "$1[redacted]",
  );

  text = text.replace(
    /\b(bearer\s+)[A-Za-z0-9._~+\/-]{8,}/gi,
    "$1[redacted]",
  );

  text = text.replace(
    /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|approval[_-]?token|password|passwd|secret)\s*[:=]\s*([^\s,;]+)/gi,
    "$1=[redacted]",
  );

  text = text.replace(
    /\b(sk-(?:proj-)?[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,})\b/g,
    "[redacted-token]",
  );

  text = text.replace(
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    "[redacted-jwt]",
  );

  text = text.replace(
    /https?:\/\/[^\s"'<>]+/gi,
    (match) => redactUrl(match),
  );

  text = text.replace(
    /\b[A-Za-z]:\\Users\\[^\\\s]+\\[^\s"'<>]*/gi,
    "[local-path]",
  );

  text = text.replace(
    /(?:^|\s)\/(?:home|Users)\/[^\s"'<>]+\/[^\s"'<>]*/g,
    (match) =>
      (match.startsWith(" ") ? " " : "") + "[local-path]",
  );

  text = text.replace(/\s+/g, " ").trim();

  if (text.length > maxChars) {
    text = text.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "…";
  }

  return text;
}

export function safePublicUrl(value: string) {
  const clean = value.trim();
  if (!clean) return "";
  return redactUrl(clean);
}

export function safeErrorDetail(
  error: unknown,
  fallback = "ASTRA operation failed.",
  maxChars = DEFAULT_MAX_PUBLIC_ERROR_CHARS,
) {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : fallback;

  const clean = redactSensitiveText(raw, maxChars);
  return clean || fallback;
}

export function safePublicDetail(
  detail: unknown,
  fallback = "ASTRA operation failed.",
  maxChars = DEFAULT_MAX_PUBLIC_ERROR_CHARS,
) {
  return typeof detail === "string"
    ? redactSensitiveText(detail, maxChars) || fallback
    : fallback;
}
