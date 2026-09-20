import assert from "node:assert/strict";
import { test } from "node:test";

import {
  percentileNearestRank,
  summarizeDurations,
} from "../lib/performance/statistics";

test("Phase 16A duration summary reports deterministic nearest-rank P50/P95", () => {
  const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const summary = summarizeDurations(values);

  assert.deepEqual(summary, {
    count: 10,
    minMs: 10,
    maxMs: 100,
    meanMs: 55,
    p50Ms: 50,
    p95Ms: 100,
  });

  assert.equal(percentileNearestRank([3, 1, 2], 0.5), 2);
});

test("Phase 16A duration statistics reject empty negative and invalid samples", () => {
  assert.throws(() => summarizeDurations([]), /at least one/i);
  assert.throws(() => summarizeDurations([1, -1]), /non-negative/i);
  assert.throws(() => summarizeDurations([1, Number.NaN]), /finite/i);
  assert.throws(() => percentileNearestRank([1], 0), /percentile/i);
  assert.throws(() => percentileNearestRank([1], 1.1), /percentile/i);
});
