import type {
  AstraToolDefinition,
  AstraToolHandler,
} from "./contracts";

const MAX_ABS_NUMBER = 1e15;
const MAX_RECORDS = 500;
const MAX_FIELDS = 20;

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function finiteNumber(
  value: unknown,
): number | undefined {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) > MAX_ABS_NUMBER
  ) {
    return undefined;
  }
  return value;
}

function nonNegative(
  value: unknown,
): number | undefined {
  const parsed = finiteNumber(value);
  return parsed !== undefined && parsed >= 0
    ? parsed
    : undefined;
}

function rounded(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 1_000_000) / 1_000_000;
}

function ratioPercent(
  numerator: number,
  denominator: number,
) {
  if (denominator === 0) return null;
  return rounded((numerator / denominator) * 100);
}

const FINANCE_METRICS: AstraToolDefinition = {
  id: "business.finance.metrics",
  name: "Business Finance Metrics",
  category: "analytics",
  description:
    "Deterministically calculate bounded revenue, cost, profit, margin, markup, average selling price, contribution, and break-even metrics from supplied business numbers.",
  permissionLevel: 1,
  sideEffect: "read",
  timeoutMs: 5_000,
  supportsCancellation: true,
  provider: "native-business-math",
  availability: "READY",
  inputSchema: {
    type: "object",
    properties: {
      revenue: { type: "number" },
      cogs: { type: "number" },
      fixedCost: { type: "number" },
      otherCost: { type: "number" },
      tax: { type: "number" },
      unitsSold: { type: "number" },
      unitPrice: { type: "number" },
      unitVariableCost: { type: "number" },
      source: { type: "string" },
    },
  },
};

const ANALYTICS_SUMMARY: AstraToolDefinition = {
  id: "analytics.summary",
  name: "Structured Analytics Summary",
  category: "analytics",
  description:
    "Deterministically summarize bounded numeric fields from supplied structured records with count, sum, mean, min, max, median, first/last delta, and provenance label.",
  permissionLevel: 1,
  sideEffect: "read",
  timeoutMs: 5_000,
  supportsCancellation: true,
  provider: "native-analytics",
  availability: "READY",
  inputSchema: {
    type: "object",
    required: ["records"],
    properties: {
      records: { type: "array" },
      fields: { type: "array" },
      source: { type: "string" },
    },
  },
};

export const BUSINESS_TOOL_DEFINITIONS: readonly AstraToolDefinition[] = [
  FINANCE_METRICS,
  ANALYTICS_SUMMARY,
];

const financeMetrics: AstraToolHandler = async (
  input,
  context,
) => {
  context.signal.throwIfAborted();

  if (!isObject(input)) {
    return {
      status: "failed",
      detail: "Finance metrics input must be an object.",
      verified: false,
    };
  }

  const unitsSold = nonNegative(input.unitsSold);
  const unitPrice = nonNegative(input.unitPrice);
  const unitVariableCost = nonNegative(
    input.unitVariableCost,
  );

  let revenue = nonNegative(input.revenue);
  if (
    revenue === undefined &&
    unitsSold !== undefined &&
    unitPrice !== undefined
  ) {
    revenue = unitsSold * unitPrice;
  }

  let cogs = nonNegative(input.cogs);
  if (
    cogs === undefined &&
    unitsSold !== undefined &&
    unitVariableCost !== undefined
  ) {
    cogs = unitsSold * unitVariableCost;
  }

  if (revenue === undefined) {
    return {
      status: "failed",
      detail:
        "Finance metrics require revenue or both unitsSold and unitPrice.",
      verified: false,
      provider: context.definition.provider,
    };
  }

  const cogsKnown = cogs !== undefined;
  const cogsValue = cogs ?? 0;
  const fixedCost = nonNegative(input.fixedCost) ?? 0;
  const otherCost = nonNegative(input.otherCost) ?? 0;
  const tax = nonNegative(input.tax) ?? 0;

  const totalCost = cogsKnown
    ? cogsValue + fixedCost + otherCost + tax
    : undefined;
  const grossProfit = cogsKnown
    ? revenue - cogsValue
    : undefined;
  const netProfit =
    totalCost !== undefined
      ? revenue - totalCost
      : undefined;

  const averageSellingPrice =
    unitsSold !== undefined && unitsSold > 0
      ? revenue / unitsSold
      : unitPrice;

  const contributionPerUnit =
    averageSellingPrice !== undefined &&
    unitVariableCost !== undefined
      ? averageSellingPrice - unitVariableCost
      : undefined;

  const breakEvenUnits =
    contributionPerUnit !== undefined &&
    contributionPerUnit > 0
      ? fixedCost / contributionPerUnit
      : undefined;

  const source =
    typeof input.source === "string"
      ? input.source.replace(/\0/g, "").trim().slice(0, 240)
      : "";

  return {
    status: "completed",
    detail:
      "Calculated deterministic business finance metrics from supplied values.",
    verified: true,
    provider: context.definition.provider,
    output: {
      source: source || "user-supplied-values",
      inputs: {
        revenue: rounded(revenue),
        cogs: rounded(cogs),
        fixedCost: rounded(fixedCost),
        otherCost: rounded(otherCost),
        tax: rounded(tax),
        unitsSold: rounded(unitsSold),
        unitPrice: rounded(unitPrice),
        unitVariableCost: rounded(unitVariableCost),
      },
      metrics: {
        totalCost: rounded(totalCost),
        grossProfit: rounded(grossProfit),
        grossMarginPct:
          grossProfit !== undefined
            ? ratioPercent(grossProfit, revenue)
            : null,
        markupPct:
          grossProfit !== undefined && cogsValue > 0
            ? ratioPercent(grossProfit, cogsValue)
            : null,
        netProfit: rounded(netProfit),
        netMarginPct:
          netProfit !== undefined
            ? ratioPercent(netProfit, revenue)
            : null,
        averageSellingPrice: rounded(
          averageSellingPrice,
        ),
        contributionPerUnit: rounded(
          contributionPerUnit,
        ),
        breakEvenUnits: rounded(breakEvenUnits),
        breakEvenUnitsCeil:
          breakEvenUnits !== undefined
            ? Math.ceil(breakEvenUnits)
            : null,
      },
      assumptions: [
        ...(input.fixedCost === undefined
          ? ["fixedCost omitted and treated as 0 for net-cost arithmetic"]
          : []),
        ...(input.otherCost === undefined
          ? ["otherCost omitted and treated as 0 for net-cost arithmetic"]
          : []),
        ...(input.tax === undefined
          ? ["tax omitted and treated as 0 for net-cost arithmetic"]
          : []),
        ...(!cogsKnown
          ? ["COGS unavailable; gross/net profit and margin metrics are intentionally null"]
          : []),
      ],
      evidenceRule:
        "Metrics are deterministic calculations from supplied inputs. Missing COGS is never assumed to be zero; omitted optional fixed/other/tax costs are explicitly disclosed as zero assumptions.",
    },
  };
};

function median(values: readonly number[]) {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

const analyticsSummary: AstraToolHandler = async (
  input,
  context,
) => {
  context.signal.throwIfAborted();

  if (!isObject(input) || !Array.isArray(input.records)) {
    return {
      status: "failed",
      detail:
        "analytics.summary requires a records array.",
      verified: false,
    };
  }

  if (
    input.records.length === 0 ||
    input.records.length > MAX_RECORDS
  ) {
    return {
      status: "failed",
      detail:
        "analytics.summary requires 1-" +
        MAX_RECORDS +
        " records.",
      verified: false,
      provider: context.definition.provider,
    };
  }

  const records: Record<string, unknown>[] = [];
  for (const row of input.records) {
    if (!isObject(row)) {
      return {
        status: "failed",
        detail:
          "Every analytics record must be a flat object.",
        verified: false,
        provider: context.definition.provider,
      };
    }
    records.push(row);
  }

  const requestedFields = Array.isArray(input.fields)
    ? input.fields
        .filter(
          (field): field is string =>
            typeof field === "string",
        )
        .map((field) => field.trim())
        .filter(
          (field) =>
            field.length > 0 && field.length <= 80,
        )
        .slice(0, MAX_FIELDS)
    : [];

  const discovered = new Set<string>();
  if (requestedFields.length === 0) {
    for (const row of records) {
      for (const [key, value] of Object.entries(row)) {
        if (
          discovered.size >= MAX_FIELDS
        ) {
          break;
        }
        if (
          key.length > 0 &&
          key.length <= 80 &&
          finiteNumber(value) !== undefined
        ) {
          discovered.add(key);
        }
      }
    }
  }

  const fields =
    requestedFields.length > 0
      ? [...new Set(requestedFields)]
      : [...discovered];

  if (fields.length === 0) {
    return {
      status: "failed",
      detail:
        "No bounded numeric field was found for analytics.",
      verified: false,
      provider: context.definition.provider,
    };
  }

  const summaries: Record<
    string,
    Record<string, number | null>
  > = {};

  for (const field of fields) {
    const values: number[] = [];
    for (const row of records) {
      const value = finiteNumber(row[field]);
      if (value !== undefined) values.push(value);
    }

    if (values.length === 0) continue;

    const sum = values.reduce(
      (total, value) => total + value,
      0,
    );
    const first = values[0];
    const last = values[values.length - 1];
    const delta = last - first;

    summaries[field] = {
      count: values.length,
      missing: records.length - values.length,
      sum: rounded(sum),
      mean: rounded(sum / values.length),
      min: rounded(Math.min(...values)),
      max: rounded(Math.max(...values)),
      median: rounded(median(values)),
      first: rounded(first),
      last: rounded(last),
      delta: rounded(delta),
      deltaPct:
        first !== 0
          ? ratioPercent(delta, first)
          : null,
    };
  }

  if (Object.keys(summaries).length === 0) {
    return {
      status: "failed",
      detail:
        "Requested analytics fields contain no finite numbers.",
      verified: false,
      provider: context.definition.provider,
    };
  }

  const source =
    typeof input.source === "string"
      ? input.source.replace(/\0/g, "").trim().slice(0, 240)
      : "";

  return {
    status: "completed",
    detail:
      "Calculated deterministic analytics summary for " +
      Object.keys(summaries).length +
      " numeric field" +
      (Object.keys(summaries).length === 1 ? "." : "s."),
    verified: true,
    provider: context.definition.provider,
    output: {
      source: source || "user-supplied-records",
      recordCount: records.length,
      summaries,
      evidenceRule:
        "Statistics are deterministic calculations from supplied records; interpret them separately from assumptions about business causes.",
    },
  };
};

export const BUSINESS_TOOL_HANDLERS: Readonly<
  Record<string, AstraToolHandler>
> = {
  "business.finance.metrics": financeMetrics,
  "analytics.summary": analyticsSummary,
};
