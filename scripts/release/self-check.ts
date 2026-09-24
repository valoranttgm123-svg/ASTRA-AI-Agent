import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import { performance } from "node:perf_hooks";

import { normalizeLoopbackBase } from "../../lib/performance/loopback";
import {
  automationServiceReadiness,
  automationStoreReadiness,
  classifyWindowsStartupTasks,
  extractBrainReadiness,
  type ReadinessCheck,
} from "../../lib/release/readiness";
import {
  prepareReadinessEvidencePath,
} from "../../lib/release/private-output";
import { safeErrorDetail } from "../../lib/security/redaction";
import { WINDOWS_STARTUP_TASK_QUERY } from "../../lib/release/windows-task-probe";

type Options = {
  baseUrl: string;
  timeoutMs: number;
  output?: string;
};

type HttpEvidence = {
  ok: boolean;
  status: number;
  elapsedMs: number;
  payload: unknown;
};

type WindowsTaskRecord = {
  name: string;
  state: string;
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
    timeoutMs: 10_000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help") {
      console.log(
        [
          "ASTRA Phase 19 read-only readiness self-check",
          "",
          "Usage:",
          "  npm run release:self-check -- [options]",
          "",
          "Options:",
          "  --base <url>           ASTRA loopback URL (default http://127.0.0.1:3017)",
          "  --timeout-ms <n>        GET timeout, 250-120000 (default 10000)",
          "  --output <path>         must stay inside .astra/readiness/",
          "",
          "This command is read-only. It does not start/stop services, edit configuration, approve actions, or declare the release READY.",
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
        250,
        120_000,
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

function timeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException(
          "Readiness request timed out.",
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

async function getJson(
  baseUrl: string,
  endpoint: string,
  timeoutMs: number,
): Promise<HttpEvidence> {
  const timeout = timeoutSignal(timeoutMs);
  const started = performance.now();

  try {
    const response = await fetch(baseUrl + endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-astra-client": "1",
      },
      cache: "no-store",
      signal: timeout.signal,
    });

    const elapsedMs =
      Math.round((performance.now() - started) * 1000) / 1000;
    const text = await response.text();

    let payload: unknown = null;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }

    return {
      ok: response.ok && payload !== null,
      status: response.status,
      elapsedMs,
      payload,
    };
  } finally {
    timeout.clear();
  }
}

function httpFailure(
  label: string,
  evidence: HttpEvidence,
): ReadinessCheck {
  return {
    state: "ERROR",
    detail: `${label} GET failed or returned malformed JSON.`,
    data: {
      status: evidence.status,
      elapsedMs: evidence.elapsedMs,
    },
  };
}

function windowsTaskCheck(): ReadinessCheck {
  if (process.platform !== "win32") {
    return {
      state: "NOT_APPLICABLE",
      detail:
        "Windows scheduled-task inspection is only applicable on Windows.",
    };
  }

  try {
    const raw = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        WINDOWS_STARTUP_TASK_QUERY,
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 5000,
        windowsHide: true,
      },
    ).trim();

    const parsed = JSON.parse(raw) as unknown;
    const records = (
      Array.isArray(parsed) ? parsed : [parsed]
    ).filter(
      (item): item is WindowsTaskRecord =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as WindowsTaskRecord).name === "string" &&
        typeof (item as WindowsTaskRecord).state === "string",
    );

    const states = Object.fromEntries(
      records.map((record) => [
        record.name,
        record.state,
      ]),
    );

    return classifyWindowsStartupTasks(states);
  } catch (error) {
    return {
      state: "ERROR",
      detail:
        "Windows scheduled-task inspection failed: " +
        safeErrorDetail(error, "inspection failed", 300),
    };
  }
}

function sonorGate(): ReadinessCheck {
  return {
    state: "UNKNOWN",
    detail:
      "Real Sonor/Graphify/Obsidian readiness is intentionally not inferred by this self-check. Complete MEM-X against the actual local Sonor search API.",
    data: {
      requiredProcedure: "docs/SONOR_CODEX_MISSION.md",
    },
  };
}

function releaseVerdictWarning() {
  return [
    "This self-check is evidence only.",
    "It does not declare READY, READY WITH EXTERNAL CONFIGURATION REQUIRED, or BLOCKED.",
    "Phase 20 chooses a release status only after the required local/physical gates have real evidence.",
  ].join(" ");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeLoopbackBase(
    options.baseUrl,
  );
  const outputPath =
    prepareReadinessEvidencePath(
      options.output,
    );

  const [brainHttp, automationHttp, serviceHttp] =
    await Promise.all([
      getJson(baseUrl, "/api/agent", options.timeoutMs),
      getJson(baseUrl, "/api/automation", options.timeoutMs),
      getJson(
        baseUrl,
        "/api/automation/service",
        options.timeoutMs,
      ),
    ]);

  const brain = brainHttp.ok
    ? extractBrainReadiness(brainHttp.payload)
    : null;

  const checks = {
    astraHttp: {
      state: brainHttp.ok
        ? ("READY" as const)
        : ("ERROR" as const),
      detail: brainHttp.ok
        ? "ASTRA Brain status endpoint responded with valid JSON."
        : "ASTRA Brain status endpoint did not return a valid successful response.",
      data: {
        status: brainHttp.status,
        elapsedMs: brainHttp.elapsedMs,
        baseUrl,
      },
    },
    brain:
      brain?.brain ??
      httpFailure(
        "ASTRA Brain status",
        brainHttp,
      ),
    ollama:
      brain?.ollama ?? {
        state: "UNKNOWN" as const,
        detail:
          "Ollama readiness could not be derived because ASTRA Brain status failed.",
      },
    codex: brain
      ? {
          state:
            (brain.features.codex as
              | "READY"
              | "OFFLINE"
              | "NOT_CONFIGURED"
              | "ERROR"
              | "UNKNOWN"
              | undefined) ?? "UNKNOWN",
          detail:
            "Codex readiness is derived from the running ASTRA Brain feature status.",
        }
      : {
          state: "UNKNOWN" as const,
          detail:
            "Codex readiness could not be derived because ASTRA Brain status failed.",
        },
    cloud: brain
      ? {
          state:
            (brain.features.cloud as
              | "READY"
              | "OFFLINE"
              | "NOT_CONFIGURED"
              | "ERROR"
              | "UNKNOWN"
              | undefined) ?? "UNKNOWN",
          detail:
            "Optional cloud readiness is derived from the running ASTRA Brain feature status.",
        }
      : {
          state: "UNKNOWN" as const,
          detail:
            "Cloud readiness could not be derived because ASTRA Brain status failed.",
        },
    memory: brain
      ? {
          state:
            (brain.features.memory as
              | "READY"
              | "OFFLINE"
              | "NOT_CONFIGURED"
              | "ERROR"
              | "UNKNOWN"
              | undefined) ?? "UNKNOWN",
          detail:
            "Memory readiness is derived from the running ASTRA Brain feature status.",
        }
      : {
          state: "UNKNOWN" as const,
          detail:
            "Memory readiness could not be derived because ASTRA Brain status failed.",
        },
    tools: brain
      ? {
          state:
            (brain.features.tools as
              | "READY"
              | "OFFLINE"
              | "NOT_CONFIGURED"
              | "ERROR"
              | "UNKNOWN"
              | undefined) ?? "UNKNOWN",
          detail:
            "Tool Runtime readiness is derived from the running ASTRA Brain feature status.",
        }
      : {
          state: "UNKNOWN" as const,
          detail:
            "Tool Runtime readiness could not be derived because ASTRA Brain status failed.",
        },
    automationStore: automationHttp.ok
      ? automationStoreReadiness(
          automationHttp.payload,
        )
      : httpFailure(
          "Automation store",
          automationHttp,
        ),
    automationService: serviceHttp.ok
      ? automationServiceReadiness(
          serviceHttp.payload,
        )
      : httpFailure(
          "Automation service",
          serviceHttp,
        ),
    windowsStartupTasks: windowsTaskCheck(),
    sonor: sonorGate(),
  };

  const document = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    environment: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      node: process.version,
    },
    checks,
    capabilityStates:
      brain?.capabilities ?? {},
    featureStates:
      brain?.features ?? {},
    permissionSnapshot:
      brain?.permissions ?? null,
    releaseVerdict: "NOT_EVALUATED",
    warning: releaseVerdictWarning(),
    pendingLocalGates: [
      "Phase 14 target-PC Automation validation",
      "MEM-X real Sonor/Graphify/Obsidian validation",
      "Phase 16 target runtime/browser measurements",
      "Phase 17 real scenario evidence including Emergency STOP",
      "Level-3 UI proof where required",
    ],
  };

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
        checks: Object.fromEntries(
          Object.entries(checks).map(
            ([key, value]) => [
              key,
              value.state,
            ],
          ),
        ),
        releaseVerdict: "NOT_EVALUATED",
        note:
          "Read-only evidence captured. No service/configuration was changed and no release status was selected.",
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
      "ASTRA readiness self-check failed.",
      1000,
    ),
  );
  process.exitCode = 1;
});
