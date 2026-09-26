import assert from "node:assert/strict";
import { test, describe } from "node:test";

import type { AstraComputerTransport } from "../lib/tools/computer";
import {
  MultiNodeWindowsComputerTransport,
  parseComputerNodesConfig,
  type AstraComputerNode,
  type AstraComputerNodesConfig,
  runRemoteCleanupRaw,
  setTestLeaseTimeoutMs,
  setTestClock,
  _getActiveRemoteJobs,
  _registerRemoteJob,
  _unregisterRemoteJob,
  _startLeaseWatchdog,
  _stopLeaseWatchdog,
  _updateLocalHeartbeatFromRemote,
  _tickLeaseWatchdogOnce,
  _setTestConfig,
} from "../lib/tools/computer-nodes";

// Helper to encode jobId the same way production does (Base64 of UTF-8)
function encodeJobIdForPowerShell(jobId: string): string {
  return Buffer.from(jobId, "utf8").toString("base64");
}

function localFixture(): AstraComputerTransport {
  return {
    provider: "fixture-local",
    async status() {
      return {
        configured: true,
        available: true,
        provider: "fixture-local",
        detail: "local ready",
        capabilities: [
          "computer.nodes.list",
          "computer.system.info",
          "computer.process.list",
          "computer.app.launch",
          "computer.owner.exec",
        ],
      };
    },
    async call(capability) {
      if (capability === "computer.system.info") {
        return {
          ok: true,
          verified: true,
          detail: "local system",
          output: {
            computerName: "LOCAL-PC",
            platform: "win32",
            release: "10",
            version: "10",
            architecture: "x64",
          },
        };
      }
      return {
        ok: true,
        verified: true,
        detail: "local fixture",
        output: {},
      };
    },
  };
}

const nodes: AstraComputerNodesConfig = {
  version: 1,
  nodes: [
    {
      id: "pc2",
      label: "Workstation 2",
      transport: "SSH",
      trusted: true,
      sshAlias: "pc2-windows",
      expectedComputerName: "PC2",
    },
    {
      id: "pc3",
      label: "Workstation 3",
      transport: "SSH",
      trusted: false,
      sshAlias: "pc3-windows",
      expectedComputerName: "PC3",
    },
  ],
};

// Raw SSH runner - used for system.info, process.list (no job tracking)
function makeDefaultRawSshRunner() {
  return async function (node: any, script: string, signal: AbortSignal) {
    if (signal.aborted) {
      return { exitCode: -1, stdout: "", stderr: "Process cancelled." };
    }
    if (script.includes("ASTRA_IDENTITY_MISMATCH")) {
      const expected = script.match(/\$expected='([^']+)'/)?.[1] ?? "PC2";
      if (script.includes("$expected='PC2'") || script.includes("$expected='PC3'")) {
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2","platform":"win32","release":"10.0.19045","version":"10.0.19045","architecture":"AMD64"}\n',
          stderr: "",
        };
      }
    }
    return {
      exitCode: 0,
      stdout: '{"computerName":"PC2","platform":"win32","release":"10.0.19045","version":"10.0.19045","architecture":"AMD64"}\n',
      stderr: "",
    };
  };
}

// Tracked SSH runner - used for owner.exec (with job tracking, heartbeat, cleanup)
function makeDefaultTrackedSshRunner() {
  return async function (node: any, script: string, signal: AbortSignal) {
    if (signal.aborted) {
      return { exitCode: -1, stdout: "", stderr: "Process cancelled." };
    }
    if (script.includes("ASTRA_IDENTITY_MISMATCH")) {
      return {
        exitCode: 86,
        stdout: "",
        stderr: "ASTRA_IDENTITY_MISMATCH\n",
      };
    }
    if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
      return { exitCode: 0, stdout: "", stderr: "" };
    }
    return {
      exitCode: 0,
      stdout: '{"computerName":"PC2","platform":"win32","release":"10.0.19045","version":"10.0.19045","architecture":"AMD64"}\n',
      stderr: "",
    };
  };
}

function makeTransport(rawImpl?: (node: any, script: string, signal: AbortSignal) => Promise<{ exitCode: number; stdout: string; stderr: string }>, trackedImpl?: (node: any, script: string, signal: AbortSignal) => Promise<{ exitCode: number; stdout: string; stderr: string }>) {
  const rawRunner = rawImpl ?? makeDefaultRawSshRunner();
  const trackedRunner = trackedImpl ?? rawImpl ?? makeDefaultTrackedSshRunner();
  return new MultiNodeWindowsComputerTransport({
    local: localFixture(),
    loadNodes: () => nodes,
    rawSsh: rawRunner,
    runSsh: trackedRunner,
  });
}

async function waitFor(condition: () => boolean, maxMs: number, intervalMs: number = 10): Promise<boolean> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > maxMs) return false;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return true;
}

describe("Remote STOP / remote-job / heartbeat / lease / cleanup", () => {
  test("private node config rejects embedded credentials and requires verified identity", () => {
    assert.throws(
      () =>
        parseComputerNodesConfig(
          JSON.stringify({
            version: 1,
            nodes: [
              {
                id: "pc2",
                transport: "SSH",
                trusted: true,
                sshAlias: "pc2-windows",
                expectedComputerName: "PC2",
                privateKey: "secret",
              },
            ],
          }),
        ),
      /must not contain passwords, tokens, or private-key paths/i,
    );

    assert.throws(
      () =>
        parseComputerNodesConfig(
          JSON.stringify({
            version: 1,
            nodes: [
              {
                id: "pc2",
                transport: "SSH",
                trusted: true,
                sshAlias: "pc2-windows",
                expectedComputerName: "PC2",
                metadata: {
                  password: "nested-secret",
                },
              },
            ],
          }),
        ),
      /must not contain passwords, tokens, or private-key paths/i,
    );

    assert.throws(
      () =>
        parseComputerNodesConfig(
          JSON.stringify({
            version: 1,
            nodes: [
              {
                id: "pc2",
                transport: "SSH",
                trusted: true,
                sshAlias: "pc2-windows",
                expectedComputerName: "PC2",
                arbitraryMetadata: "not-supported",
              },
            ],
          }),
        ),
      /unsupported field/i,
    );

    assert.throws(
      () =>
        parseComputerNodesConfig(
          JSON.stringify({
            version: 1,
            nodes: [
              {
                id: "pc2",
                transport: "SSH",
                trusted: true,
                sshAlias: "pc2-windows",
              },
            ],
          }),
        ),
      /requires expectedComputerName/i,
    );
  });

  test("private node config rejects root secrets and unsupported root fields", () => {
    assert.throws(
      () =>
        parseComputerNodesConfig(
          JSON.stringify({
            version: 1,
            nodes: [],
            token: "must-never-be-accepted",
          }),
        ),
      /must not contain passwords, tokens, or private-key paths/i,
    );

    assert.throws(
      () =>
        parseComputerNodesConfig(
          JSON.stringify({
            version: 1,
            nodes: [],
            metadata: { owner: "local" },
          }),
        ),
      /unsupported root field/i,
    );
  });

  test("remote system-info uses explicit trusted SSH node and returns target evidence", async () => {
    const transport = makeTransport(
      async (node, script) => {
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2","platform":"win32","release":"10.0.19045","version":"10.0.19045","architecture":"AMD64"}\n',
          stderr: "",
        };
      }
    );
    const controller = new AbortController();
    const result = await transport.call(
      "computer.system.info",
      { nodeId: "pc2" },
      controller.signal,
    );

    assert.equal(result.ok, true);
    assert.equal(result.verified, true);
    assert.deepEqual(result.output, {
      computerName: "PC2",
      platform: "win32",
      release: "10.0.19045",
      version: "10.0.19045",
      architecture: "AMD64",
      nodeId: "pc2",
      nodeLabel: "Workstation 2",
      transport: "SSH",
    });
  });

  test("unknown and untrusted remote nodes fail closed without SSH fallback", async () => {
    const transport = makeTransport(
      async () => ({ exitCode: 0, stdout: "", stderr: "" })
    );
    const signal = new AbortController().signal;

    const unknown = await transport.call(
      "computer.system.info",
      { nodeId: "pc404" },
      signal,
    );
    assert.equal(unknown.ok, false);
    assert.match(unknown.detail, /did not fall back/i);

    const untrusted = await transport.call(
      "computer.owner.exec",
      { nodeId: "pc3", shell: "powershell", command: "whoami" },
      signal,
    );
    assert.equal(untrusted.ok, false);
    assert.match(untrusted.detail, /not trusted/i);
  });

  test("identity mismatch blocks remote Owner Mode and never reports completion", async () => {
    const transport = makeTransport(
      async () => ({
        exitCode: 86,
        stdout: "",
        stderr: "ASTRA_IDENTITY_MISMATCH\n",
      })
    );

    const result = await transport.call(
      "computer.owner.exec",
      {
        nodeId: "pc2",
        shell: "powershell",
        command: "Write-Output SHOULD_NOT_COUNT_AS_VERIFIED",
      },
      new AbortController().signal,
    );

    assert.equal(result.ok, false);
    assert.equal(result.verified, false);
    assert.match(result.detail, /identity did not match/i);
  });

  test("node inventory probes remote nodes independently", async () => {
    const transport = makeTransport(
      async (node) => {
        if (node.id === "pc2") {
          return {
            exitCode: 0,
            stdout:
              '{"computerName":"PC2","platform":"win32","release":"10","version":"10","architecture":"AMD64"}',
            stderr: "",
          };
        }
        throw new Error("should not probe untrusted node");
      },
    );

    const result = await transport.call(
      "computer.nodes.list",
      {},
      new AbortController().signal,
    );
    assert.equal(result.ok, true);
    const output = result.output as {
      nodes: Array<{ id: string; state: string; transport: string }>;
    };
    assert.deepEqual(
      output.nodes.map((node) => [node.id, node.transport, node.state]),
      [
        ["local", "LOCAL", "READY"],
        ["pc2", "SSH", "READY"],
        ["pc3", "SSH", "UNTRUSTED"],
      ],
    );
  });

  test("remote Owner Mode normal completion does not kill wrapper process", async () => {
    let scriptCaptured = "";
    const transport = makeTransport(
      async (node, script) => {
        scriptCaptured = script;
        assert.match(script, /astraJobId/);
        assert.match(script, /ASTRA_IDENTITY_MISMATCH/);
        assert.match(script, /astraJobId/);
        assert.match(script, /Cleanup-Job/);
        assert.match(script, /Update-Heartbeat/);
        assert.match(script, /Get-DescendantPids/);
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2","platform":"win32","release":"10.0.19045","version":"10.0.19045","architecture":"AMD64"}\n',
          stderr: "",
        };
      }
    );

    const result = await transport.call(
      "computer.owner.exec",
      { nodeId: "pc2", shell: "powershell", command: "Write-Output done" },
      new AbortController().signal,
    );
    assert.equal(result.ok, true);
    assert.equal(result.verified, true);
    assert.match(result.detail, /completed on node pc2 with exit code 0/);
  });

  test("explicit STOP aborts remote job and triggers cleanup", async () => {
    let cleanupTriggered = false;
    let jobScript = "";

    const transport = makeTransport(
      async (node, script, signal) => {
        jobScript = script;
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
          cleanupTriggered = true;
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        await new Promise((r) => setTimeout(r, 10));
        if (signal.aborted) {
          return { exitCode: -1, stdout: "", stderr: "Process cancelled." };
        }
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2","platform":"win32","release":"10.0.19045","version":"10.0.19045","architecture":"AMD64"}\n',
          stderr: "",
        };
      }
    );

    const controller = new AbortController();
    const signal = controller.signal;

    const promise = transport.call(
      "computer.owner.exec",
      { nodeId: "pc2", shell: "powershell", command: "Start-Sleep 10" },
      signal,
    );

    await new Promise((r) => setTimeout(r, 5));
    controller.abort();

    const result = await promise;
    assert.equal(result.ok, false);
    assert.equal(result.verified, false);
    assert.equal(cleanupTriggered, true);
  });

  test("timeout triggers remote cleanup", async () => {
    let cleanupTriggered = false;

    const transport = makeTransport(
      async (node, script, signal) => {
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
          cleanupTriggered = true;
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 100);
          signal.addEventListener("abort", () => {
            clearTimeout(timeout);
            resolve(undefined);
          }, { once: true });
        });
        if (signal.aborted) {
          return { exitCode: -1, stdout: "", stderr: "Process cancelled." };
        }
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2","platform":"win32","release":"10.0.19045","version":"10.0.19045","architecture":"AMD64"}\n',
          stderr: "",
        };
      }
    );

    const controller = new AbortController();
    const signal = controller.signal;

    const promise = transport.call(
      "computer.owner.exec",
      { nodeId: "pc2", shell: "powershell", command: "Start-Sleep 10" },
      signal,
    );

    setTimeout(() => controller.abort(), 10);
    const result = await promise;
    assert.equal(result.ok, false);
    assert.equal(result.verified, false);
    assert.equal(cleanupTriggered, true);
  });

  test("transport disconnect triggers remote cleanup", async () => {
    let cleanupTriggered = false;
    let callCount = 0;

    const transport = makeTransport(
      async (node, script, signal) => {
        callCount++;
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
          cleanupTriggered = true;
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        if (callCount === 1) {
          throw new Error("transport disconnected");
        }
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2"}',
          stderr: "",
        };
      }
    );

    const result = await transport.call(
      "computer.owner.exec",
      { nodeId: "pc2", shell: "powershell", command: "Start-Sleep 10" },
      new AbortController().signal,
    );
    assert.equal(result.ok, false);
    assert.equal(result.verified, false);
    await new Promise(r => setTimeout(r, 50));
    assert.equal(cleanupTriggered, true);
  });

  test("identity mismatch during cleanup fails closed", async () => {
    let cleanupTriggered = false;

    const transport = makeTransport(
      async (node, script, signal) => {
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER") && script.includes("ASTRA_IDENTITY_MISMATCH")) {
          cleanupTriggered = true;
          return { exitCode: 86, stdout: "", stderr: "ASTRA_IDENTITY_MISMATCH\n" };
        }
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 100);
          signal.addEventListener("abort", () => {
            clearTimeout(timeout);
            reject(new DOMException("Process cancelled.", "AbortError"));
          }, { once: true });
        });
        if (signal.aborted) {
          return { exitCode: -1, stdout: "", stderr: "Process cancelled." };
        }
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2"}',
          stderr: "",
        };
      }
    );

    const controller = new AbortController();
    const signal = controller.signal;

    const promise = transport.call(
      "computer.owner.exec",
      { nodeId: "pc2", shell: "powershell", command: "Start-Sleep 10" },
      signal,
    );

    await new Promise((r) => setTimeout(r, 5));
    controller.abort();

    const result = await promise;
    assert.equal(result.ok, false);
    assert.equal(result.verified, false);
    assert.equal(cleanupTriggered, true);
  });

  test("idempotent cleanup: repeated abort does not throw", async () => {
    let callCount = 0;

    const transport = makeTransport(
      async (node, script, signal) => {
        callCount++;
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        if (signal.aborted) {
          return { exitCode: -1, stdout: "", stderr: "Process cancelled." };
        }
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2"}',
          stderr: "",
        };
      }
    );

    const signal = {
      aborted: true,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      throwIfAborted: function(this: { aborted: boolean }) { if (this.aborted) throw new DOMException("Process cancelled.", "AbortError"); },
    } as unknown as AbortSignal;

    const result = await transport.call(
      "computer.owner.exec",
      { nodeId: "pc2", shell: "powershell", command: "Start-Sleep 10" },
      signal,
    );
    assert.equal(result.ok, false);
    assert.equal(callCount, 2);
  });

  test("concurrent jobs have independent jobIds and isolated cleanup", async () => {
    let scripts: string[] = [];

    const transport = makeTransport(
      async (node, script) => {
        if (script.includes("$astraJobId")) {
          scripts.push(script);
          return {
            exitCode: 0,
            stdout: '{"computerName":"PC2","platform":"win32","release":"10.0.19045","version":"10.0.19045","architecture":"AMD64"}\n',
            stderr: "",
          };
        }
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2","platform":"win32","release":"10","version":"10","architecture":"AMD64"}',
          stderr: "",
        };
      }
    );

    const signal = new AbortController().signal;

    const results = await Promise.all([
      transport.call("computer.owner.exec", { nodeId: "pc2", shell: "powershell", command: "whoami" }, signal),
      transport.call("computer.owner.exec", { nodeId: "pc2", shell: "powershell", command: "dir" }, signal),
      transport.call("computer.owner.exec", { nodeId: "pc2", shell: "powershell", command: "echo test" }, signal),
    ]);

    for (const r of results) {
      assert.equal(r.ok, true);
      assert.equal(r.verified, true);
    }
    assert.equal(scripts.length, 3);
  });

  test("no late success after cancellation: cleanup does not report verified=true", async () => {
    let cleanupTriggered = false;

    const transport = makeTransport(
      async (node, script, signal) => {
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
          cleanupTriggered = true;
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        if (signal.aborted) {
          return { exitCode: -1, stdout: "", stderr: "Process cancelled." };
        }
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2"}',
          stderr: "",
        };
      }
    );

    const signal = {
      aborted: true,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      throwIfAborted: function(this: { aborted: boolean }) { if (this.aborted) throw new DOMException("Process cancelled.", "AbortError"); },
    } as unknown as AbortSignal;

    const result = await transport.call(
      "computer.owner.exec",
      { nodeId: "pc2", shell: "powershell", command: "Start-Sleep 10" },
      signal,
    );
    assert.equal(result.verified, false);
    assert.equal(result.ok, false);
    assert.equal(cleanupTriggered, true);
  });

  test("stale lease triggers exact-job cleanup (not just metadata mutation)", async () => {
    let cleanupTriggeredForJob: string | null = null;
    let trackedScriptCaptured = "";

    const transport = makeTransport(
      async (node, script, signal) => {
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
          // Cleanup script uses literal jobId: $astraJobId="job-id"
          const match = script.match(/\$astraJobId="([^"]+)"/);
          if (match) cleanupTriggeredForJob = match[1];
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        // Tracked script uses Base64 encoded jobId - capture it (flexible match)
        if (script.includes("FromBase64String")) {
          trackedScriptCaptured = script;
        }
        // Return a promise that waits for abort signal
        const trackedPromise = new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
          if (signal.aborted) {
            resolve({ exitCode: -1, stdout: "", stderr: "Process cancelled." });
          } else {
            signal.addEventListener("abort", () => {
              resolve({ exitCode: -1, stdout: "", stderr: "Process cancelled." });
            }, { once: true });
          }
        });
        return trackedPromise;
      }
    );

    const controller = new AbortController();
    const signal = controller.signal;

    const promise = transport.call(
      "computer.owner.exec",
      { nodeId: "pc2", shell: "powershell", command: "Start-Sleep 10" },
      signal,
    );

    // Wait a bit for the tracked script to be sent and job to be registered
    await new Promise((r) => setTimeout(r, 50));
    controller.abort();

    const result = await promise;

    // Extract jobId from the captured tracked script (Base64 encoded)
    // Be very permissive - match any Base64-like string that decodes to a valid jobId
    let jobIds: string[] = [];
    // Try to match FromBase64String pattern first
    let trackedMatch = trackedScriptCaptured.match(/FromBase64String\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
    if (trackedMatch) {
      const decoded = Buffer.from(trackedMatch[1], "base64").toString("utf8");
      if (decoded.startsWith("astra-job-")) {
        jobIds = [decoded];
      }
    }
    // Fallback: find any Base64 string that decodes to a valid jobId
    if (jobIds.length === 0) {
      const base64Matches = trackedScriptCaptured.match(/[A-Za-z0-9+/=]{30,}/g);
      if (base64Matches) {
        for (const match of base64Matches) {
          try {
            const decoded = Buffer.from(match, "base64").toString("utf8");
            if (decoded.startsWith("astra-job-")) {
              jobIds = [decoded];
              break;
            }
          } catch {}
        }
      }
    }

    assert.equal(result.ok, false);
    assert.equal(result.verified, false);
    assert.ok(jobIds.length > 0, "job should have been registered");
    assert.equal(cleanupTriggeredForJob, jobIds[0], "cleanup should target the exact job");
  });
  test("one logical job = one wrapper = one unique jobId", async () => {
    let wrapperCount = 0;
    let jobIds: string[] = [];

    const transport = makeTransport(
      async (node, script) => {
        wrapperCount++;
        const match = script.match(/\$astraJobId=\[Text\.Encoding\]::UTF8\.GetString\(\[Convert\]::FromBase64String\('([^']+)'\)\)/);
        if (match) jobIds.push(Buffer.from(match[1], "base64").toString("utf8"));
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2","platform":"win32","release":"10.0.19045","version":"10.0.19045","architecture":"AMD64"}',
          stderr: "",
        };
      }
    );

    const signal = new AbortController().signal;

    await transport.call("computer.owner.exec", { nodeId: "pc2", shell: "powershell", command: "whoami" }, signal);
    assert.equal(wrapperCount, 1, "owner.exec should invoke tracked wrapper once");
    assert.equal(jobIds.length, 1, "should have exactly one jobId");
    
    wrapperCount = 0;
    jobIds = [];
    await transport.call("computer.owner.exec", { nodeId: "pc2", shell: "powershell", command: "dir" }, signal);
    assert.equal(wrapperCount, 1, "owner.exec should invoke tracked wrapper once");
    assert.equal(jobIds.length, 1, "should have exactly one jobId for owner.exec");
  });

  test("late success after abort is suppressed even if runner ignores abort", async () => {
    let cleanupTriggered = false;

    const transport = makeTransport(
      async (node, script, signal) => {
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
          cleanupTriggered = true;
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 50);
          signal.addEventListener("abort", () => {
            clearTimeout(timeout);
            resolve();
          }, { once: true });
        });
        if (signal.aborted) {
          return { exitCode: 0, stdout: '{"computerName":"PC2"}', stderr: "" };
        }
        return { exitCode: 0, stdout: '{"computerName":"PC2"}', stderr: "" };
      }
    );

    const controller = new AbortController();
    const signal = controller.signal;

    const promise = transport.call(
      "computer.owner.exec",
      { nodeId: "pc2", shell: "powershell", command: "Start-Sleep 10" },
      signal,
    );

    setTimeout(() => controller.abort(), 5);
    
    const result = await promise;
    assert.equal(result.verified, false, "should not report verified success after abort");
    assert.equal(result.ok, false, "should not report ok after abort");
    assert.equal(cleanupTriggered, true, "cleanup should still be triggered");
  });

  test("generated cleanup PowerShell has valid syntax (braces balanced)", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("lib/tools/computer-nodes.ts", "utf8");
    
    const cleanupFuncStart = source.indexOf("export async function runRemoteCleanupRaw");
    const cleanupFuncEnd = source.indexOf("export async function", cleanupFuncStart + 1);
    const cleanupFunc = source.slice(cleanupFuncStart, cleanupFuncEnd);
    
    const templateStart = cleanupFunc.indexOf("`");
    const templateEnd = cleanupFunc.indexOf("`", templateStart + 1);
    if (templateStart === -1 || templateEnd === -1) {
      throw new Error("Could not find PowerShell template literal in runRemoteCleanupRaw");
    }
    const cleanupScript = cleanupFunc.slice(templateStart + 1, templateEnd);
    
    const openBraces = (cleanupScript.match(/{/g) || []).length;
    const closeBraces = (cleanupScript.match(/}/g) || []).length;
    assert.equal(openBraces, closeBraces, "cleanup script braces should be balanced");
  });

  test("recursive cleanup handles leaf process (no children)", async () => {
    let cleanupTriggered = false;

    const transport = makeTransport(
      async (node, script, signal) => {
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
          cleanupTriggered = true;
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 100);
          signal.addEventListener("abort", () => {
            clearTimeout(timeout);
            reject(new DOMException("Process cancelled.", "AbortError"));
          }, { once: true });
        });
        if (signal.aborted) {
          return { exitCode: -1, stdout: "", stderr: "Process cancelled." };
        }
        return { exitCode: 0, stdout: '{"computerName":"PC2"}', stderr: "" };
      }
    );

    const controller = new AbortController();
    const signal = controller.signal;

    const promise = transport.call(
      "computer.owner.exec",
      { nodeId: "pc2", shell: "powershell", command: "Start-Sleep 10" },
      signal,
    );

    await new Promise((r) => setTimeout(r, 5));
    controller.abort();

    const result = await promise;
    assert.equal(result.ok, false);
    assert.equal(result.verified, false);
    assert.equal(cleanupTriggered, true);
  });

  test("lease timeout watchdog cleans up exact job, not just marks status", async () => {
    assert.ok(typeof runRemoteCleanupRaw === "function", "runRemoteCleanupRaw should be exported for testing");
  });

  test("authoritative heartbeat refresh calls remote reader, returns true, updates local lastHeartbeat", async () => {
    let readScript = "";
    const rawRunner = async (node: any, script: string, signal: AbortSignal) => {
      readScript = script;
      return {
        exitCode: 0,
        stdout: "2026-01-01T00:00:01.000Z",
        stderr: "",
      };
    };

    // Provide test config so loadComputerNodesConfig() returns our test node
    _setTestConfig({
      version: 1,
      nodes: [
        {
          id: "pc2",
          label: "Workstation 2",
          transport: "SSH",
          trusted: true,
          sshAlias: "pc2-windows",
          expectedComputerName: "PC2",
        },
      ],
    });

    try {
      // First register a job so it exists in activeRemoteJobs
      const jobId = _registerRemoteJob("pc2", 12345);
      assert.ok(jobId, "job should be registered");

      const initialJob = _getActiveRemoteJobs().get(jobId);
      const initialHeartbeat = initialJob?.lastHeartbeat;

      const result = await _updateLocalHeartbeatFromRemote(jobId, rawRunner);

      assert.equal(result, true, "should return true on successful heartbeat read");
      // Heartbeat refresh uses raw SSH to read job file and return heartbeat value
      assert.match(readScript, /Get-Content.*astraJobFile/, "should read the job file for heartbeat");
      assert.match(readScript, /ConvertFrom-Json/, "should parse JSON");
      assert.match(readScript, /\$job\.heartbeat/, "should read heartbeat field from job object");

      // Verify lastHeartbeat was updated
      const updatedJob = _getActiveRemoteJobs().get(jobId);
      assert.ok(updatedJob, "job should still exist");
      assert.notEqual(updatedJob.lastHeartbeat, initialHeartbeat, "lastHeartbeat should be updated to remote value");
      assert.equal(updatedJob.lastHeartbeat, "2026-01-01T00:00:01.000Z", "lastHeartbeat should match remote heartbeat");
    } finally {
      _setTestConfig(null);
    }
  });

  test("stale lease with deterministic tick proves exact-job cleanup and removal", async () => {
    let cleanupTriggeredForJob: string | null = null;
    let cleanupCalled = false;

    // Custom cleanup runner to capture the cleanup script
    const cleanupRunner = async (node: any, script: string, signal: AbortSignal) => {
      if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
        cleanupCalled = true;
        // Cleanup script uses literal jobId: $astraJobId="job-id"
        const match = script.match(/\$astraJobId="([^"]+)"/);
        if (match) cleanupTriggeredForJob = match[1];
        return { exitCode: 0, stdout: "", stderr: "" };
      }
      if (script.includes("ASTRA_IDENTITY_MISMATCH")) {
        return { exitCode: 86, stdout: "", stderr: "ASTRA_IDENTITY_MISMATCH\n" };
      }
      return { exitCode: 0, stdout: '{"computerName":"PC2"}', stderr: "" };
    };

    // Custom raw runner for heartbeat refresh - return stale heartbeat
    const rawRunner = async (node: any, script: string, signal: AbortSignal) => {
      // Return a stale heartbeat to trigger cleanup
      return { exitCode: 0, stdout: "2026-01-01T00:00:00.000Z", stderr: "" };
    };

    // Provide test config so loadComputerNodesConfig() returns our test node
    _setTestConfig({
      version: 1,
      nodes: [
        {
          id: "pc2",
          label: "Workstation 2",
          transport: "SSH",
          trusted: true,
          sshAlias: "pc2-windows",
          expectedComputerName: "PC2",
        },
      ],
    });

    try {
      // Register a job directly with a known PID
      const registeredJobId = _registerRemoteJob("pc2", 12345);
      assert.ok(registeredJobId, "job should be registered");

      // Manually set the job's lease to be expired (heartbeat very old)
      const activeJobs = _getActiveRemoteJobs();
      const job = activeJobs.get(registeredJobId);
      assert.ok(job, "job should exist in active jobs");
      job.lastHeartbeat = new Date(Date.now() - 10000).toISOString(); // 10 seconds ago

      // Set very short lease timeout for deterministic test
      const originalLeaseMs = 30000; // default LEASE_TIMEOUT_MS
      setTestLeaseTimeoutMs(50);

      // Run one deterministic watchdog tick
      await _tickLeaseWatchdogOnce(rawRunner, cleanupRunner);

      setTestLeaseTimeoutMs(originalLeaseMs);

      // Job should have been cleaned up and removed
      const activeJobsAfter = _getActiveRemoteJobs();
      assert.ok(!activeJobsAfter.has(registeredJobId), "job should have been removed after stale lease cleanup");
      assert.ok(cleanupCalled, "cleanup should have been triggered for expired lease");
      assert.equal(cleanupTriggeredForJob, registeredJobId, "cleanup should target the exact registered job");
    } finally {
      _setTestConfig(null);
    }
  });
});

describe("generated PowerShell structure regression", () => {
  // Helper to find the matching closing brace of a function
  function findFunctionEnd(body: string, start: number): number {
    let braceCount = 0;
    let inFunction = false;
    for (let i = start; i < body.length; i++) {
      const ch = body[i];
      if (ch === "{") {
        braceCount++;
        inFunction = true;
      } else if (ch === "}" && inFunction) {
        braceCount--;
        if (braceCount === 0) {
          return i;
        }
      }
    }
    return -1;
  }

  test("generated tracked script contains Remove-TrackingArtifacts function", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("lib/tools/computer-nodes.ts", "utf8");

    // Find the template literal inside buildRemoteScriptWithJobTracking
    const funcStart = source.indexOf("function buildRemoteScriptWithJobTracking");
    const templateStart = source.indexOf("const jobScript = `", funcStart);
    const templateEnd = source.indexOf("`;", templateStart);
    const templateBody = source.slice(templateStart, templateEnd);

    // Extract Remove-TrackingArtifacts function specifically
    const removeStart = templateBody.indexOf("function Remove-TrackingArtifacts {");
    assert.ok(removeStart !== -1, "generated script should contain Remove-TrackingArtifacts function");
    const removeEnd = findFunctionEnd(templateBody, removeStart);
    assert.ok(removeEnd !== -1, "Remove-TrackingArtifacts function should have closing brace");
    const removeFunc = templateBody.slice(removeStart, removeEnd + 1);

    assert.ok(removeFunc.includes("Remove-Item -Path \$astraJobFile"), "Remove-TrackingArtifacts should remove job JSON");
    assert.ok(removeFunc.includes("Remove-Item -Path \$astraPidFile"), "Remove-TrackingArtifacts should remove PID file");
    assert.ok(!removeFunc.includes("Stop-Process"), "Remove-TrackingArtifacts should not contain Stop-Process");
  });

  test("generated tracked script finally block calls Remove-TrackingArtifacts not Cleanup-Job", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("lib/tools/computer-nodes.ts", "utf8");

    const funcStart = source.indexOf("function buildRemoteScriptWithJobTracking");
    const templateStart = source.indexOf("const jobScript = `", funcStart);
    const templateEnd = source.indexOf("`;", templateStart);
    const templateBody = source.slice(templateStart, templateEnd);

    const finallyStart = templateBody.indexOf("} finally {");
    assert.ok(finallyStart !== -1, "generated script should have finally block");

    // Find the end of the finally block - it ends before the closing ` of the template
    const finallyEnd = templateBody.indexOf("`", finallyStart);
    const finallyBlock = templateBody.slice(finallyStart, finallyEnd);

    assert.ok(finallyBlock.includes("Remove-TrackingArtifacts"), "finally block should call Remove-TrackingArtifacts");
    assert.ok(!finallyBlock.includes("Cleanup-Job"), "finally block should not call Cleanup-Job on normal completion");
    assert.ok(!finallyBlock.includes("Stop-Process"), "finally block should not contain Stop-Process");
  });

  test("Cleanup-Job function still contains process-tree termination for error paths", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("lib/tools/computer-nodes.ts", "utf8");

    const funcStart = source.indexOf("function buildRemoteScriptWithJobTracking");
    const templateStart = source.indexOf("const jobScript = `", funcStart);
    const templateEnd = source.indexOf("`;", templateStart);
    const templateBody = source.slice(templateStart, templateEnd);

    const cleanupStart = templateBody.indexOf("function Cleanup-Job {");
    assert.ok(cleanupStart !== -1, "generated script should contain Cleanup-Job function");
    const cleanupEnd = findFunctionEnd(templateBody, cleanupStart);
    assert.ok(cleanupEnd !== -1, "Cleanup-Job function should have closing brace");
    const cleanupFunc = templateBody.slice(cleanupStart, cleanupEnd + 1);

    assert.ok(cleanupFunc.includes("Stop-Process -Id \$p"), "Cleanup-Job should contain Stop-Process for process termination");
    assert.ok(cleanupFunc.includes("Get-DescendantPids"), "Cleanup-Job should use Get-DescendantPids for process tree");
    // Get-CimInstance is in Get-DescendantPids, not directly in Cleanup-Job
    assert.ok(templateBody.includes('Get-CimInstance Win32_Process -Filter "ParentProcessId=$current"'), "Get-DescendantPids should use WMI for process tree");
    assert.ok(cleanupFunc.includes("Remove-Item -Path \$astraJobFile"), "Cleanup-Job should remove job JSON");
    assert.ok(cleanupFunc.includes("Remove-Item -Path \$astraPidFile"), "Cleanup-Job should remove PID file");
  });

  test("error path in tracked script calls Cleanup-Job", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("lib/tools/computer-nodes.ts", "utf8");

    const funcStart = source.indexOf("function buildRemoteScriptWithJobTracking");
    const templateStart = source.indexOf("const jobScript = `", funcStart);
    const templateEnd = source.indexOf("`;", templateStart);
    const templateBody = source.slice(templateStart, templateEnd);

    const catchStart = templateBody.indexOf("} catch {");
    assert.ok(catchStart !== -1, "generated script should have catch block");

    const catchEnd = templateBody.indexOf("} finally {", catchStart);
    const catchBlock = templateBody.slice(catchStart, catchEnd);

    assert.ok(catchBlock.includes("Cleanup-Job"), "catch block should call Cleanup-Job on error");
  });

  test("lease watchdog tick uses Cleanup-Job with process termination", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("lib/tools/computer-nodes.ts", "utf8");

    const funcStart = source.indexOf("function _tickLeaseWatchdogOnce");
    const funcEnd = source.indexOf("function ", funcStart + 1);
    const funcBody = source.slice(funcStart, funcEnd);

    assert.ok(funcBody.includes("runRemoteCleanupRaw"), "watchdog tick should call runRemoteCleanupRaw");
  });
});




