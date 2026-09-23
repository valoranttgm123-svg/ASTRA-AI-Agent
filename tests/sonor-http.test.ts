import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";
import { sonorMemorySource } from "../lib/memory/sonor";
import { searchMemorySources } from "../lib/memory/manager";

test("Sonor HTTP rejects redirects and oversized chunked data, degrades outage, and propagates STOP", async () => {
  const saved = { ...process.env };
  let mode = "large";
  let redirectFollowed = false;
  let started: (() => void) | undefined;
  const server = http.createServer((req, res) => {
    if (req.url === "/forbidden") { redirectFollowed = true; res.end("{}"); return; }
    if (mode === "redirect") { res.writeHead(302, { location: "/forbidden" }); res.end(); return; }
    if (mode === "hang") { started?.(); return; }
    if (mode === "unavailable") { res.writeHead(503); res.end("offline"); return; }
    res.writeHead(200, { "content-type": "application/json" });
    res.write('{"records":[],"padding":"');
    res.end("x".repeat(256_001) + '"}');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as import("node:net").AddressInfo).port;
  Object.assign(process.env, { ASTRA_SONOR_ENABLED: "true", ASTRA_SONOR_URL: `http://127.0.0.1:${port}`, ASTRA_SONOR_SEARCH_PATH: "/api/astra/search", ASTRA_SONOR_TIMEOUT_MS: "2000" });
  const query = { input: "ASTRA", project: "ASTRA", limit: 6, maxChars: 2400 };
  try {
    await assert.rejects(sonorMemorySource.search(query), /size limit/);
    mode = "redirect";
    await assert.rejects(sonorMemorySource.search(query));
    assert.equal(redirectFollowed, false);
    mode = "unavailable";
    const fallback = await searchMemorySources(query, [sonorMemorySource]);
    assert.equal(fallback.sources[0].available, false);
    assert.deepEqual(fallback.records, []);
    mode = "hang";
    const controller = new AbortController();
    const incoming = new Promise<void>(resolve => { started = resolve; });
    const pending = sonorMemorySource.search({ ...query, signal: controller.signal });
    const rejected = assert.rejects(pending, { name: "AbortError" });
    await incoming;
    controller.abort();
    await rejected;
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
