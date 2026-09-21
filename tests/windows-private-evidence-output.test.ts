import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const helper = readFileSync(
  path.resolve(
    "scripts",
    "windows",
    "private-evidence-output.ps1",
  ),
  "utf8",
);

test("Windows private evidence helper rejects reparse-point directories and output targets", () => {
  assert.match(
    helper,
    /FileAttributes\]::ReparsePoint/,
  );
  assert.match(
    helper,
    /symbolic link, junction, or other reparse point/,
  );
  assert.match(
    helper,
    /Private \.astra root/,
  );
  assert.match(
    helper,
    /Private evidence directory/,
  );
  assert.match(
    helper,
    /ValidatePattern/,
  );
  assert.match(
    helper,
    /must not already exist/,
  );
});

test("direct Windows evidence writers use the guarded output helper", () => {
  for (const file of [
    "collect-target-pc-evidence.ps1",
    "validate-windows-release.ps1",
  ]) {
    const source = readFileSync(
      path.resolve(
        "scripts",
        "windows",
        file,
      ),
      "utf8",
    );

    assert.match(
      source,
      /private-evidence-output\.ps1/,
      file,
    );
    assert.match(
      source,
      /Resolve-AstraPrivateEvidenceFile/,
      file,
    );
  }
});
