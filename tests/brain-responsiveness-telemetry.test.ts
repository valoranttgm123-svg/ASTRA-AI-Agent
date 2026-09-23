import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("ASTRA runtime measures time-to-first-token and total Brain latency", () => {
  const runtime = readFileSync(
    path.resolve("components/AstraRuntime.tsx"),
    "utf8",
  );
  const humanoid = readFileSync(
    path.resolve("components/lab/HumanoidLabV9.tsx"),
    "utf8",
  );

  assert.match(runtime, /brainFirstTokenLatencyMs/);
  assert.match(runtime, /brainTotalLatencyMs/);
  assert.match(runtime, /firstTokenObserved/);
  assert.match(runtime, /performance\.now\(\) - requestStartedAt/);
  assert.match(humanoid, /Brain first token:/);
  assert.match(humanoid, /Brain total latency:/);
});
