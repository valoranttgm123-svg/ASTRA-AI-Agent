import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("ASTRA console shows a truthful working state before the first streamed token", () => {
  const source = readFileSync(
    path.resolve("components/AstraConsole.tsx"),
    "utf8",
  );

  assert.match(source, /brainStreaming/);
  assert.match(source, /MEMPROSES/);
  assert.match(
    source,
    /hasil akan muncul saat provider mulai mengirim respons/i,
  );

  const streamingIndex = source.indexOf("streamingText ?");
  const workingIndex = source.indexOf("brainStreaming ?");
  const finalIndex = source.indexOf("lastResponse ?");

  assert.ok(streamingIndex >= 0);
  assert.ok(workingIndex > streamingIndex);
  assert.ok(finalIndex > workingIndex);
});
