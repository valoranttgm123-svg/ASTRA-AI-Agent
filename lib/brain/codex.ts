import { spawn } from "node:child_process";
import path from "node:path";
import type { AstraAgent } from "@/lib/agent/types";
import type { AstraBrainPermissionSnapshot } from "./types";

const DEFAULT_TIMEOUT_MS = 180000;
const DEFAULT_STATUS_TIMEOUT_MS = 2500;
const MAX_STREAM_CHARS = 512000;

export type CodexStatus = {
  enabled: boolean;
  available: boolean;
  endpoint: string;
  model: string | null;
  sandbox: "read-only" | "workspace-write";
  detail: string;
};

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "off", "no"].includes(value);
}

function parseTimeout(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 500 ? parsed : fallback;
}

function getCodexConfig(policy?: AstraBrainPermissionSnapshot) {
  const requestedSandbox = process.env.ASTRA_CODEX_SANDBOX?.trim();
  const sandbox: "read-only" | "workspace-write" =
    requestedSandbox === "workspace-write" && policy?.allowFileWrite
      ? "workspace-write"
      : "read-only";

  return {
    enabled: envFlag("ASTRA_CODEX_ENABLED", true),
    command: process.env.ASTRA_CODEX_COMMAND?.trim() || "codex",
    workdir: path.resolve(process.env.ASTRA_CODEX_WORKDIR?.trim() || process.cwd()),
    model: process.env.ASTRA_CODEX_MODEL?.trim() || "",
    timeoutMs: parseTimeout(process.env.ASTRA_CODEX_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    statusTimeoutMs: parseTimeout(
      process.env.ASTRA_CODEX_STATUS_TIMEOUT_MS,
      DEFAULT_STATUS_TIMEOUT_MS,
    ),
    sandbox,
  };
}

function commandLabel(command: string) {
  return path.basename(command).replace(/\.(cmd|exe)$/i, "") || "codex";
}

async function versionProbe(command: string, timeoutMs: number) {
  return new Promise<string>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const child = spawn(command, ["--version"], {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill();
      } catch {
        // Ignore shutdown errors.
      }
      reject(new Error("Codex CLI status check timed out."));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout.trim() || stderr.trim() || "Codex CLI");
      } else {
        reject(new Error(stderr.trim() || `Codex CLI exited with code ${code}.`));
      }
    });
  });
}

export async function getCodexStatus(
  policy?: AstraBrainPermissionSnapshot,
): Promise<CodexStatus> {
  const config = getCodexConfig(policy);
  const endpoint = `local-cli:${commandLabel(config.command)}`;

  if (!config.enabled) {
    return {
      enabled: false,
      available: false,
      endpoint,
      model: config.model || null,
      sandbox: config.sandbox,
      detail: "Codex specialist is disabled by ASTRA_CODEX_ENABLED.",
    };
  }

  try {
    const version = await versionProbe(config.command, config.statusTimeoutMs);
    return {
      enabled: true,
      available: true,
      endpoint,
      model: config.model || null,
      sandbox: config.sandbox,
      detail: `${version} is available through the local authenticated CLI in ${config.sandbox} sandbox mode.`,
    };
  } catch (error) {
    return {
      enabled: true,
      available: false,
      endpoint,
      model: config.model || null,
      sandbox: config.sandbox,
      detail:
        error instanceof Error
          ? `Codex CLI unavailable: ${error.message}`
          : "Codex CLI unavailable.",
    };
  }
}

function parseCodexLine(line: string) {
  try {
    return JSON.parse(line) as {
      type?: string;
      message?: string;
      error?: { message?: string };
      item?: {
        type?: string;
        text?: string;
        message?: string;
      };
    };
  } catch {
    return null;
  }
}

export async function chatWithCodex({
  input,
  agent,
  context,
  policyText,
  policy,
}: {
  input: string;
  agent: AstraAgent;
  context?: string;
  policyText?: string;
  policy: AstraBrainPermissionSnapshot;
}) {
  const config = getCodexConfig(policy);
  if (!config.enabled) throw new Error("Codex specialist is disabled.");

  const prompt = [
    "You are ASTRA's Codex engineering specialist.",
    `Routed specialist: ${agent.name}.`,
    `Role: ${agent.role}.`,
    `Capabilities: ${agent.capabilities.join(", ")}.`,
    policyText || "",
    context || "",
    "Operate only inside the configured workspace.",
    config.sandbox === "read-only"
      ? "This turn is read-only: inspect, reason, diagnose, and propose patches, but do not modify files."
      : "Workspace writes are enabled by ASTRA policy. Keep changes minimal and verify them.",
    "Do not use paid APIs or external side effects unless the ASTRA policy explicitly allows them.",
    "Return a concise final result in the same language as the user.",
    "",
    "USER REQUEST:",
    input,
  ]
    .filter(Boolean)
    .join("\n");

  const args = [
    "exec",
    "--json",
    "--ephemeral",
    "--skip-git-repo-check",
    "--sandbox",
    config.sandbox,
    "--cd",
    config.workdir,
  ];
  if (config.model) args.push("--model", config.model);
  args.push(prompt);

  const message = await new Promise<string>((resolve, reject) => {
    let stdoutBuffer = "";
    let stderr = "";
    let lastMessage = "";
    let streamChars = 0;
    let settled = false;

    const child = spawn(config.command, args, {
      cwd: config.workdir,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (!child.killed) child.kill();
      } catch {
        // Ignore cleanup errors after a completed turn.
      }

      if (error) {
        reject(error);
      } else if (lastMessage.trim()) {
        resolve(lastMessage.trim());
      } else {
        reject(new Error("Codex completed without a final agent message."));
      }
    };

    const consumeLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const event = parseCodexLine(trimmed);
      if (!event) return;

      if (
        event.type === "item.completed" &&
        event.item?.type === "agent_message" &&
        typeof event.item.text === "string"
      ) {
        lastMessage = event.item.text;
      }

      if (event.type === "turn.completed") {
        finish();
      } else if (event.type === "turn.failed") {
        finish(new Error(event.error?.message || "Codex turn failed."));
      } else if (event.type === "error" && event.message) {
        stderr += `\n${event.message}`;
      }
    };

    const timer = setTimeout(() => {
      finish(new Error("Codex specialist timed out."));
    }, config.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      streamChars += text.length;
      if (streamChars > MAX_STREAM_CHARS) {
        finish(new Error("Codex JSON stream exceeded the ASTRA safety limit."));
        return;
      }

      stdoutBuffer += text;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) consumeLine(line);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString("utf8")).slice(-8000);
    });

    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (settled) return;
      if (stdoutBuffer.trim()) consumeLine(stdoutBuffer);
      if (code === 0 && lastMessage.trim()) {
        finish();
      } else {
        finish(
          new Error(
            stderr.trim() ||
              `Codex CLI exited with code ${code ?? "unknown"} before completing.`,
          ),
        );
      }
    });
  });

  return {
    message,
    endpoint: `local-cli:${commandLabel(config.command)}`,
    model: config.model || null,
    sandbox: config.sandbox,
  };
}
