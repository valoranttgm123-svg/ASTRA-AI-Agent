import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  summarizeDurations,
  type AstraDurationSummary,
} from "../../lib/performance/statistics";
import {
  isRecord,
  parseSseBlock,
} from "../../lib/performance/sse";
import { safeErrorDetail } from "../../lib/security/redaction";
import { normalizeLoopbackBase } from "../../lib/performance/loopback";

type Options = {
  baseUrl: string;
  samples: number;
  timeoutMs: number;
  ollamaTurns: number;
  output?: string;
};

type EndpointMeasurement = {
  path: string;
  samplesMs: number[];
  coldMs: number;
  warm: AstraDurationSummary | null;
  overall: AstraDurationSummary;
};

type OllamaTurnMeasurement = {
  headersMs: number;
  firstSseEventMs: number | null;
  providerSelectedMs: number | null;
  finalResultMs: number;
  provider: string | null;
};

function parseInteger(
  value: string | undefined,
  label: string,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(
      `${label} must be an integer between ${min} and ${max}.`,
    );
  }
  return parsed;
}

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    baseUrl: "http://127.0.0.1:3017",
    samples: 10,
    timeoutMs: 10_000,
    ollamaTurns: 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help") {
      console.log(
        [
          "ASTRA Phase 16 runtime measurement harness",
          "",
          "Usage:",
          "  npm run perf:runtime -- [options]",
          "",
          "Options:",
          "  --base <url>           ASTRA loopback base URL (default http://127.0.0.1:3017)",
          "  --samples <n>           GET samples per endpoint, 1-100 (default 10)",
          "  --timeout-ms <n>        Per-request timeout, 250-120000 (default 10000)",
          "  --ollama-turns <n>      Explicit local Ollama turns, 0-20 (default 0)",
          "  --output <path>         JSON output path (default .astra/performance/runtime-<time>.json)",
          "",
          "The harness is loopback-only and never invokes external actions.",
        ].join("\n"),
      );
      process.exit(0);
    }

    if (arg === "--base") {
      options.baseUrl = argv[++index] ?? "";
      continue;
    }
    if (arg === "--samples") {
      options.samples = parseInteger(
        argv[++index],
        "--samples",
        1,
        100,
      );
      continue;
    }
    if (arg === "--timeout-ms") {
      options.timeoutMs = parseInteger(
        argv[++index],
        "--timeout-ms",
        250,
        120_000,
      );
      continue;
    }
    if (arg === "--ollama-turns") {
      options.ollamaTurns = parseInteger(
        argv[++index],
        "--ollama-turns",
        0,
        20,
      );
      continue;
    }
    if (arg === "--output") {
      options.output = argv[++index] ?? "";
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function currentCommit() {
  try {
    return execFileSync(
      "git",
      ["rev-parse", "HEAD"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
  } catch {
    return "unknown";
  }
}

function environmentSnapshot() {
  const cpus = os.cpus();
  return {
    capturedAt: new Date().toISOString(),
    commit: currentCommit(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    node: process.version,
    cpuModel: cpus[0]?.model ?? "unknown",
    cpuCount: cpus.length,
    totalMemoryBytes: os.totalmem(),
  };
}

function timeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException(
          "Performance request timed out.",
          "TimeoutError",
        ),
      ),
    timeoutMs,
  );

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

async function fetchJsonTimed(
  url: string,
  timeoutMs: number,
) {
  const timeout = timeoutSignal(timeoutMs);
  const started = performance.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-astra-client": "1",
      },
      cache: "no-store",
      signal: timeout.signal,
    });
    const body = await response.text();
    const elapsedMs = performance.now() - started;

    if (!response.ok) {
      throw new Error(
        `GET ${new URL(url).pathname} returned HTTP ${response.status}.`,
      );
    }

    try {
      JSON.parse(body);
    } catch {
      throw new Error(
        `GET ${new URL(url).pathname} returned malformed JSON.`,
      );
    }

    return elapsedMs;
  } finally {
    timeout.clear();
  }
}

async function measureEndpoint(
  baseUrl: string,
  endpointPath: string,
  samples: number,
  timeoutMs: number,
): Promise<EndpointMeasurement> {
  const values: number[] = [];

  for (let index = 0; index < samples; index += 1) {
    values.push(
      await fetchJsonTimed(
        baseUrl + endpointPath,
        timeoutMs,
      ),
    );
  }

  return {
    path: endpointPath,
    samplesMs: values.map((value) =>
      Math.round(value * 1000) / 1000,
    ),
    coldMs: Math.round(values[0] * 1000) / 1000,
    warm:
      values.length > 1
        ? summarizeDurations(values.slice(1))
        : null,
    overall: summarizeDurations(values),
  };
}

function elapsedSince(started: number) {
  return Math.round((performance.now() - started) * 1000) / 1000;
}

async function measureOllamaTurn(
  baseUrl: string,
  timeoutMs: number,
): Promise<OllamaTurnMeasurement> {
  const timeout = timeoutSignal(timeoutMs);
  const started = performance.now();

  try {
    const response = await fetch(
      baseUrl + "/api/agent/stream",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-astra-client": "1",
        },
        body: JSON.stringify({
          message:
            "Performance probe only. Reply with exactly ASTRA PERF OK.",
          mode: "chat",
          provider: "ollama",
        }),
        signal: timeout.signal,
      },
    );

    const headersMs = elapsedSince(started);
    if (!response.ok) {
      throw new Error(
        `Ollama performance turn returned HTTP ${response.status}.`,
      );
    }
    if (!response.body) {
      throw new Error(
        "Ollama performance turn returned no response stream.",
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let firstSseEventMs: number | null = null;
    let providerSelectedMs: number | null = null;
    let finalResultMs: number | null = null;
    let provider: string | null = null;

    const handleBlock = (block: string) => {
      const parsed = parseSseBlock(block);
      if (!parsed) return;

      const now = elapsedSince(started);
      if (firstSseEventMs === null) firstSseEventMs = now;

      if (
        parsed.event === "brain" &&
        isRecord(parsed.data) &&
        parsed.data.type === "provider.selected"
      ) {
        if (providerSelectedMs === null) {
          providerSelectedMs = now;
        }
        if (typeof parsed.data.provider === "string") {
          provider = parsed.data.provider;
        }
      }

      if (
        parsed.event === "result" &&
        isRecord(parsed.data)
      ) {
        finalResultMs = now;
        if (typeof parsed.data.provider === "string") {
          provider = parsed.data.provider;
        }
      }

      if (
        parsed.event === "error" &&
        isRecord(parsed.data)
      ) {
        const message =
          typeof parsed.data.message === "string"
            ? parsed.data.message
            : "ASTRA streaming performance probe failed.";
        throw new Error(message);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder
        .decode(value, { stream: true })
        .replace(/\r\n/g, "\n");

      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        handleBlock(block);
        boundary = buffer.indexOf("\n\n");
      }
    }

    buffer += decoder.decode().replace(/\r\n/g, "\n");
    if (buffer.trim()) handleBlock(buffer);

    if (finalResultMs === null) {
      throw new Error(
        "Ollama performance turn ended without a final ASTRA result.",
      );
    }

    return {
      headersMs,
      firstSseEventMs,
      providerSelectedMs,
      finalResultMs,
      provider,
    };
  } finally {
    timeout.clear();
  }
}

function summarizeNullable(
  values: readonly (number | null)[],
) {
  const present = values.filter(
    (value): value is number => value !== null,
  );
  return present.length > 0
    ? summarizeDurations(present)
    : null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeLoopbackBase(options.baseUrl);
  const startedAt = new Date().toISOString();

  const endpoints = [
    "/api/agent",
    "/api/automation",
    "/api/automation/service",
  ];

  const statusMeasurements: Record<
    string,
    EndpointMeasurement
  > = {};

  for (const endpoint of endpoints) {
    statusMeasurements[endpoint] =
      await measureEndpoint(
        baseUrl,
        endpoint,
        options.samples,
        options.timeoutMs,
      );
  }

  const ollamaTurns: OllamaTurnMeasurement[] = [];
  for (
    let index = 0;
    index < options.ollamaTurns;
    index += 1
  ) {
    ollamaTurns.push(
      await measureOllamaTurn(
        baseUrl,
        options.timeoutMs,
      ),
    );
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");
  const outputPath = path.resolve(
    options.output ||
      path.join(
        ".astra",
        "performance",
        `runtime-${timestamp}.json`,
      ),
  );

  const result = {
    schemaVersion: 1,
    startedAt,
    completedAt: new Date().toISOString(),
    baseUrl,
    environment: environmentSnapshot(),
    configuration: {
      statusSamples: options.samples,
      timeoutMs: options.timeoutMs,
      ollamaTurns: options.ollamaTurns,
    },
    statusMeasurements,
    ollama:
      ollamaTurns.length > 0
        ? {
            turns: ollamaTurns,
            summaries: {
              headersMs: summarizeDurations(
                ollamaTurns.map(
                  (turn) => turn.headersMs,
                ),
              ),
              firstSseEventMs: summarizeNullable(
                ollamaTurns.map(
                  (turn) => turn.firstSseEventMs,
                ),
              ),
              providerSelectedMs: summarizeNullable(
                ollamaTurns.map(
                  (turn) => turn.providerSelectedMs,
                ),
              ),
              finalResultMs: summarizeDurations(
                ollamaTurns.map(
                  (turn) => turn.finalResultMs,
                ),
              ),
            },
          }
        : {
            turns: [],
            summaries: null,
            note:
              "No Ollama turn was executed. Pass --ollama-turns N explicitly to measure local inference.",
          },
  };

  await mkdir(path.dirname(outputPath), {
    recursive: true,
  });
  await writeFile(
    outputPath,
    JSON.stringify(result, null, 2) + "\n",
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputPath,
        status: Object.fromEntries(
          Object.entries(statusMeasurements).map(
            ([key, value]) => [
              key,
              {
                coldMs: value.coldMs,
                p50Ms: value.overall.p50Ms,
                p95Ms: value.overall.p95Ms,
              },
            ],
          ),
        ),
        ollama:
          ollamaTurns.length > 0
            ? result.ollama.summaries
            : "not run",
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(
    safeErrorDetail(
      error,
      "ASTRA performance measurement failed.",
      1000,
    ),
  );
  process.exitCode = 1;
});
