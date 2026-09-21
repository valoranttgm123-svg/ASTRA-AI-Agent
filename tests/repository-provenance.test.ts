import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  assertSameCleanRepositorySnapshot,
  cleanRepositorySnapshot,
} from "../lib/release/repository-state";

test("repository evidence snapshot requires a valid clean Git HEAD", () => {
  const snapshot = cleanRepositorySnapshot();

  assert.match(snapshot.commit, /^[0-9a-f]{40}$/);
  assert.equal(snapshot.workingTreeClean, true);
  assert.deepEqual(
    assertSameCleanRepositorySnapshot(snapshot),
    snapshot,
  );
});

test("release evidence writers use stable clean-tree provenance guards", () => {
  const files = [
    "scripts/performance/measure-runtime.ts",
    "scripts/validation/full-system-preflight.ts",
    "scripts/release/record-manual-gate.ts",
    "scripts/release/record-release-context.ts",
  ];

  for (const file of files) {
    const source = readFileSync(
      path.resolve(file),
      "utf8",
    );

    assert.match(
      source,
      /cleanRepositorySnapshot/,
      file,
    );
    assert.match(
      source,
      /assertSameCleanRepositorySnapshot/,
      file,
    );
  }
});
