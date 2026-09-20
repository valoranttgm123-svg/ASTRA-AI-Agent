import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import type {
  AstraToolDefinition,
  AstraToolHandler,
} from "./contracts";

const MAX_REDIRECTS = 4;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const DEFAULT_TEXT_CHARS = 20_000;
const MAX_TEXT_CHARS = 40_000;

type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

type PublicWebPage = {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  title?: string;
  text: string;
  fetchedAt: string;
  truncated: boolean;
  untrusted: true;
  provenance: {
    source: "public-web";
    reference: string;
  };
};

function ipv4Number(value: string) {
  const parts = value.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255,
    )
  ) {
    return null;
  }

  return (
    ((parts[0] << 24) >>> 0) +
    (parts[1] << 16) +
    (parts[2] << 8) +
    parts[3]
  ) >>> 0;
}

function inIpv4Cidr(value: number, base: number, prefix: number) {
  const mask =
    prefix === 0
      ? 0
      : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (base & mask);
}

function isPublicIpv4(address: string) {
  const value = ipv4Number(address);
  if (value === null) return false;

  const blocked: Array<[string, number]> = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ];

  return !blocked.some(([base, prefix]) => {
    const baseValue = ipv4Number(base);
    return (
      baseValue !== null &&
      inIpv4Cidr(value, baseValue, prefix)
    );
  });
}

function expandIpv6(address: string): number[] | null {
  const clean = address.toLowerCase().split("%")[0];
  if (!clean) return null;

  let source = clean;
  const lastColon = source.lastIndexOf(":");
  const ipv4Tail =
    lastColon >= 0 ? source.slice(lastColon + 1) : "";
  if (ipv4Tail.includes(".")) {
    const value = ipv4Number(ipv4Tail);
    if (value === null) return null;
    const high = ((value >>> 16) & 0xffff).toString(16);
    const low = (value & 0xffff).toString(16);
    source = source.slice(0, lastColon + 1) + high + ":" + low;
  }

  const halves = source.split("::");
  if (halves.length > 2) return null;

  const left = halves[0]
    ? halves[0].split(":").filter(Boolean)
    : [];
  const right =
    halves.length === 2 && halves[1]
      ? halves[1].split(":").filter(Boolean)
      : [];

  const missing =
    halves.length === 2
      ? 8 - left.length - right.length
      : 0;

  if (
    missing < 0 ||
    (halves.length === 1 &&
      left.length !== 8)
  ) {
    return null;
  }

  const groups = [
    ...left,
    ...Array(missing).fill("0"),
    ...right,
  ];

  if (groups.length !== 8) return null;

  const parsed = groups.map((group) =>
    /^[0-9a-f]{1,4}$/.test(group)
      ? Number.parseInt(group, 16)
      : Number.NaN,
  );

  return parsed.some((group) => Number.isNaN(group))
    ? null
    : parsed;
}

function isPublicIpv6(address: string) {
  const groups = expandIpv6(address);
  if (!groups) return false;

  const allZero = groups.every((group) => group === 0);
  const loopback =
    groups.slice(0, 7).every((group) => group === 0) &&
    groups[7] === 1;
  if (allZero || loopback) return false;

  const first = groups[0];
  if ((first & 0xfe00) === 0xfc00) return false; // unique-local fc00::/7
  if ((first & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
  if ((first & 0xffc0) === 0xfec0) return false; // deprecated site-local
  if ((first & 0xff00) === 0xff00) return false; // multicast
  if (first === 0x2001 && groups[1] === 0x0db8) return false; // docs

  const mapped =
    groups.slice(0, 5).every((group) => group === 0) &&
    groups[5] === 0xffff;
  if (mapped) {
    const ipv4 =
      ((groups[6] >> 8) & 0xff) +
      "." +
      (groups[6] & 0xff) +
      "." +
      ((groups[7] >> 8) & 0xff) +
      "." +
      (groups[7] & 0xff);
    return isPublicIpv4(ipv4);
  }

  return true;
}

export function isPublicNetworkAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

function parsePublicUrl(value: string) {
  const clean = value.trim();
  if (!clean || clean.length > 2048) {
    throw new Error("Public web URL is missing or too long.");
  }

  let url: URL;
  try {
    url = new URL(clean);
  } catch {
    throw new Error("Public web URL is invalid.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http/https public web URLs are allowed.");
  }
  if (url.username || url.password) {
    throw new Error("Credential-bearing URLs are not allowed.");
  }
  if (
    !url.hostname ||
    url.hostname.toLowerCase() === "localhost" ||
    url.hostname.endsWith(".localhost")
  ) {
    throw new Error("Localhost URLs are not allowed.");
  }

  return url;
}

async function resolvePublicHost(
  hostname: string,
  signal: AbortSignal,
): Promise<ResolvedAddress> {
  signal.throwIfAborted();

  const literalFamily = isIP(hostname);
  if (literalFamily) {
    if (!isPublicNetworkAddress(hostname)) {
      throw new Error("Private/reserved network addresses are blocked.");
    }
    return {
      address: hostname,
      family: literalFamily as 4 | 6,
    };
  }

  const results = await lookup(hostname, {
    all: true,
    verbatim: true,
  });
  signal.throwIfAborted();

  if (results.length === 0) {
    throw new Error("Public host did not resolve.");
  }

  if (
    results.some(
      (entry) =>
        !isPublicNetworkAddress(entry.address),
    )
  ) {
    throw new Error(
      "Host resolved to a private/reserved address and was blocked.",
    );
  }

  const chosen = results[0];
  return {
    address: chosen.address,
    family: chosen.family as 4 | 6,
  };
}

function allowedContentType(value: string) {
  const mediaType = value
    .split(";")[0]
    .trim()
    .toLowerCase();

  return (
    mediaType.startsWith("text/") ||
    mediaType === "application/json" ||
    mediaType === "application/xml" ||
    mediaType === "application/xhtml+xml" ||
    mediaType === "application/rss+xml" ||
    mediaType === "application/atom+xml"
  );
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, number: string) => {
      const code = Number(number);
      return Number.isFinite(code)
        ? String.fromCodePoint(code)
        : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, number: string) => {
      const code = Number.parseInt(number, 16);
      return Number.isFinite(code)
        ? String.fromCodePoint(code)
        : " ";
    });
}

function htmlTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return undefined;
  return decodeHtmlEntities(
    match[1].replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300) || undefined;
}

function htmlToText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(
        /<(script|style|noscript|svg|template)[^>]*>[\s\S]*?<\/\1>/gi,
        " ",
      )
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|article|section|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function requestPinned(
  url: URL,
  resolved: ResolvedAddress,
  signal: AbortSignal,
): Promise<{
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const client = url.protocol === "https:" ? https : http;
    const chunks: Buffer[] = [];
    let total = 0;

    const request = client.request(
      {
        protocol: url.protocol,
        hostname: resolved.address,
        family: resolved.family,
        port: url.port || undefined,
        method: "GET",
        path: url.pathname + url.search,
        servername:
          url.protocol === "https:"
            ? url.hostname
            : undefined,
        headers: {
          Host: url.host,
          Accept:
            "text/html,text/plain,application/json,application/xml,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "Accept-Encoding": "identity",
          "User-Agent":
            "ASTRA-Research/1.0 (+local-first read-only research agent)",
        },
      },
      (response) => {
        const contentLength = Number(
          response.headers["content-length"] ?? 0,
        );
        if (
          Number.isFinite(contentLength) &&
          contentLength > MAX_RESPONSE_BYTES
        ) {
          response.destroy();
          finish(
            new Error(
              "Public web response exceeds the ASTRA byte limit.",
            ),
          );
          return;
        }

        response.on("data", (chunk: Buffer) => {
          if (settled) return;
          total += chunk.length;
          if (total > MAX_RESPONSE_BYTES) {
            response.destroy();
            finish(
              new Error(
                "Public web response exceeded the ASTRA byte limit.",
              ),
            );
            return;
          }
          chunks.push(Buffer.from(chunk));
        });

        response.on("end", () => {
          finish(null, {
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks),
          });
        });

        response.on("error", (error) => finish(error));
      },
    );

    const finish = (
      error: Error | null,
      result?: {
        status: number;
        headers: http.IncomingHttpHeaders;
        body: Buffer;
      },
    ) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve(result!);
    };

    const onAbort = () => {
      request.destroy(
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException(
              "Public web request cancelled.",
              "AbortError",
            ),
      );
    };

    signal.addEventListener("abort", onAbort, {
      once: true,
    });
    request.on("error", (error) => finish(error));
    request.end();
  });
}

export async function fetchPublicWebPage({
  url: rawUrl,
  maxChars = DEFAULT_TEXT_CHARS,
  signal,
}: {
  url: string;
  maxChars?: number;
  signal: AbortSignal;
}): Promise<PublicWebPage> {
  let url = parsePublicUrl(rawUrl);
  const requestedUrl = url.toString();
  const textLimit = Math.max(
    1_000,
    Math.min(MAX_TEXT_CHARS, Math.floor(maxChars)),
  );

  for (
    let redirect = 0;
    redirect <= MAX_REDIRECTS;
    redirect += 1
  ) {
    signal.throwIfAborted();
    const resolved = await resolvePublicHost(
      url.hostname,
      signal,
    );
    const response = await requestPinned(
      url,
      resolved,
      signal,
    );

    if (
      [301, 302, 303, 307, 308].includes(
        response.status,
      )
    ) {
      const location = response.headers.location;
      if (!location) {
        throw new Error(
          "Public web redirect omitted the Location header.",
        );
      }
      if (redirect >= MAX_REDIRECTS) {
        throw new Error(
          "Public web request exceeded the redirect limit.",
        );
      }

      const next = parsePublicUrl(
        new URL(location, url).toString(),
      );
      if (
        url.protocol === "https:" &&
        next.protocol !== "https:"
      ) {
        throw new Error(
          "HTTPS downgrade redirects are blocked.",
        );
      }
      url = next;
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        "Public web request returned HTTP " +
          response.status +
          ".",
      );
    }

    const contentType = String(
      response.headers["content-type"] ?? "",
    );
    if (!allowedContentType(contentType)) {
      throw new Error(
        "Unsupported public web content type: " +
          (contentType || "unknown"),
      );
    }

    const raw = response.body.toString("utf8");
    const isHtml =
      /^\s*<!doctype html/i.test(raw) ||
      /<html[\s>]/i.test(raw) ||
      contentType.toLowerCase().includes("html");
    const title = isHtml ? htmlTitle(raw) : undefined;
    const extracted = isHtml
      ? htmlToText(raw)
      : raw.replace(/\0/g, "").trim();
    const text = extracted.slice(0, textLimit);

    return {
      url: requestedUrl,
      finalUrl: url.toString(),
      status: response.status,
      contentType:
        contentType.split(";")[0].trim() ||
        "text/plain",
      title,
      text,
      fetchedAt: new Date().toISOString(),
      truncated: extracted.length > text.length,
      untrusted: true,
      provenance: {
        source: "public-web",
        reference: url.toString(),
      },
    };
  }

  throw new Error("Public web fetch failed.");
}

export const BROWSER_TOOL_DEFINITIONS: readonly AstraToolDefinition[] = [
  {
    id: "browser.fetch",
    name: "Public Web Fetch",
    category: "browser",
    description:
      "Read one explicit public http/https page with private-network blocking, pinned DNS resolution, redirect revalidation, bounded bytes, and source provenance.",
    permissionLevel: 1,
    sideEffect: "read",
    timeoutMs: 30_000,
    supportsCancellation: true,
    provider: "native-public-web",
    availability: "READY",
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string" },
        maxChars: { type: "number" },
      },
    },
  },
];

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

const browserFetch: AstraToolHandler = async (
  input,
  context,
) => {
  if (!isObject(input)) {
    return {
      status: "failed",
      detail: "browser.fetch input must be an object.",
      verified: false,
    };
  }

  const url =
    typeof input.url === "string"
      ? input.url.trim()
      : "";
  const maxChars =
    typeof input.maxChars === "number" &&
    Number.isFinite(input.maxChars)
      ? input.maxChars
      : DEFAULT_TEXT_CHARS;

  if (!url) {
    return {
      status: "failed",
      detail: "browser.fetch requires a URL.",
      verified: false,
    };
  }

  try {
    const page = await fetchPublicWebPage({
      url,
      maxChars,
      signal: context.signal,
    });

    return {
      status: "completed",
      detail:
        "Fetched public source with provenance: " +
        page.finalUrl,
      verified: true,
      provider: context.definition.provider,
      output: page,
    };
  } catch (error) {
    context.signal.throwIfAborted();
    return {
      status: "failed",
      detail:
        error instanceof Error
          ? error.message
          : "Public web fetch failed.",
      verified: false,
      provider: context.definition.provider,
    };
  }
};

export const BROWSER_TOOL_HANDLERS: Readonly<
  Record<string, AstraToolHandler>
> = {
  "browser.fetch": browserFetch,
};
