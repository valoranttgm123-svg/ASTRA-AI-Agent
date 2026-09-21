import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import {
  prepareReadinessEvidencePath,
  readinessEvidenceRoot,
  resolveReadinessEvidencePath,
} from "../lib/release/private-output";

test("Phase 19A readiness evidence stays in private runtime storage", () => {
  const result = resolveReadinessEvidencePath(
    undefined,
    new Date("2026-09-21T00:00:00.000Z"),
  );

  assert.equal(
    path.dirname(result),
    readinessEvidenceRoot(),
  );
  assert.match(
    path.basename(result),
    /^self-check-.*\.json$/,
  );
});

test("Phase 19A readiness evidence refuses tracked output locations", () => {
  assert.throws(
    () =>
      resolveReadinessEvidencePath(
        path.resolve("docs", "readiness.json"),
      ),
    /must stay inside/i,
  );

  const safe = path.join(
    readinessEvidenceRoot(),
    "manual.json",
  );
  assert.equal(
    resolveReadinessEvidencePath(safe),
    path.resolve(safe),
  );
});

test("Phase 19A readiness writer prepares only private output", () => {
  const safe = path.join(
    readinessEvidenceRoot(),
    "prepared.json",
  );

  assert.equal(
    prepareReadinessEvidencePath(safe),
    path.resolve(safe),
  );

  assert.throws(
    () =>
      prepareReadinessEvidencePath(
        path.resolve("docs", "readiness.json"),
      ),
    /must stay inside/i,
  );
});
