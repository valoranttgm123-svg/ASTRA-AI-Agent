import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

function readWindowsScript(name: string) {
  return readFileSync(
    path.resolve("scripts", "windows", name),
    "utf8",
  );
}

test("Phase 19G startup health waiter is bounded read-only and checks ASTRA Ollama Automation", () => {
  const source = readWindowsScript("wait-local-health.ps1");

  assert.match(source, /ValidateRange\(5, 120\)/);
  assert.match(source, /TimeoutSec\s*=\s*45/);
  assert.match(source, /Elapsed\.TotalSeconds\s+-lt\s+\$TimeoutSec/i);
  assert.match(source, /\/api\/agent/);
  assert.match(source, /11434\/api\/version/);
  assert.match(source, /\/api\/automation\/service/);
  assert.match(source, /Start-Sleep -Milliseconds \$PollIntervalMs/i);
  assert.match(source, /startup health timeout/i);

  assert.doesNotMatch(
    source,
    /Register-ScheduledTask|Unregister-ScheduledTask|Start-ScheduledTask|Stop-ScheduledTask|Remove-Item|git\s+(?:pull|reset|clean)|npm\s+(?:ci|install|run\s+build)/i,
  );
});

test("Phase 19G installer waits for health before creating shortcut and removes fixed startup sleeps", () => {
  const source = readWindowsScript("install-local.ps1");

  assert.match(source, /wait-local-health\.ps1/i);
  assert.doesNotMatch(source, /Start-Sleep -Seconds\s+(?:2|3)\b/i);

  const healthIndex = source.indexOf("$health = & $healthWait -Port $Port");
  const shortcutIndex = source.indexOf("$shortcutPath =");

  assert.ok(healthIndex >= 0);
  assert.ok(shortcutIndex >= 0);
  assert.ok(
    healthIndex < shortcutIndex,
    "installer must pass health before creating desktop shortcut",
  );

  assert.match(source, /AstraReady\s*=\s*\$health\.AstraReady/i);
  assert.match(source, /OllamaVersion\s*=\s*\$health\.OllamaVersion/i);
  assert.match(source, /StartupHealthElapsedMs\s*=\s*\$health\.ElapsedMs/i);
});
