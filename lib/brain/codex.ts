import { spawn } from "node:child_process";
import path from "node:path";
import type { AstraAgent } from "@/lib/agent/types";
import type { AstraBrainPermissionSnapshot } from "./types";
import { safeErrorDetail, safePublicDetail } from "@/lib/security/redaction";
import { UNTRUSTED_RETRIEVED_CONTEXT_POLICY } from "./context-safety";
import { ASTRA_PERSONALITY_PROMPT } from "./personality";
import {
  shouldDetachOwnedProcess,
  terminateOwnedProcessTree,
} from "@/lib/process-tree";

const DEFAULT_TIMEOUT_MS = 180000;
const DEFAULT_STATUS_TIMEOUT_MS = 2500;
const MAX_STREAM_CHARS = 512000;

export type CodexStatus = {
  enabled: boolean;
  available: boolean;
  endpoint: string;
  model: string | null;
  sandbox: "read-only" | "workspace-write" | "danger-full-access";
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

export function codexMayReceiveMemory() {
  return envFlag("ASTRA_CODEX_INCLUDE_MEMORY", false);
}

function getCodexConfig(policy?: AstraBrainPermissionSnapshot) {
  const requestedSandbox = process.env.ASTRA_CODEX_SANDBOX?.trim();
  const dangerOptIn = envFlag("ASTRA_CODEX_ALLOW_DANGER_FULL_ACCESS", false);
  const sandbox: "read-only" | "workspace-write" | "danger-full-access" =
    requestedSandbox === "danger-full-access" &&
    dangerOptIn &&
    policy?.allowFileWrite &&
    policy.allowShell
      ? "danger-full-access"
      : requestedSandbox === "workspace-write" && policy?.allowFileWrite
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
      detached: shouldDetachOwnedProcess(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      terminateOwnedProcessTree(child);
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
        reject(
          new Error(
            safePublicDetail(
              stderr.trim(),
              `Codex CLI exited with code ${code}.`,
            ),
          ),
        );
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
        "Codex CLI unavailable: " +
        safeErrorDetail(
          error,
          "unavailable",
          500,
        ),
    };
  }
}

export function parseCodexLine(line: string) {
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
  executionRequested = false,
  verificationRequested = false,
  signal,
  onToken,
}: {
  input: string;
  agent: AstraAgent;
  context?: string;
  policyText?: string;
  policy: AstraBrainPermissionSnapshot;
  executionRequested?: boolean;
  verificationRequested?: boolean;
  signal?: AbortSignal;
  onToken?: (token: string) => void;
}) {
  // Chat and verification must stay read-only even when execution is enabled globally.
  const config = getCodexConfig(executionRequested && !verificationRequested ? policy : undefined);
  if (!config.enabled) throw new Error("Codex specialist is disabled.");
  const writableSandbox = config.sandbox !== "read-only";

  const prompt = [
    "You are ASTRA's Codex engineering specialist.",
    ASTRA_PERSONALITY_PROMPT,
    `Routed specialist: ${agent.name}.`,
    `Role: ${agent.role}.`,
    `Capabilities: ${agent.capabilities.join(", ")}.`,
    UNTRUSTED_RETRIEVED_CONTEXT_POLICY,
    policyText || "",
    context || "",
    "Operate only inside the configured workspace.",
    !writableSandbox
      ? "This turn is read-only: inspect, reason, diagnose, and propose patches, but do not modify files."
      : config.sandbox === "danger-full-access"
        ? "Danger-full-access was explicitly enabled by local ASTRA configuration. Stay inside the configured workspace, keep changes minimal, and never perform external actions unless the ASTRA policy explicitly permits them."
        : "Workspace writes are enabled by ASTRA policy. Keep changes minimal and verify them.",
    verificationRequested
      ? "VERIFICATION MODE: do not modify files. Run only read-only inspection or verification commands permitted by the sandbox, collect concrete evidence, and report what actually ran. End the final response with exactly one marker line: ASTRA_EXECUTION_STATUS: completed only if the requested verification actually ran and passed; otherwise use ASTRA_EXECUTION_STATUS: blocked or ASTRA_EXECUTION_STATUS: failed."
      : executionRequested
        ? writableSandbox
          ? "EXECUTION MODE: perform the requested task now inside the configured workspace. Do not merely describe a patch. Make the permitted changes, run relevant verification commands, and report what actually completed. End the final response with exactly one marker line: ASTRA_EXECUTION_STATUS: completed only if the requested change and verification actually succeeded; otherwise use ASTRA_EXECUTION_STATUS: blocked or ASTRA_EXECUTION_STATUS: failed."
          : "EXECUTION MODE was requested, but the Codex sandbox is read-only. Do not claim files were changed."
        : "CHAT MODE: inspect or reason as requested; do not make changes unless execution mode is explicitly requested.",
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
    "--cd",
    config.workdir,
  ];
  // Optional isolation avoids unrelated MCP/config startup during interactive chat.
  // Require an explicit model so isolating config cannot silently switch the user's model.
  if (envFlag("ASTRA_CODEX_ISOLATE_CONFIG", false)) {
    if (!config.model) throw new Error("Isolated Codex requests require ASTRA_CODEX_MODEL to preserve the selected model.");
    args.push("--ignore-user-config");
  }
  if (executionRequested && config.sandbox === "workspace-write") {
    args.push("--approve-for-me");
  } else {
    args.push("--sandbox", config.sandbox);
  }
  if (config.model) args.push("--model", config.model);
  args.push(prompt);

  const message = await new Promise<string>((resolve, reject) => {
    let stdoutBuffer = "";
    let stderr = "";
    let lastMessage = "";
    let streamedAgentText = "";
    let streamChars = 0;
    let settled = false;

    const child = spawn(config.command, args, {
      cwd: config.workdir,
      shell: false,
      windowsHide: true,
      detached: shouldDetachOwnedProcess(),
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      terminateOwnedProcessTree(child);

      if (error) {
        reject(error);
      } else if (lastMessage.trim()) {
        resolve(lastMessage.trim());
      } else {
        reject(new Error("Codex completed without a final agent message."));
      }
    };

    const timer = setTimeout(() => {
      finish(new Error("Codex specialist timed out."));
    }, config.timeoutMs);

    const streamAgentMessage = (text: string) => {
      if (!onToken || !text) return;

      if (!streamedAgentText) {
        streamedAgentText = text;
        onToken(text);
        return;
      }

      if (text.startsWith(streamedAgentText)) {
        const suffix = text.slice(streamedAgentText.length);
        streamedAgentText = text;
        if (suffix) onToken(suffix);
        return;
      }

      // If the CLI rewrites an in-progress message instead of extending it,
      // stop token forwarding for that update rather than duplicating or
      // fabricating text. The final response remains authoritative.
    };

    const consumeLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const event = parseCodexLine(trimmed);
      if (!event) return;

      if (
        (event.type === "item.updated" || event.type === "item.completed") &&
        event.item?.type === "agent_message" &&
        typeof event.item.text === "string"
      ) {
        streamAgentMessage(event.item.text);
        if (event.type === "item.completed") {
          lastMessage = event.item.text;
        }
      }

      if (event.type === "turn.completed") {
        finish();
      } else if (event.type === "turn.failed") {
        finish(
          new Error(
            safePublicDetail(
              event.error?.message,
              "Codex turn failed.",
            ),
          ),
        );
      } else if (event.type === "error" && event.message) {
        stderr = (
          stderr +
          "\n" +
          safePublicDetail(
            event.message,
            "Codex provider error.",
            2000,
          )
        ).slice(-8000);
      }
    };

    const abort = () => finish(new DOMException("ASTRA request cancelled.", "AbortError"));
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });

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
      stderr = (
        stderr +
        safePublicDetail(
          chunk.toString("utf8"),
          "Codex CLI error.",
          8000,
        )
      ).slice(-8000);
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
            safePublicDetail(
              stderr.trim(),
              `Codex CLI exited with code ${code ?? "unknown"} before completing.`,
            ),
          ),
        );
      }
    });
  });

  const executionMatch = message.match(
    /(?:^|\n)ASTRA_EXECUTION_STATUS:\s*(completed|blocked|failed)\s*$/i,
  );
  const executionStatus = executionMatch?.[1]?.toLowerCase() as
    | "completed"
    | "blocked"
    | "failed"
    | undefined;
  const cleanMessage = executionMatch
    ? message.slice(0, executionMatch.index).trim()
    : message;

  return {
    message: cleanMessage,
    endpoint: `local-cli:${commandLabel(config.command)}`,
    model: config.model || null,
    sandbox: config.sandbox,
    executionStatus,
  };
}
