import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "scripts/windows/configure-ssh-computer-nodes.ps1",
  "utf8",
);

test("SSH node bootstrap preserves host verification and non-interactive auth", () => {
  assert.match(source, /BatchMode=yes/);
  assert.match(source, /ConnectTimeout=8/);
  assert.match(source, /ConnectionAttempts=1/);
  assert.doesNotMatch(source, /StrictHostKeyChecking\s*=\s*no/i);
  assert.doesNotMatch(source, /UserKnownHostsFile\s*=\s*(?:NUL|\/dev\/null)/i);
});

test("SSH node bootstrap never copies credential or key material into registry", () => {
  assert.match(source, /computerName/);
  assert.match(source, /sshAlias/);
  assert.match(source, /expectedComputerName/);
  assert.doesNotMatch(
    source,
    /\$effective\[(?:"|')?(?:identityfile|password|token|privatekey|keypath)(?:"|')?\]/i,
  );
  assert.doesNotMatch(source, /Get-Content\s+.*\.ssh\\config/i);
});

test("SSH node bootstrap fails atomically before writing private registry", () => {
  const failureGuard = source.indexOf("if ($failures.Count -gt 0)");
  const registryWrite = source.indexOf("Set-Content -LiteralPath $OutputPath");
  assert.ok(failureGuard >= 0);
  assert.ok(registryWrite > failureGuard);
  assert.match(
    source.slice(failureGuard, registryWrite),
    /exit 2/,
  );
});
