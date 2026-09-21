import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  prepareValidationEvidencePath,
  resolveValidationEvidencePath,
  validationEvidenceRoot,
} from "../lib/validation/private-output";

test("Phase 17A validation evidence defaults to the gitignored private runtime directory", () => {
  const result = resolveValidationEvidencePath(
    undefined,
    new Date("2026-09-21T00:00:00.000Z"),
  );

  assert.equal(
    path.dirname(result),
    validationEvidenceRoot(),
  );
  assert.match(
    path.basename(result),
    /^full-system-preflight-.*\.json$/,
  );
});

test("Phase 17A validation evidence refuses output outside .astra/validation", () => {
  assert.throws(
    () =>
      resolveValidationEvidencePath(
        path.resolve("docs", "leaked-evidence.json"),
      ),
    /must stay inside/i,
  );

  const safe = path.join(
    validationEvidenceRoot(),
    "manual.json",
  );
  assert.equal(
    resolveValidationEvidencePath(safe),
    path.resolve(safe),
  );
});

test("Phase 17A validation writer prepares only private output", () => {
  const safe = path.join(
    validationEvidenceRoot(),
    "prepared.json",
  );

  assert.equal(
    prepareValidationEvidencePath(safe),
    path.resolve(safe),
  );

  assert.throws(
    () =>
      prepareValidationEvidencePath(
        path.resolve("docs", "validation.json"),
      ),
    /must stay inside/i,
  );
});

test("Phase 17 preflight stamps clean repository provenance", () => {
  const source = readFileSync(
    path.resolve(
      "scripts",
      "validation",
      "full-system-preflight.ts",
    ),
    "utf8",
  );

  assert.match(
    source,
    /cleanRepositorySnapshot/,
  );
  assert.match(
    source,
    /assertSameCleanRepositorySnapshot/,
  );
  assert.match(
    source,
    /workingTreeClean/,
  );
});
