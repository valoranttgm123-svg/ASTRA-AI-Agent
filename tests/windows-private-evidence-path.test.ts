import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const helper = readFileSync(
  path.resolve("scripts", "windows", "private-evidence.ps1"),
  "utf8",
);
const collector = readFileSync(
  path.resolve("scripts", "windows", "collect-target-pc-evidence.ps1"),
  "utf8",
);
const validator = readFileSync(
  path.resolve("scripts", "windows", "validate-windows-release.ps1"),
  "utf8",
);

test("Windows private evidence helper rejects reparse-point directories and targets", () => {
  assert.match(helper, /FileAttributes\]::ReparsePoint/);
  assert.match(helper, /must not be a symlink, junction, or other reparse point/i);
  assert.match(helper, /Private readiness directory must stay inside \.astra/i);
  assert.match(helper, /Private evidence output must stay inside \.astra\\readiness/i);
});

test("Windows evidence writers use the shared private-output boundary", () => {
  for (const source of [collector, validator]) {
    assert.match(source, /private-evidence\.ps1/);
    assert.match(source, /Get-AstraPrivateReadinessEvidencePath/);
    assert.doesNotMatch(
      source,
      /New-Item\s+-ItemType\s+Directory\s+-Path\s+\$privateRoot\s+-Force/i,
    );
  }
});
