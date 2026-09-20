import { spawn } from "node:child_process";
import type {
  AstraToolAvailability,
  AstraToolDefinition,
  AstraToolHandler,
} from "./contracts";
import { runBoundedProcess } from "./process";

export type AstraComputerCapability =
  | "computer.process.list"
  | "computer.app.launch";

export type AstraComputerStatus = {
  configured: boolean;
  available: boolean;
  provider: string;
  detail: string;
  capabilities: AstraComputerCapability[];
};

export interface AstraComputerTransport {
  readonly provider: string;
  status(signal?: AbortSignal): Promise<AstraComputerStatus>;
  call(
    capability: AstraComputerCapability,
    input: unknown,
    signal: AbortSignal,
  ): Promise<{
    ok: boolean;
    verified: boolean;
    detail: string;
    output?: unknown;
  }>;
}

const CATALOG: readonly AstraToolDefinition[] = [
  {
    id: "computer.process.list",
    name: "Windows Process List",
    category: "computer",
    description:
      "Read a bounded Windows process list through the controlled Computer Agent.",
    permissionLevel: 1,
    sideEffect: "read",
    timeoutMs: 15_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "computer.app.launch",
    name: "Windows Launch Allowlisted App",
    category: "computer",
    description:
      "Launch one application from ASTRA's fixed allowlist. Arbitrary executable paths and command strings are not accepted.",
    permissionLevel: 2,
    sideEffect: "local_write",
    timeoutMs: 10_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
    inputSchema: {
      type: "object",
      required: ["appId"],
      properties: {
        appId: {
          type: "string",
          enum: ["notepad", "calculator", "paint", "explorer"],
        },
      },
    },
  },
];

export const COMPUTER_TOOL_DEFINITIONS: readonly AstraToolDefinition[] =
  CATALOG.map((definition) => ({ ...definition }));

const APP_ALLOWLIST: Readonly<Record<string, string>> = {
  notepad: "notepad.exe",
  calculator: "calc.exe",
  paint: "mspaint.exe",
  explorer: "explorer.exe",
};

function envEnabled() {
  const value = process.env.ASTRA_COMPUTER_ENABLED?.trim().toLowerCase();
  return Boolean(value && !["0", "false", "off", "no"].includes(value));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseTasklistCsv(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 250)
    .map((line) => {
      const fields: string[] = [];
      let current = "";
      let quoted = false;

      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"') {
          if (quoted && line[index + 1] === '"') {
            current += '"';
            index += 1;
          } else {
            quoted = !quoted;
          }
        } else if (char === "," && !quoted) {
          fields.push(current);
          current = "";
        } else {
          current += char;
        }
      }
      fields.push(current);

      const pid = Number(fields[1]);
      return {
        imageName: (fields[0] ?? "").slice(0, 260),
        pid: Number.isFinite(pid) ? pid : null,
        sessionName: (fields[2] ?? "").slice(0, 120),
        memory: (fields[4] ?? "").slice(0, 80),
      };
    })
    .filter((item) => item.imageName);
}

export class WindowsComputerTransport
  implements AstraComputerTransport
{
  readonly provider = "windows-controlled";

  async status(signal?: AbortSignal): Promise<AstraComputerStatus> {
    signal?.throwIfAborted();

    if (!envEnabled()) {
      return {
        configured: false,
        available: false,
        provider: this.provider,
        detail:
          "Computer Agent is OFF by default. Set ASTRA_COMPUTER_ENABLED=true to enable the controlled Windows adapter.",
        capabilities: [],
      };
    }

    if (process.platform !== "win32") {
      return {
        configured: true,
        available: false,
        provider: this.provider,
        detail:
          "Controlled Computer Agent is enabled but this runtime is not Windows.",
        capabilities: [],
      };
    }

    return {
      configured: true,
      available: true,
      provider: this.provider,
      detail:
        "Controlled Windows Computer Agent is enabled with fixed allowlisted capabilities only.",
      capabilities: [
        "computer.process.list",
        "computer.app.launch",
      ],
    };
  }

  async call(
    capability: AstraComputerCapability,
    input: unknown,
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();

    if (!envEnabled()) {
      return {
        ok: false,
        verified: false,
        detail: "Computer Agent is disabled by configuration.",
      };
    }
    if (process.platform !== "win32") {
      return {
        ok: false,
        verified: false,
        detail: "Computer Agent requires Windows.",
      };
    }

    if (capability === "computer.process.list") {
      const result = await runBoundedProcess({
        command: "tasklist.exe",
        args: ["/FO", "CSV", "/NH"],
        cwd: process.cwd(),
        signal,
      });

      if (result.exitCode !== 0) {
        return {
          ok: false,
          verified: false,
          detail: "Windows tasklist failed.",
        };
      }

      const processes = parseTasklistCsv(result.stdout);
      return {
        ok: true,
        verified: true,
        detail:
          "Read " +
          processes.length +
          " bounded Windows process" +
          (processes.length === 1 ? "." : "es."),
        output: { processes },
      };
    }

    if (capability === "computer.app.launch") {
      if (!isObject(input)) {
        return {
          ok: false,
          verified: false,
          detail: "computer.app.launch input must be an object.",
        };
      }

      const appId =
        typeof input.appId === "string"
          ? input.appId.trim().toLowerCase()
          : "";
      const executable = APP_ALLOWLIST[appId];

      if (!executable) {
        return {
          ok: false,
          verified: false,
          detail:
            "App is not in ASTRA's fixed allowlist: " +
            (appId || "(missing)") +
            ".",
        };
      }

      signal.throwIfAborted();
      const child = spawn(executable, [], {
        shell: false,
        windowsHide: false,
        detached: true,
        stdio: "ignore",
      });

      const started = await new Promise<number>((resolve, reject) => {
        let settled = false;

        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener("abort", onAbort);
          child.removeListener("spawn", onSpawn);
          child.removeListener("error", onError);

          if (error) reject(error);
          else if (typeof child.pid === "number" && child.pid > 0) {
            resolve(child.pid);
          } else {
            reject(
              new Error(
                "Windows did not return a verifiable process id.",
              ),
            );
          }
        };

        const onSpawn = () => finish();
        const onError = (error: Error) => finish(error);
        const onAbort = () => {
          child.kill();
          finish(
            signal.reason instanceof Error
              ? signal.reason
              : new DOMException(
                  "Computer launch cancelled.",
                  "AbortError",
                ),
          );
        };

        child.once("spawn", onSpawn);
        child.once("error", onError);

        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      });

      child.unref();

      return {
        ok: true,
        verified: true,
        detail: "Launched allowlisted app " + appId + ".",
        output: { appId, pid: started },
      };
    }

    return {
      ok: false,
      verified: false,
      detail: "Unsupported Computer Agent capability.",
    };
  }
}

export async function createComputerToolRegistrations(
  transport: AstraComputerTransport,
  signal?: AbortSignal,
): Promise<{
  definitions: AstraToolDefinition[];
  handlers: Record<string, AstraToolHandler>;
  status: AstraComputerStatus;
}> {
  const status = await transport.status(signal);
  const supported = new Set(status.capabilities ?? []);

  const unavailableState: AstraToolAvailability = status.configured
    ? "OFFLINE"
    : "NOT_CONFIGURED";

  const definitions = CATALOG.map((definition) => {
    const capability = definition.id as AstraComputerCapability;

    if (status.available && supported.has(capability)) {
      return {
        ...definition,
        provider: transport.provider,
        availability: "READY" as const,
      };
    }

    return {
      ...definition,
      provider: undefined,
      availability: status.available
        ? ("NOT_CONFIGURED" as const)
        : unavailableState,
    };
  });

  const handlers: Record<string, AstraToolHandler> = {};
  if (!status.available) {
    return { definitions, handlers, status };
  }

  for (const definition of definitions) {
    if (definition.availability !== "READY") continue;
    const capability = definition.id as AstraComputerCapability;

    handlers[definition.id] = async (input, context) => {
      const result = await transport.call(
        capability,
        input,
        context.signal,
      );

      if (!result.ok || !result.verified) {
        return {
          status: "failed",
          detail:
            result.detail ||
            "Computer Agent did not verify completion.",
          verified: false,
          output: result.output,
          provider: transport.provider,
        };
      }

      return {
        status: "completed",
        detail: result.detail || "Computer Agent verified completion.",
        verified: true,
        output: result.output,
        provider: transport.provider,
      };
    };
  }

  return { definitions, handlers, status };
}
