import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

for (const relativePath of [
  ["scripts", "performance", "measure-runtime.ts"],
  ["scripts", "validation", "full-system-preflight.ts"],
] as const) {
  const label = relativePath.join("/");
  const source = readFileSync(
    path.resolve(...relativePath),
    "utf8",
  );

  test(`${label} verifies runtime identity before and after capture`, () => {
    const verifications =
      source.match(/verifyRuntimeBuildIdentity\s*\(/g) ?? [];

    assert.ok(
      verifications.length >= 2,
      `${label} must verify the running build at capture start and completion`,
    );
    assert.match(source, /verifiedAtStart/);
    assert.match(source, /verifiedAtCompletion/);
    assert.match(
      source,
      /assertSameCleanRepositorySnapshot/,
    );
  });
}
