import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { normalizeLoopbackBase } from "../../lib/performance/loopback";
import {
  isRecord,
  parseSseBlock,
} from "../../lib/performance/sse";
import { safeErrorDetail } from "../../lib/security/redaction";
import { extractValidationEvidence } from "../../lib/validation/evidence";
import { resolveValidationEvidencePath } from "../../lib/validation/private-output";

type ScenarioId = "A" | "B" | "C" | "D";
type ProviderChoice = "auto" | "ollama" | "codex";

type Options = {
  baseUrl: string;
  timeoutMs: number;
  provider: ProviderChoice;
  scenarios: ScenarioId[];
  output?: string;
};

const SCENARIOS: Record<
  ScenarioId,
  {
    title: string;
    prompt: string;
    purpose: string;
  }
> = {
  A: {
    title: "Project continuation",
    prompt:
      "lanjutkan project terakhir saya dan jelaskan apa yang belum selesai",
    purpose:
      "Capture project selection, memory sources, routing and provenance metadata.",
  },
  B: {
    title: "Engineering PR workflow preflight",
    prompt:
      "cek ASTRA, perbaiki error, test dan siapkan PR",
    purpose:
      "Capture planning, developer routing and approval requirements without executing writes or PR creation.",
  },
  C: {
    title: "ALURKA campaign preflight",
    prompt:
      "buat campaign ALURKA minggu depan",
    purpose:
      "Capture project isolation, strategy/marketing routing and provider truth without creating artifacts.",
  },
  D: {
    title: "Calendar + Email preflight",
    prompt:
      "cek jadwal saya dan siapkan email follow-up",
    purpose:
      "Capture communication/integration routing and approval truth without sending email or modifying calendar.",
  },
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

function parseScenarios(raw: string | undefined) {
  if (!raw) return ["A", "B", "C", "D"] as ScenarioId[];

  const values = raw
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  if (
    values.length === 0 ||
    values.some(
      (value) => !["A", "B", "C", "D"].includes(value),
    )
  ) {
    throw new Error(
      "--scenarios must contain only A,B,C,D.",
    );
  }

  return [...new Set(values)] as ScenarioId[];
}

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    baseUrl: "http://127.0.0.1:3017",
    timeoutMs: 120_000,
    provider: "auto",
    scenarios: ["A", "B", "C", "D"],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help") {
      console.log(
        [
          "ASTRA Phase 17 full-system preflight evidence runner",
          "",
          "Usage:",
          "  npm run validate:preflight -- [options]",
          "",
          "Options:",
          "  --base <url>           ASTRA loopback URL (default http://127.0.0.1:3017)",
          "  --timeout-ms <n>        Per scenario timeout, 1000-300000 (default 120000)",
          "  --provider <choice>     auto|ollama|codex (default auto)",
          "  --scenarios <list>      comma-separated A,B,C,D (default all)",
          "  --output <path>         must stay inside .astra/validation/",
          "",
          "This is a CHAT-MODE PREFLIGHT ONLY.",
          "It does not approve writes, create PRs, send email, modify calendar, or mark Phase 17 PASS.",
        ].join("\n"),
      );
      process.exit(0);
    }

    if (arg === "--base") {
      options.baseUrl = argv[++index] ?? "";
      continue;
    }
    if (arg === "--timeout-ms") {
      options.timeoutMs = parseInteger(
        argv[++index],
        "--timeout-ms",
        1000,
        300_000,
      );
      continue;
    }
    if (arg === "--provider") {
      const provider = argv[++index];
      if (
        provider !== "auto" &&
        provider !== "ollama" &&
        provider !== "codex"
      ) {
        throw new Error(
          "--provider must be auto, ollama, or codex.",
        );
      }
      options.provider = provider;
      continue;
    }
    if (arg === "--scenarios") {
      options.scenarios = parseScenarios(argv[++index]);
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

function timeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException(
          "Validation preflight timed out.",
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

function elapsedMs(started: number) {
  return Math.round(
    (performance.now() - started) * 1000,
  ) / 1000;
}

async function runScenario(
  baseUrl: string,
  provider: ProviderChoice,
  scenarioId: ScenarioId,
  timeoutMs: number,
) {
  const scenario = SCENARIOS[scenarioId];
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
          message: scenario.prompt,
          mode: "chat",
          provider,
        }),
        signal: timeout.signal,
      },
    );

    const headersMs = elapsedMs(started);
    if (!response.ok) {
      throw new Error(
        `Scenario ${scenarioId} returned HTTP ${response.status}.`,
      );
    }
    if (!response.body) {
      throw new Error(
        `Scenario ${scenarioId} returned no SSE body.`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let firstEventMs: number | null = null;
    let finalResultMs: number | null = null;
    let resultPayload: unknown = null;
    const liveEventTypes: string[] = [];

    const handleBlock = (block: string) => {
      const parsed = parseSseBlock(block);
      if (!parsed) return;

      if (firstEventMs === null) {
        firstEventMs = elapsedMs(started);
      }

      if (
        parsed.event === "brain" &&
        isRecord(parsed.data) &&
        typeof parsed.data.type === "string"
      ) {
        liveEventTypes.push(parsed.data.type);
      }

      if (parsed.event === "result") {
        resultPayload = parsed.data;
        finalResultMs = elapsedMs(started);
      }

      if (
        parsed.event === "error" &&
        isRecord(parsed.data)
      ) {
        const message =
          typeof parsed.data.message === "string"
            ? parsed.data.message
            : `Scenario ${scenarioId} failed.`;
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

    if (resultPayload === null || finalResultMs === null) {
      throw new Error(
        `Scenario ${scenarioId} ended without a final ASTRA result.`,
      );
    }

    return {
      id: scenarioId,
      title: scenario.title,
      purpose: scenario.purpose,
      captureStatus: "completed",
      timing: {
        headersMs,
        firstEventMs,
        finalResultMs,
      },
      evidence: extractValidationEvidence(
        resultPayload,
        liveEventTypes,
      ),
    };
  } finally {
    timeout.clear();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeLoopbackBase(
    options.baseUrl,
  );
  const outputPath = resolveValidationEvidencePath(
    options.output,
  );

  const results = [];
  for (const scenarioId of options.scenarios) {
    results.push(
      await runScenario(
        baseUrl,
        options.provider,
        scenarioId,
        options.timeoutMs,
      ),
    );
  }

  const document = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    baseUrl,
    providerChoice: options.provider,
    mode: "chat-preflight-only",
    warning:
      "This evidence capture does not mark Phase 17 PASS and does not prove external write/integration behavior.",
    scenarios: results,
    manualStillRequired: {
      scenarioE:
        "Emergency STOP must be executed against a real cancellable operation.",
      externalActions:
        "Engineering PR creation, email send/calendar modification and other Level-3 actions require explicit approved real execution.",
      sonor:
        "Real Sonor/Graphify/Obsidian validation remains required when configured.",
    },
  };

  await mkdir(path.dirname(outputPath), {
    recursive: true,
  });
  await writeFile(
    outputPath,
    JSON.stringify(document, null, 2) + "\n",
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputPath,
        scenarios: results.map((result) => ({
          id: result.id,
          captureStatus: result.captureStatus,
          provider: result.evidence.provider,
          execution: result.evidence.execution,
          project: result.evidence.project?.id ?? null,
          requiresApproval:
            result.evidence.requiresApproval,
          finalResultMs:
            result.timing.finalResultMs,
        })),
        note:
          "Preflight evidence captured. Phase 17 remains pending real execution.",
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
      "ASTRA full-system preflight failed.",
      1000,
    ),
  );
  process.exitCode = 1;
});
