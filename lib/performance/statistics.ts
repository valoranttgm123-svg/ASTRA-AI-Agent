export type AstraDurationSummary = {
  count: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
};

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function percentileNearestRank(
  values: readonly number[],
  percentile: number,
) {
  if (values.length === 0) {
    throw new Error("Cannot calculate a percentile from an empty sample.");
  }
  if (!Number.isFinite(percentile) || percentile <= 0 || percentile > 1) {
    throw new Error("Percentile must be greater than 0 and at most 1.");
  }

  const sorted = values
    .map((value) => {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("Performance samples must be finite non-negative numbers.");
      }
      return value;
    })
    .sort((a, b) => a - b);

  const rank = Math.max(
    0,
    Math.min(
      sorted.length - 1,
      Math.ceil(percentile * sorted.length) - 1,
    ),
  );
  return round3(sorted[rank]);
}

export function summarizeDurations(
  values: readonly number[],
): AstraDurationSummary {
  if (values.length === 0) {
    throw new Error("At least one duration sample is required.");
  }

  const clean = values.map((value) => {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Performance samples must be finite non-negative numbers.");
    }
    return value;
  });

  const total = clean.reduce((sum, value) => sum + value, 0);

  return {
    count: clean.length,
    minMs: round3(Math.min(...clean)),
    maxMs: round3(Math.max(...clean)),
    meanMs: round3(total / clean.length),
    p50Ms: percentileNearestRank(clean, 0.5),
    p95Ms: percentileNearestRank(clean, 0.95),
  };
}
