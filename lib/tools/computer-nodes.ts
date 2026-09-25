import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  AstraComputerCapability,
  AstraComputerStatus,
  AstraComputerTransport,
} from "./computer";
import { WindowsComputerTransport } from "./computer";
import { runBoundedProcess, type AstraProcessResult } from "./process";

export type AstraComputerNodeTransport = "LOCAL" | "SSH";
export type AstraComputerNodeState =
  | "READY"
  | "OFFLINE"
  | "NOT_CONFIGURED"
  | "UNTRUSTED"
  | "IDENTITY_MISMATCH";

export type AstraComputerNode = {
  id: string;
  label: string;
  transport: AstraComputerNodeTransport;
  trusted: boolean;
  sshAlias?: string;
  expectedComputerName?: string;
};

export type AstraComputerNodeSnapshot = {
  id: string;
  label: string;
  transport: AstraComputerNodeTransport;
  trusted: boolean;
  state: AstraComputerNodeState;
  computerName?: string;
  detail: string;
};

export type AstraComputerNodesConfig = {
  version: 1;
  nodes: AstraComputerNode[];
};

export type AstraSshRunner = (
  node: AstraComputerNode,
  script: string,
  signal: AbortSignal,
) => Promise<AstraProcessResult>;

type AstraComputerCallResult = {
  ok: boolean;
  verified: boolean;
  detail: string;
  output?: unknown;
};

const NODE_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const SSH_ALIAS = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
const COMPUTER_NAME = /^[a-z0-9][a-z0-9-]{0,62}$/i;
const FORBIDDEN_NODE_KEYS =
  /^(?:password|passphrase|token|privatekey|private_key|keypath|key_path|identityfile|identity_file)$/i;
const ALLOWED_CONFIG_KEYS = new Set(["version", "nodes"]);
const ALLOWED_NODE_KEYS = new Set([
  "id",
  "label",
  "transport",
  "trusted",
  "sshAlias",
  "expectedComputerName",
]);

// Remote job tracking types and constants
const JOB_ID_PREFIX = "astra-job-";
const REMOTE_JOB_DIR = "$env:TEMP\\astra-jobs";
const HEARTBEAT_INTERVAL_MS = 5000;
const _LEASE_TIMEOUT_MS = 30000;

type RemoteJobInfo = {
  jobId: string;
  nodeId: string;
  startedAt: string;
  localPid: number | null;
  remotePid: number | null;
  status: "running" | "completed" | "aborted" | "timeout" | "disconnected";
  lastHeartbeat: string;
};

const activeRemoteJobs = new Map<string, RemoteJobInfo>();

function generateJobId(): string {
  return JOB_ID_PREFIX + randomUUID().replace(/-/g, "").slice(0, 16);
}

function registerRemoteJob(nodeId: string, localPid: number | null): string {
  const jobId = generateJobId();
  activeRemoteJobs.set(jobId, {
    jobId,
    nodeId,
    startedAt: new Date().toISOString(),
    localPid,
    remotePid: null,
    status: "running",
    lastHeartbeat: new Date().toISOString(),
  });
  return jobId;
}

function unregisterRemoteJob(jobId: string): void {
  activeRemoteJobs.delete(jobId);
}

function _getRemoteJob(jobId: string): RemoteJobInfo | undefined {
  return activeRemoteJobs.get(jobId);
}

function _setRemotePid(jobId: string, remotePid: number): void {
  const job = activeRemoteJobs.get(jobId);
  if (job) {
    job.remotePid = remotePid;
  }
}

function findForbiddenNodeKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findForbiddenNodeKey(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_NODE_KEYS.test(key)) return key;
    const found = findForbiddenNodeKey(nested);
    if (found) return found;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nodeConfigPath() {
  const configured = process.env.ASTRA_COMPUTER_NODES_FILE?.trim();
  return resolve(configured || ".astra/computer-nodes.json");
}

export function parseComputerNodesConfig(raw: string): AstraComputerNodesConfig {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error("ASTRA computer node config is not valid JSON.");
  }

  if (!isRecord(decoded) || decoded.version !== 1 || !Array.isArray(decoded.nodes)) {
    throw new Error("ASTRA computer node config must use version 1 and a nodes array.");
  }

  if (findForbiddenNodeKey(decoded)) {
    throw new Error(
      "ASTRA computer node config must not contain passwords, tokens, or private-key paths.",
    );
  }
  for (const key of Object.keys(decoded)) {
    if (!ALLOWED_CONFIG_KEYS.has(key)) {
      throw new Error(
        "ASTRA computer node config contains unsupported root field: " + key,
      );
    }
  }

  const nodes: AstraComputerNode[] = [];
  const ids = new Set<string>();

  for (const entry of decoded.nodes) {
    if (!isRecord(entry)) {
      throw new Error("ASTRA computer node entries must be objects.");
    }

    if (findForbiddenNodeKey(entry)) {
      throw new Error(
        "ASTRA computer node config must not contain passwords, tokens, or private-key paths.",
      );
    }
    for (const key of Object.keys(entry)) {
      if (!ALLOWED_NODE_KEYS.has(key)) {
        throw new Error(
          "ASTRA computer node config contains unsupported field: " + key,
        );
      }
    }

    const id = safeString(entry.id).toLowerCase();
    if (!NODE_ID.test(id) || id === "local") {
      throw new Error("Remote ASTRA computer node id is invalid or reserved.");
    }
    if (ids.has(id)) {
      throw new Error("Duplicate ASTRA computer node id: " + id);
    }
    ids.add(id);

    if (safeString(entry.transport).toUpperCase() !== "SSH") {
      throw new Error("Remote ASTRA computer nodes must use SSH transport.");
    }

    const label = safeString(entry.label) || id;
    const sshAlias = safeString(entry.sshAlias);
    const expectedComputerName = safeString(entry.expectedComputerName);
    const trusted = entry.trusted === true;

    if (!SSH_ALIAS.test(sshAlias)) {
      throw new Error("ASTRA SSH node " + id + " requires a safe SSH config alias.");
    }
    if (!COMPUTER_NAME.test(expectedComputerName)) {
      throw new Error(
        "ASTRA SSH node " +
          id +
          " requires expectedComputerName for fail-closed identity verification.",
      );
    }

    nodes.push({
      id,
      label: label.slice(0, 120),
      transport: "SSH",
      trusted,
      sshAlias,
      expectedComputerName,
    });
  }

  return { version: 1, nodes };
}

export function loadComputerNodesConfig(): AstraComputerNodesConfig {
  try {
    return parseComputerNodesConfig(readFileSync(nodeConfigPath(), "utf8"));
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
    if (code === "ENOENT") return { version: 1, nodes: [] };
    throw error;
  }
}

function encodePowerShell(script: string) {
  return Buffer.from(script, "utf16le").toString("base64");
}

function identityGuard(node: AstraComputerNode) {
  const expected = node.expectedComputerName!;
  return [
    "$ErrorActionPreference='Stop'",
    "$expected='" + expected + "'",
    "if ($env:COMPUTERNAME -ine $expected) {",
    "  [Console]::Error.WriteLine('ASTRA_IDENTITY_MISMATCH')",
    "  exit 86",
    "}",
  ].join("; ");
}

function powershellLiteralBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

function remoteShellScript(
  node: AstraComputerNode,
  shell: "powershell" | "cmd",
  command: string,
  cwd?: string,
) {
  const parts = [identityGuard(node)];
  if (cwd?.trim()) {
    const cwd64 = powershellLiteralBase64(cwd.trim());
    parts.push(
      "$astraCwd=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" +
        cwd64 +
        "'))",
      "Set-Location -LiteralPath $astraCwd",
    );
  }

  if (shell === "cmd") {
    const command64 = powershellLiteralBase64(command);
    parts.push(
      "$astraCmd=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" +
        command64 +
        "'))",
      "& cmd.exe /d /s /c $astraCmd",
      "if ($LASTEXITCODE -is [int]) { exit $LASTEXITCODE }",
    );
  } else {
    parts.push(command);
    parts.push("if ($LASTEXITCODE -is [int]) { exit $LASTEXITCODE }");
  }

  return parts.join("; ");
}

function buildRemoteScriptWithJobTracking(
  node: AstraComputerNode,
  script: string,
  jobId: string,
): string {
  const _encodedScript = encodePowerShell(script);
  const encodedJobId = powershellLiteralBase64(jobId);
  const encodedNodeId = powershellLiteralBase64(node.id);

  const jobScript = `
$astraJobId=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedJobId}'))
$astraNodeId=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedNodeId}'))
$astraJobDir="${REMOTE_JOB_DIR}"
$astraJobFile="$astraJobDir\\$astraJobId.json"
$astraPidFile="$astraJobDir\\$astraJobId.pid"

if (-not (Test-Path $astraJobDir)) { New-Item -ItemType Directory -Path $astraJobDir -Force | Out-Null }

$jobInfo = @{
  jobId = $astraJobId
  nodeId = $astraNodeId
  startedAt = (Get-Date).ToString("o")
  localPid = $null
  remotePid = $PID
  status = "running"
  heartbeat = (Get-Date).ToString("o")
} | ConvertTo-Json -Compress
$jobInfo | Out-File -FilePath $astraJobFile -Encoding UTF8 -Force
$PID | Out-File -FilePath $astraPidFile -Encoding ASCII -Force

function Update-Heartbeat {
  if (Test-Path $astraJobFile) {
    $job = Get-Content $astraJobFile -Raw | ConvertFrom-Json
    $job.heartbeat = (Get-Date).ToString("o")
    $job | ConvertTo-Json -Compress | Out-File -FilePath $astraJobFile -Encoding UTF8 -Force
  }
}

function Get-DescendantPids {
  param($RootPid)
  $allPids = @()
  $queue = @($RootPid)
  while ($queue.Count -gt 0) {
    $current = $queue[0]
    $queue = $queue[1..($queue.Count-1)]
    $allPids += $current
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$current" -ErrorAction SilentlyContinue
    if ($children) {
      foreach ($child in $children) {
        $queue += $child.ProcessId
      }
    }
  }
  return $allPids
}

function Cleanup-Job {
  if (Test-Path $astraPidFile) {
    $pid = Get-Content $astraPidFile -Raw
    if ($pid -match '^\d+$') {
      try {
        $allPids = Get-DescendantPids -RootPid $pid
        foreach ($p in $allPids) {
          Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        }
      } catch { }
    }
  }
  if (Test-Path $astraJobFile) { Remove-Item -Path $astraJobFile -Force -ErrorAction SilentlyContinue }
  if (Test-Path $astraPidFile) { Remove-Item -Path $astraPidFile -Force -ErrorAction SilentlyContinue }
}

$timer = New-Object System.Timers.Timer
$timer.Interval = ${HEARTBEAT_INTERVAL_MS}
$timer.AutoReset = $true
$timer.Elapsed += { Update-Heartbeat }
$timer.Start()

try {
  ${script}
  $exitCode = $LASTEXITCODE
  Cleanup-Job
  exit $exitCode
} catch {
  $exitCode = 1
  Cleanup-Job
  exit $exitCode
} finally {
  $timer.Stop()
  $timer.Dispose()
  if (Test-Path $astraJobFile) {
    $job = Get-Content $astraJobFile -Raw | ConvertFrom-Json
    $job.status = "completed"
    $job.heartbeat = (Get-Date).ToString("o")
    $job | ConvertTo-Json -Compress | Out-File -FilePath $astraJobFile -Encoding UTF8 -Force
  }
}
`;

  return jobScript;
}

async function runRemoteCleanup(
  node: AstraComputerNode,
  jobId: string,
  sshRunner?: AstraSshRunner,
): Promise<void> {
  if (!node.sshAlias) return;

  const cleanupScript = `
$astraJobId="${jobId}"
$astraNodeId="${node.id}"
$astraExpectedComputerName="${node.expectedComputerName}"
$astraJobDir="${REMOTE_JOB_DIR}"
$astraJobFile="$astraJobDir\\$astraJobId.json"
$astraPidFile="$astraJobDir\\$astraJobId.pid"

# Identity guard before any cleanup
$expected = "$astraExpectedComputerName"
if ($env:COMPUTERNAME -ine $expected) {
  [Console]::Error.WriteLine('ASTRA_IDENTITY_MISMATCH')
  exit 86
}

if (Test-Path $astraPidFile) {
  $pid = Get-Content $astraPidFile -Raw
  if ($pid -match '^\d+$') {
    try {
      $allPids = @()
      $queue = @($pid)
      while ($queue.Count -gt 0) {
        $current = $queue[0]
        $queue = $queue[1..($queue.Count-1)]
        $allPids += $current
        $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$current" -ErrorAction SilentlyContinue
        if ($children) {
          foreach ($child in $children) {
            $queue += $child.ProcessId
          }
        }
      }
      foreach ($p in $allPids) {
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
      }
    } catch { }
  }
  if (Test-Path $astraJobFile) { Remove-Item -Path $astraJobFile -Force -ErrorAction SilentlyContinue }
  if (Test-Path $astraPidFile) { Remove-Item -Path $astraPidFile -Force -ErrorAction SilentlyContinue }
`;

  const runner = sshRunner ?? runWindowsSshPowerShell;

  await runner(node, cleanupScript, new AbortController().signal);
}

async function runWindowsSshPowerShellWithCleanup(
  node: AstraComputerNode,
  script: string,
  signal: AbortSignal,
  sshRunner?: AstraSshRunner,
): Promise<AstraProcessResult> {
  if (!node.sshAlias) {
    throw new Error("SSH node has no configured alias.");
  }

  const jobId = registerRemoteJob(node.id, null);

  const runner = sshRunner ?? runWindowsSshPowerShell;

  const processPromise = runner(node, buildRemoteScriptWithJobTracking(node, script, jobId), signal);

  const abortHandler = () => {
    if (jobId) {
      runRemoteCleanup(node, jobId, sshRunner).catch(() => {});
    }
  };

  signal.addEventListener("abort", abortHandler, { once: true });

  try {
    const result = await processPromise;
    signal.removeEventListener("abort", abortHandler);
    unregisterRemoteJob(jobId);
    return result;
  } catch (error) {
    signal.removeEventListener("abort", abortHandler);
    await runRemoteCleanup(node, jobId, sshRunner).catch(() => {});
    unregisterRemoteJob(jobId);
    throw error;
  }
}

export async function runWindowsSshPowerShell(
  node: AstraComputerNode,
  script: string,
  signal: AbortSignal,
): Promise<AstraProcessResult> {
  if (!node.sshAlias) {
    throw new Error("SSH node has no configured alias.");
  }

  const jobId = registerRemoteJob(node.id, null);

  const remoteCommand =
    "powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand " +
    encodePowerShell(buildRemoteScriptWithJobTracking(node, script, jobId));

  const _localPid: number | null = null;

  const result = await runBoundedProcess({
    command: process.platform === "win32" ? "ssh.exe" : "ssh",
    args: [
      "-T",
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=8",
      "-o",
      "ConnectionAttempts=1",
      "-o",
      "ServerAliveInterval=5",
      "-o",
      "ServerAliveCountMax=1",
      node.sshAlias,
      remoteCommand,
    ],
    cwd: process.cwd(),
    signal,
  });

  unregisterRemoteJob(jobId);

  return result;
}

function normalizeNodeId(input: unknown) {
  if (!isRecord(input)) return "local";
  const value = safeString(input.nodeId).toLowerCase();
  return value || "local";
}

function withoutNodeId(input: unknown) {
  if (!isRecord(input) || !("nodeId" in input)) return input;
  const { nodeId: _nodeId, ...rest } = input;
  return rest;
}

function remoteFailure(
  node: AstraComputerNode,
  result: AstraProcessResult,
  fallback: string,
): AstraComputerCallResult {
  if (
    result.exitCode === 86 ||
    result.stderr.includes("ASTRA_IDENTITY_MISMATCH")
  ) {
    return {
      ok: false,
      verified: false,
      detail:
        "SSH target identity did not match registered node " + node.id + ".",
      output: {
        nodeId: node.id,
        transport: "SSH",
        exitCode: result.exitCode,
      },
    };
  }

  return {
    ok: false,
    verified: false,
    detail: fallback,
    output: {
      nodeId: node.id,
      transport: "SSH",
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    },
  };
}

export class MultiNodeWindowsComputerTransport
  implements AstraComputerTransport
{
  readonly provider = "windows-multi-node";

  constructor(
    private readonly options: {
      local?: AstraComputerTransport;
      loadNodes?: () => AstraComputerNodesConfig;
      runSsh?: AstraSshRunner;
    } = {},
  ) {}

  private local() {
    return this.options.local ?? new WindowsComputerTransport();
  }

  private nodes() {
    return (this.options.loadNodes ?? loadComputerNodesConfig)().nodes;
  }

  private ssh() {
    const customRunner = this.options.runSsh;
    if (customRunner) {
      return (node: AstraComputerNode, script: string, signal: AbortSignal) =>
        runWindowsSshPowerShellWithCleanup(node, script, signal, customRunner);
    }
    return runWindowsSshPowerShellWithCleanup;
  }

  async status(signal?: AbortSignal): Promise<AstraComputerStatus> {
    const localStatus = await this.local().status(signal);
    signal?.throwIfAborted();

    let nodes: AstraComputerNode[];
    try {
      nodes = this.nodes();
    } catch (error) {
      return {
        ...localStatus,
        provider: this.provider,
        detail:
          localStatus.detail +
          " Remote node config is invalid: " +
          (error instanceof Error ? error.message : "unknown configuration error"),
      };
    }

    const trustedRemote = nodes.filter((node) => node.trusted);
    const capabilities = new Set<AstraComputerCapability>(
      localStatus.capabilities,
    );

    if (localStatus.configured || trustedRemote.length > 0) {
      capabilities.add("computer.nodes.list");
      capabilities.add("computer.system.info");
      capabilities.add("computer.process.list");
    }
    if (
      localStatus.capabilities.includes("computer.owner.exec") &&
      trustedRemote.length > 0
    ) {
      capabilities.add("computer.owner.exec");
    }

    return {
      configured: localStatus.configured || nodes.length > 0,
      available: localStatus.available,
      provider: this.provider,
      detail:
        localStatus.detail +
        " Registered remote SSH nodes: " +
        nodes.length +
        " (" +
        trustedRemote.length +
        " trusted). Remote health is probed per-node and never inferred from another node.",
      capabilities: [...capabilities],
    };
  }

  private findRemoteNode(nodeId: string) {
    return this.nodes().find((node) => node.id.toLowerCase() === nodeId);
  }

  private async remoteSystemInfo(
    node: AstraComputerNode,
    signal: AbortSignal,
  ): Promise<AstraComputerCallResult> {
    const script = [
      identityGuard(node),
      "$v=[Environment]::OSVersion.Version.ToString()",
      "$payload=[pscustomobject]@{computerName=$env:COMPUTERNAME;platform='win32';release=$v;version=$v;architecture=$env:PROCESSOR_ARCHITECTURE}",
      "$payload | ConvertTo-Json -Compress",
    ].join("; ");

    const result = await this.ssh()(node, script, signal);
    if (result.exitCode !== 0) {
      return remoteFailure(node, result, "SSH system-info probe failed for node " + node.id + ".");
    }

    try {
      const output = JSON.parse(result.stdout.trim()) as Record<string, unknown>;
      if (
        safeString(output.computerName).toLowerCase() !==
        node.expectedComputerName!.toLowerCase()
      ) {
        return {
          ok: false,
          verified: false,
          detail: "SSH target identity did not match registered node " + node.id + ".",
        };
      }
      return {
        ok: true,
        verified: true,
        detail: "Verified remote Windows identity for node " + node.id + ".",
        output: {
          ...output,
          nodeId: node.id,
          nodeLabel: node.label,
          transport: "SSH",
        },
      };
    } catch {
      return {
        ok: false,
        verified: false,
        detail: "SSH system-info probe returned invalid structured evidence.",
      };
    }
  }

  private async remoteProcessList(
    node: AstraComputerNode,
    signal: AbortSignal,
  ): Promise<AstraComputerCallResult> {
    const script = [
      identityGuard(node),
      "$items=@(Get-Process | Sort-Object Id | Select-Object -First 250 | ForEach-Object {[pscustomobject]@{imageName=$_.ProcessName;pid=$_.Id;sessionName='';memory=[string]$_.WorkingSet64}})",
      "ConvertTo-Json -InputObject $items -Compress",
    ].join("; ");
    const result = await this.ssh()(node, script, signal);
    if (result.exitCode !== 0) {
      return remoteFailure(node, result, "SSH process-list probe failed for node " + node.id + ".");
    }

    try {
      const processes = JSON.parse(result.stdout.trim());
      if (!Array.isArray(processes)) throw new Error("not-array");
      return {
        ok: true,
        verified: true,
        detail:
          "Read " + processes.length + " bounded remote Windows processes from node " + node.id + ".",
        output: {
          nodeId: node.id,
          nodeLabel: node.label,
          transport: "SSH",
          processes,
        },
      };
    } catch {
      return {
        ok: false,
        verified: false,
        detail: "SSH process-list probe returned invalid structured evidence.",
      };
    }
  }

  private async remoteOwnerExec(
    node: AstraComputerNode,
    input: unknown,
    signal: AbortSignal,
  ): Promise<AstraComputerCallResult> {
    if (!node.trusted) {
      return {
        ok: false,
        verified: false,
        detail: "Remote node " + node.id + " is registered but not trusted.",
      };
    }
    if (!isRecord(input)) {
      return {
        ok: false,
        verified: false,
        detail: "computer.owner.exec input must be an object.",
      };
    }

    const command = safeString(input.command);
    if (!command || command.length > 8192) {
      return {
        ok: false,
        verified: false,
        detail: "Owner Mode command is missing or exceeds 8192 characters.",
      };
    }

    const shell =
      safeString(input.shell).toLowerCase() === "cmd" ? "cmd" : "powershell";
    const cwd = safeString(input.cwd) || undefined;
    const script = remoteShellScript(node, shell, command, cwd);

    const result = await runWindowsSshPowerShellWithCleanup(node, script, signal, this.ssh());

    if (result.exitCode !== 0) {
      return remoteFailure(
        node,
        result,
        "Remote Owner Mode command failed on node " + node.id + ".",
      );
    }

    return {
      ok: true,
      verified: true,
      detail:
        "Remote Owner Mode command completed on node " +
        node.id +
        " with exit code 0.",
      output: {
        nodeId: node.id,
        nodeLabel: node.label,
        transport: "SSH",
        shell,
        cwd: cwd ?? null,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      },
    };
  }

  private async nodeSnapshots(signal: AbortSignal) {
    const localStatus = await this.local().status(signal);
    const localSnapshot: AstraComputerNodeSnapshot = {
      id: "local",
      label: "Local computer",
      transport: "LOCAL",
      trusted: localStatus.available,
      state: localStatus.available
        ? "READY"
        : localStatus.configured
          ? "OFFLINE"
          : "NOT_CONFIGURED",
      detail: localStatus.detail,
    };

    let nodes: AstraComputerNode[];
    try {
      nodes = this.nodes();
    } catch (error) {
      return [
        localSnapshot,
        {
          id: "remote-config",
          label: "Remote node configuration",
          transport: "SSH" as const,
          trusted: false,
          state: "NOT_CONFIGURED" as const,
          detail:
            error instanceof Error
              ? error.message
              : "Remote node configuration is invalid.",
        },
      ];
    }

    const remote = await Promise.all(
      nodes.map(async (node): Promise<AstraComputerNodeSnapshot> => {
        if (!node.trusted) {
          return {
            id: node.id,
            label: node.label,
            transport: "SSH",
            trusted: false,
            state: "UNTRUSTED",
            detail: "Node is registered but not trusted for execution.",
          };
        }

        try {
          const result = await this.remoteSystemInfo(node, signal);
          if (!result.ok || !result.verified) {
            return {
              id: node.id,
              label: node.label,
              transport: "SSH",
              trusted: true,
              state: result.detail.includes("identity")
                ? "IDENTITY_MISMATCH"
                : "OFFLINE",
              detail: result.detail,
            };
          }
          const output = isRecord(result.output) ? result.output : {};
          return {
            id: node.id,
            label: node.label,
            transport: "SSH",
            trusted: true,
            state: "READY",
            computerName: safeString(output.computerName) || undefined,
            detail: result.detail,
          };
        } catch {
          return {
            id: node.id,
            label: node.label,
            transport: "SSH",
            trusted: true,
            state: "OFFLINE",
            detail: "SSH node did not complete its bounded health probe.",
          };
        }
      }),
    );

    return [localSnapshot, ...remote];
  }

  async call(
    capability: AstraComputerCapability,
    input: unknown,
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();

    const localStatus = await this.local().status(signal);
    if (!localStatus.available) {
      return {
        ok: false,
        verified: false,
        detail:
          "Computer Agent is disabled or unavailable on this hub. ASTRA did not attempt remote execution.",
      };
    }
    if (
      capability === "computer.owner.exec" &&
      !localStatus.capabilities.includes("computer.owner.exec")
    ) {
      return {
        ok: false,
        verified: false,
        detail:
          "Owner Mode is disabled by configuration. ASTRA did not attempt remote execution.",
      };
    }

    if (capability === "computer.nodes.list") {
      return {
        ok: true,
        verified: true,
        detail: "Computer node inventory was probed independently per node.",
        output: { nodes: await this.nodeSnapshots(signal) },
      };
    }

    const nodeId = normalizeNodeId(input);
    if (nodeId === "local") {
      const result = await this.local().call(
        capability,
        withoutNodeId(input),
        signal,
      );
      if (!result.output || !isRecord(result.output)) return result;
      return {
        ...result,
        output: {
          nodeId: "local",
          nodeLabel: "Local computer",
          transport: "LOCAL",
          ...result.output,
        },
      };
    }

    let node: AstraComputerNode | undefined;
    try {
      node = this.findRemoteNode(nodeId);
    } catch (error) {
      return {
        ok: false,
        verified: false,
        detail:
          "Remote node configuration is invalid: " +
          (error instanceof Error ? error.message : "unknown configuration error"),
      };
    }

    if (!node) {
      return {
        ok: false,
        verified: false,
        detail:
          "Unknown ASTRA computer node '" +
          nodeId +
          "'. ASTRA did not fall back to another machine.",
      };
    }
    if (!node.trusted) {
      return {
        ok: false,
        verified: false,
        detail:
          "ASTRA computer node '" +
          nodeId +
          "' is not trusted. No remote command was attempted.",
      };
    }

    if (capability === "computer.system.info") {
      return this.remoteSystemInfo(node, signal);
    }
    if (capability === "computer.process.list") {
      return this.remoteProcessList(node, signal);
    }
    if (capability === "computer.owner.exec") {
      return this.remoteOwnerExec(node, input, signal);
    }

    return {
      ok: false,
      verified: false,
      detail:
        "Capability " +
        capability +
        " is not available through remote SSH transport. ASTRA did not fall back to local execution.",
    };
  }
}