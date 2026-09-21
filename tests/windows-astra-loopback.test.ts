import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const source = readFileSync(
  path.resolve("scripts", "windows", "run-astra.ps1"),
  "utf8",
);

test("Phase 19F ASTRA runner rejects non-loopback listeners and binds Next to IPv4 loopback", () => {
  assert.match(source, /Get-NetTCPConnection[\s\S]*-LocalPort \$Port/i);
  assert.match(source, /nonLoopback/i);
  assert.match(source, /127\.0\.0\.1/);
  assert.match(source, /::1/);
  assert.match(source, /menolak berjalan pada port yang terekspos jaringan/i);
  assert.match(source, /start --hostname 127\.0\.0\.1 -p \$Port/i);
});

test("Phase 19F existing loopback process must expose a healthy ASTRA Brain status endpoint", () => {
  assert.match(source, /\/api\/agent/);
  assert.match(source, /\$status\.ready\s+-eq\s+\$true/i);
  assert.match(source, /\$status\.capabilities/i);
  assert.match(source, /\$status\.features/i);
  assert.doesNotMatch(source, /Content\s+-match\s+['"]ASTRA['"]/i);
});
