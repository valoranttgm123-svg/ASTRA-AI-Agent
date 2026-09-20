import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeLoopbackBase } from "../lib/performance/loopback";

test("Phase 16A performance harness accepts loopback ASTRA URLs only", () => {
  assert.equal(
    normalizeLoopbackBase("http://127.0.0.1:3017/"),
    "http://127.0.0.1:3017",
  );
  assert.equal(
    normalizeLoopbackBase("http://localhost:3017/?token=fake#x"),
    "http://localhost:3017",
  );
});

test("Phase 16A performance harness rejects non-loopback and unsafe protocols", () => {
  assert.throws(
    () => normalizeLoopbackBase("https://example.com"),
    /loopback/i,
  );
  assert.throws(
    () => normalizeLoopbackBase("http://192.168.1.10:3017"),
    /loopback/i,
  );
  assert.throws(
    () => normalizeLoopbackBase("file:///tmp/astra"),
    /loopback/i,
  );
});
