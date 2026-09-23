import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const source = readFileSync(
  path.resolve("scripts", "windows", "run-ollama.ps1"),
  "utf8",
);

test("Phase 19E ASTRA Ollama task forces loopback and rejects public listeners", () => {
  assert.match(source, /OLLAMA_HOST\s*=\s*\$loopbackHost/i);
  assert.match(source, /127\.0\.0\.1:11434/);
  assert.match(source, /Get-NetTCPConnection[\s\S]*11434/i);
  assert.match(source, /nonLoopback/i);
  assert.match(source, /LocalAddress[\s\S]*127\.0\.0\.1/i);
  assert.match(source, /LocalAddress[\s\S]*::1/i);
  assert.match(source, /menolak memakai Ollama yang terekspos jaringan/i);
});

test("Phase 19E Ollama loopback hardening does not mutate firewall network or model storage", () => {
  assert.doesNotMatch(
    source,
    /New-NetFirewallRule|Set-NetFirewallProfile|Remove-NetFirewallRule|netsh|Remove-Item|OLLAMA_MODELS\s*=/i,
  );
});

test("Ollama runner separates server console lifetime and observes its exit", () => {
  assert.match(source, /Start-Process -FilePath \$ollama -ArgumentList 'serve' -WindowStyle Hidden -PassThru/);
  assert.match(source, /\$server\.WaitForExit\(\)/);
  assert.match(source, /\$server\.ExitCode -ne 0/);
  assert.doesNotMatch(source, /&\s*\$ollama\s+serve/);
});
