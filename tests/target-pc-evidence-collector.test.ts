import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const script = readFileSync(
  path.resolve("scripts", "windows", "collect-target-pc-evidence.ps1"),
  "utf8",
);

test("target-PC evidence collector stays read-only and never selects a release verdict", () => {
  assert.match(script, /ReleaseVerdict\s*=\s*"NOT_EVALUATED"/);
  assert.match(script, /private-evidence-output\.ps1/);
  assert.match(script, /Resolve-AstraPrivateEvidenceFile/);
  assert.match(script, /preflight-local\.ps1/);
  assert.match(script, /self-check\.ps1/);
  assert.match(script, /validate-windows-release\.ps1/);
  assert.match(script, /validate-automation\.ps1/);

  assert.doesNotMatch(script, /-RunSafeTick/);
  assert.doesNotMatch(script, /install-local\.ps1/);
  assert.doesNotMatch(script, /update-local\.ps1/);
  assert.doesNotMatch(script, /reinstall-local\.ps1/);
  assert.doesNotMatch(script, /Start-ScheduledTask/);
  assert.doesNotMatch(script, /Stop-ScheduledTask/);
  assert.doesNotMatch(script, /git\s+(reset|clean|pull|checkout|switch)/i);
});

test("target-PC evidence collector makes performance and chat preflight explicit opt-ins", () => {
  assert.match(script, /\[switch\]\$IncludePerformance/);
  assert.match(script, /\[switch\]\$IncludeChatPreflight/);
  assert.match(script, /--ollama-turns/);
  assert.match(script, /"0"/);
  assert.match(script, /validate:preflight/);
  assert.match(script, /StillRequiresRealManualEvidence/);
});

test("target-PC evidence collector binds evidence to a stable clean repository", () => {
  assert.match(script, /status --porcelain --untracked-files=normal/);
  assert.match(script, /WorkingTreeClean/);
  assert.match(script, /repositoryStart/);
  assert.match(script, /repositoryEnd/);
  assert.match(script, /repositoryStable/);
  assert.match(script, /repository-provenance/);
  assert.match(script, /runtime-build-attestation/);
  assert.match(script, /runtime\.commit/i);
  assert.match(script, /\$script:runtimeIdentity/);
  assert.match(script, /Runtime\s*=\s*\$runtimeIdentity/);
  assert.match(script, /Get-Command git\.exe/i);
  assert.match(script, /Get-Command npm\.cmd/i);
});
