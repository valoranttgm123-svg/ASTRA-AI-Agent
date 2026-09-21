import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const source = readFileSync(
  path.resolve(
    "scripts",
    "windows",
    "validate-windows-release.ps1",
  ),
  "utf8",
);

test("Phase 19D Windows validator checks tasks shortcut loopback and self-check", () => {
  assert.match(source, /ASTRA-Agent/);
  assert.match(source, /ASTRA-Ollama/);
  assert.match(source, /run-astra\.ps1/i);
  assert.match(source, /run-ollama\.ps1/i);
  assert.match(source, /RunLevel[\s\S]*Limited/i);
  assert.match(source, /powershell\.exe/i);
  assert.match(source, /expectedAstraScript/i);
  assert.match(source, /expectedOllamaScript/i);
  assert.match(source, /expectedAstraArguments/i);
  assert.match(source, /expectedOllamaArguments/i);
  assert.match(source, /agentActions\.Count\s+-eq\s+1/i);
  assert.match(source, /ollamaActions\.Count\s+-eq\s+1/i);
  assert.match(source, /agentTriggers\.Count\s+-eq\s+1/i);
  assert.match(source, /ollamaTriggers\.Count\s+-eq\s+1/i);
  assert.match(source, /Principal\.UserId[\s\S]*currentUser/i);
  assert.match(source, /LogonType[\s\S]*Interactive/i);
  assert.match(source, /MSFT_TaskLogonTrigger/i);
  assert.match(source, /TaskPath[\s\S]*root Task Scheduler/i);
  assert.match(source, /Arguments\s+-ieq\s+\$expectedAstraArguments/i);
  assert.match(source, /Arguments\s+-ieq\s+\$expectedOllamaArguments/i);
  assert.match(source, /State[\s\S]*Disabled/i);
  assert.match(source, /ASTRA\.url/i);
  assert.match(source, /127\.0\.0\.1/);
  assert.match(source, /Get-NetTCPConnection/i);
  assert.match(source, /ollamaPort\s*=\s*11434/i);
  assert.match(source, /ollamaNonLoopback/i);
  assert.match(source, /OllamaListenerAddresses/i);
  assert.match(source, /self-check\.ps1/i);
  assert.match(source, /private-evidence-output\.ps1/i);
  assert.match(source, /Resolve-AstraPrivateEvidenceFile/i);
  assert.match(source, /ReleaseVerdict\s*=\s*"NOT_EVALUATED"/i);
});

test("Phase 19D Windows validator remains read-only for services tasks git and project files", () => {
  assert.doesNotMatch(
    source,
    /Register-ScheduledTask|Unregister-ScheduledTask|Start-ScheduledTask|Stop-ScheduledTask|Remove-Item|git\s+(?:pull|reset|clean|checkout)|npm\s+(?:ci|install|run\s+build)/i,
  );

  assert.doesNotMatch(
    source,
    /READY WITH EXTERNAL CONFIGURATION REQUIRED|ReleaseVerdict\s*=\s*"READY"/i,
  );
});
