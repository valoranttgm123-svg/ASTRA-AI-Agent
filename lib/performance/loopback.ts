export function normalizeLoopbackBase(raw: string) {
  const url = new URL(raw);
  const allowedHosts = new Set([
    "127.0.0.1",
    "localhost",
    "[::1]",
    "::1",
  ]);

  if (
    !["http:", "https:"].includes(url.protocol) ||
    !allowedHosts.has(url.hostname)
  ) {
    throw new Error(
      "Performance harness accepts only loopback ASTRA URLs.",
    );
  }

  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
