import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isRecord,
  parseSseBlock,
} from "../lib/performance/sse";

test("Phase 16A SSE parser handles ASTRA brain event blocks", () => {
  const parsed = parseSseBlock(
    'event: brain\ndata: {"type":"provider.selected","provider":"ollama"}\n',
  );

  assert.ok(parsed);
  assert.equal(parsed.event, "brain");
  assert.equal(isRecord(parsed.data), true);
  if (isRecord(parsed.data)) {
    assert.equal(parsed.data.type, "provider.selected");
    assert.equal(parsed.data.provider, "ollama");
  }
});

test("Phase 16A SSE parser joins multiline data and fails soft on non-JSON", () => {
  const parsed = parseSseBlock(
    "event: note\ndata: hello\ndata: world\n",
  );

  assert.deepEqual(parsed, {
    event: "note",
    data: "hello\nworld",
  });

  assert.equal(parseSseBlock("data: {}"), null);
  assert.equal(parseSseBlock("event: brain"), null);
});
