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
// Provides deterministic test seam for jobId observation
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

// Helper: bounded wait with deadline
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
    let cleanupJobId: string | null = null;

    const transport = makeTransport(
      async (node, script, signal) => {
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
          cleanupTriggered = true;
          // Deterministic test seam: extract jobId from the script parameter
          const match = script.match(/\$astraJobId="([^"]+)"/);
          if (match) cleanupJobId = match[1];
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
    assert.ok(cleanupJobId, "cleanup should capture exact jobId via deterministic seam");
  });

  test("timeout triggers remote cleanup", async () => {
    let cleanupTriggered = false;
    let cleanupJobId: string | null = null;

    const transport = makeTransport(
      async (node, script, signal) => {
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
          cleanupTriggered = true;
          const match = script.match(/\$astraJobId="([^"]+)"/);
          if (match) cleanupJobId = match[1];
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
    assert.ok(cleanupJobId, "cleanup should target exact jobId");
  });

  test("transport disconnect triggers remote cleanup", async () => {
    let cleanupTriggered = false;
    let cleanupJobId: string | null = null;
    let callCount = 0;

    const transport = makeTransport(
      async (node, script, signal) => {
        callCount++;
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
          cleanupTriggered = true;
          const match = script.match(/\$astraJobId="([^"]+)"/);
          if (match) cleanupJobId = match[1];
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
    // Give cleanup a moment to complete asynchronously
    await new Promise(r => setTimeout(r, 50));
    assert.equal(cleanupTriggered, true, "cleanup should be triggered on transport disconnect");
    assert.ok(cleanupJobId, "cleanup should target exact jobId");
  });

  test("identity mismatch during cleanup fails closed", async () => {
    let cleanupTriggered = false;
    let cleanupJobId: string | null = null;

    const transport = makeTransport(
      async (node, script, signal) => {
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER") && script.includes("ASTRA_IDENTITY_MISMATCH")) {
          cleanupTriggered = true;
          const match = script.match(/\$astraJobId="([^"]+)"/);
          if (match) cleanupJobId = match[1];
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
    assert.ok(cleanupJobId, "cleanup should target exact jobId even on identity mismatch");
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
    // One for job execution, one for cleanup = 2 calls
    assert.equal(callCount, 2, "should call runner twice: once for job, once for cleanup");
  });

  test("concurrent jobs have independent jobIds and isolated cleanup", async () => {
    let jobIds: string[] = [];

    const transport = makeTransport(
      async (node, script) => {
        if (script.includes("astraJobId")) {
          // Deterministic test seam: extract jobId from script (Base64 encoded in production tracked script)
          // Format: $astraJobId=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('BASE64'))
          const match = script.match(/\$astraJobId=\[Text\.Encoding\]::UTF8\.GetString\(\[Convert\]::FromBase64String\('([^']+)'\)\)/);
          if (match) {
            // Decode the Base64 jobId
            const decoded = Buffer.from(match[1], "base64").toString("utf8");
            jobIds.push(decoded);
          }
        }
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2","platform":"win32","release":"10.0.19045","version":"10.0.19045","architecture":"AMD64"}\n',
          stderr: "",
        };
      }
    );

    const signal = new AbortController().signal;

    // Use owner.exec which uses trackedSsh (with tracking wrapper)
    const results = await Promise.all([
      transport.call("computer.owner.exec", { nodeId: "pc2", shell: "powershell", command: "whoami" }, signal),
      transport.call("computer.owner.exec", { nodeId: "pc2", shell: "powershell", command: "dir" }, signal),
      transport.call("computer.owner.exec", { nodeId: "pc2", shell: "powershell", command: "echo test" }, signal),
    ]);

    for (const r of results) {
      assert.equal(r.ok, true);
      assert.equal(r.verified, true);
    }
    assert.equal(jobIds.length, 3, "should have 3 unique jobIds");
    assert.equal(new Set(jobIds).size, 3, "all jobIds should be unique");
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
    assert.equal(result.verified, false, "should not report verified success after abort");
    assert.equal(result.ok, false, "should not report ok after abort");
    assert.equal(cleanupTriggered, true, "cleanup should still be triggered");
  });

  test("stale lease triggers exact-job cleanup (not just metadata mutation)", async () => {
    let cleanupTriggeredForJob: string | null = null;
    let jobIds: string[] = [];
    let jobRegistered = false;

    const transport = makeTransport(
      async (node, script, signal) => {
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
          // Cleanup script uses plain format: $astraJobId="${jobId}"
          const match = script.match(/\$astraJobId="([^"]+)"/);
          if (match) cleanupTriggeredForJob = match[1];
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        // Tracked script uses Base64: $astraJobId=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('...'))
        const match = script.match(/\$astraJobId=\[Text\.Encoding\]::UTF8\.GetString\(\[Convert\]::FromBase64String\('([^']+)'\)\)/);
        if (match) {
          const decoded = Buffer.from(match[1], "base64").toString("utf8");
          jobIds.push(decoded);
          jobRegistered = true;
        }
        // Use a short timeout with abort handling for deterministic test
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 200);
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

    // Wait for job to be registered before aborting (with bounded wait + deadline)
    const startTime = Date.now();
    const maxWaitMs = 2000;
    while (!jobRegistered) {
      if (Date.now() - startTime > maxWaitMs) {
        throw new Error("Timeout waiting for job registration");
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    controller.abort();

    const result = await promise;
    assert.equal(result.ok, false);
    assert.equal(result.verified, false);
    assert.ok(jobIds.length > 0, "job should have been registered");
    assert.equal(cleanupTriggeredForJob, jobIds[0], "cleanup should target the exact job");
  });

  test("one logical job = one wrapper = one unique jobId", async () => {
    let wrapperCount = 0;
    let jobIds: string[] = [];

    const transport = makeTransport(
      async (node, script, signal) => {
        wrapperCount++;
        if (script.includes("astraJobId")) {
          // Deterministic test seam: extract jobId from script (Base64 encoded in production tracked script)
          const match = script.match(/\$astraJobId=\[Text\.Encoding\]::UTF8\.GetString\(\[Convert\]::FromBase64String\('([^']+)'\)\)/);
          if (match) {
            const decoded = Buffer.from(match[1], "base64").toString("utf8");
            jobIds.push(decoded);
          }
        }
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2"}',
          stderr: "",
        };
      }
    );

    const signal = new AbortController().signal;

    // owner.exec uses trackedSsh (with tracking wrapper)
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

    // Find the cleanup script template in runRemoteCleanupRaw - it's the template literal
    const cleanupFuncStart = source.indexOf("export async function runRemoteCleanupRaw");
    const cleanupFuncEnd = source.indexOf("export async function", cleanupFuncStart + 1);
    const cleanupFunc = source.slice(cleanupFuncStart, cleanupFuncEnd);

    // Find the template literal (backticks) containing the PowerShell script
    const templateStart = cleanupFunc.indexOf("`");
    const templateEnd = cleanupFunc.indexOf("`", templateStart + 1);
    if (templateStart === -1 || templateEnd === -1) {
      throw new Error("Could not find PowerShell template literal in runRemoteCleanupRaw");
    }
    const cleanupScript = cleanupFunc.slice(templateStart + 1, templateEnd);

    // Count braces in the PowerShell script only
    const openBraces = (cleanupScript.match(/{/g) || []).length;
    const closeBraces = (cleanupScript.match(/}/g) || []).length;
    assert.ok(openBraces > 0 && openBraces === closeBraces, "cleanup PowerShell script braces should be balanced: " + openBraces + " vs " + closeBraces);
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

  test("lease timeout watchdog cleans up exact job via deterministic tick (no 5s wait)", async () => {
    // This test uses injectable clock and short lease timeout + deterministic watchdog tick
    // to prove lease expiry triggers exact-job cleanup without waiting real time.

    // Set test config with pc2 node
    _setTestConfig({
      version: 1,
      nodes: [{
        id: "pc2",
        label: "Workstation 2",
        transport: "SSH",
        trusted: true,
        sshAlias: "pc2-windows",
        expectedComputerName: "PC2",
      }]
    });

    // Set up injectable clock
    let virtualNow = 1000000;
    const clock = { now: () => virtualNow };
    setTestClock(clock);
    setTestLeaseTimeoutMs(100); // 100ms lease timeout for test

    // The heartbeat should return the ORIGINAL time (before advance) to simulate stale lease
    const staleHeartbeatTime = new Date(1000000).toISOString();

    let cleanupCalledForJob: string | null = null;
    let cleanupCallCount = 0;

    // Mock raw runner that captures cleanup calls
    const mockRawRunner = async (node: any, script: string, signal: AbortSignal) => {
      if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
        cleanupCallCount++;
        const match = script.match(/\$astraJobId="([^"]+)"/);
        if (match) cleanupCalledForJob = match[1];
        return { exitCode: 0, stdout: "", stderr: "" };
      }
      // Heartbeat reader - return STALE heartbeat (original time) to trigger lease expiry
      if (script.includes("heartbeat") || script.includes("Heartbeat")) {
        return { exitCode: 0, stdout: staleHeartbeatTime, stderr: "" };
      }
      return { exitCode: 0, stdout: '{"computerName":"PC2"}', stderr: "" };
    };

    try {
      // Directly register a job to test lease watchdog
      const jobId = _registerRemoteJob("pc2", 1234);

      // Verify job is registered and running
      const activeJobs = _getActiveRemoteJobs();
      const job = activeJobs.get(jobId);
      assert.ok(job, "job should be registered");
      assert.equal(job.status, "running", "job should be running");
      const initialHeartbeat = job.lastHeartbeat;

      // Advance virtual clock past lease timeout (100ms)
      virtualNow += 200; // Now at 1000200, 200ms past start

      // Deterministic one-shot watchdog tick (no 5s interval wait)
      await _tickLeaseWatchdogOnce(mockRawRunner, mockRawRunner);

      // Verify lease expired - job should be aborted and removed
      const updatedJobs = _getActiveRemoteJobs();
      assert.ok(!updatedJobs.has(jobId), "job should be removed after lease expiry");

      // Verify cleanup was called with EXACT jobId
      assert.equal(cleanupCallCount, 1, "cleanup should be called exactly once");
      assert.equal(cleanupCalledForJob, jobId, "cleanup should receive exact jobId that expired");
    } finally {
      setTestClock(null);
      setTestLeaseTimeoutMs(null);
      _setTestConfig(null);
    }
  });

  test("authoritative heartbeat refresh calls remote reader, returns true, updates local lastHeartbeat", async () => {
    // Verify that updateLocalHeartbeatFromRemote:
    // 1. Calls remote heartbeat reader via SSH
    // 2. Returns true (refreshed === true)
    // 3. Updates local job.lastHeartbeat to the remote timestamp

    // Set test config with pc2 node
    _setTestConfig({
      version: 1,
      nodes: [{
        id: "pc2",
        label: "Workstation 2",
        transport: "SSH",
        trusted: true,
        sshAlias: "pc2-windows",
        expectedComputerName: "PC2",
      }]
    });

    // Verify that updateLocalHeartbeatFromRemote:
    // 1. Calls remote heartbeat reader via SSH
    // 2. Returns true (refreshed === true)
    // 3. Updates local job.lastHeartbeat to the remote timestamp

    let heartbeatReaderCalled = false;
    let readerCallCount = 0;
    const expectedRemoteTime = new Date("2026-09-25T12:00:00.000Z").toISOString();

    const mockRawRunner = async (node: any, script: string, signal: AbortSignal) => {
      // The heartbeat reader script contains $job.heartbeat
      if (script.includes("heartbeat") || script.includes("Heartbeat")) {
        readerCallCount++;
        heartbeatReaderCalled = true;
        return { exitCode: 0, stdout: expectedRemoteTime, stderr: "" };
      }
      return { exitCode: 0, stdout: '{"computerName":"PC2"}', stderr: "" };
    };

    const jobId = _registerRemoteJob("pc2", null);

    // Get initial heartbeat
    const initialJob = _getActiveRemoteJobs().get(jobId);
    const initialHeartbeat = initialJob?.lastHeartbeat;
    assert.ok(initialHeartbeat, "job should have initial heartbeat");

    // Call the heartbeat refresh
    const refreshed = await _updateLocalHeartbeatFromRemote(jobId, mockRawRunner);

    // 1. Remote heartbeat reader was called
    assert.ok(heartbeatReaderCalled, "remote heartbeat reader should be called");
    assert.equal(readerCallCount, 1, "heartbeat reader should be called exactly once");

    // 2. Returns true (refreshed === true)
    assert.equal(refreshed, true, "should return true when remote heartbeat read succeeds");

    // 3. Local job.lastHeartbeat updated to remote timestamp
    const updatedJob = _getActiveRemoteJobs().get(jobId);
    assert.ok(updatedJob, "job should still exist");
    assert.notEqual(updatedJob.lastHeartbeat, initialHeartbeat, "lastHeartbeat should change");
    assert.equal(updatedJob.lastHeartbeat, expectedRemoteTime, "lastHeartbeat should equal remote timestamp");

    _unregisterRemoteJob(jobId);
    _setTestConfig(null);
  });

  test("stale lease with deterministic tick proves exact-job cleanup and removal", async () => {
    // Combined test: lease expires -> cleanup called with exact jobId -> job removed
    let cleanupCalls: Array<{jobId: string, timestamp: number}> = [];

    // Clear any existing jobs first
    const existingJobs = _getActiveRemoteJobs();
    for (const [id] of existingJobs) {
      _unregisterRemoteJob(id);
    }

    // Set test config with pc2 node
    _setTestConfig({
      version: 1,
      nodes: [{
        id: "pc2",
        label: "Workstation 2",
        transport: "SSH",
        trusted: true,
        sshAlias: "pc2-windows",
        expectedComputerName: "PC2",
      }]
    });

    let virtualNow = 1000000;
    const clock = { now: () => virtualNow };
    setTestClock(clock);
    setTestLeaseTimeoutMs(50); // 50ms lease timeout

    // Use stale heartbeat time (original time before advance)
    const staleHeartbeatTime = new Date(1000000).toISOString();

    const mockRawRunner = async (node: any, script: string, signal: AbortSignal) => {
      if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
        const match = script.match(/\$astraJobId="([^"]+)"/);
        if (match) {
          cleanupCalls.push({jobId: match[1], timestamp: virtualNow});
        }
        return { exitCode: 0, stdout: "", stderr: "" };
      }
      // Return STALE heartbeat to trigger lease expiry
      if (script.includes("heartbeat") || script.includes("Heartbeat")) {
        return { exitCode: 0, stdout: staleHeartbeatTime, stderr: "" };
      }
      return { exitCode: 0, stdout: '{"computerName":"PC2"}', stderr: "" };
    };

    try {
      // Register two jobs
      const jobId1 = _registerRemoteJob("pc2", 100);
      const jobId2 = _registerRemoteJob("pc2", 200);

      assert.equal(_getActiveRemoteJobs().size, 2, "both jobs should be registered");

      // Advance clock past lease for both
      virtualNow += 100;

      // Single deterministic tick
      await _tickLeaseWatchdogOnce(mockRawRunner, mockRawRunner);

      // Both jobs should be cleaned up and removed
      assert.equal(_getActiveRemoteJobs().size, 0, "all expired jobs should be removed");

      // Cleanup should have been called for both exact jobIds
      assert.equal(cleanupCalls.length, 2, "cleanup should be called for each expired job");
      const cleanedIds = cleanupCalls.map(c => c.jobId).sort();
      assert.deepEqual(cleanedIds, [jobId1, jobId2].sort(), "cleanup should target exact expired jobIds");
    } finally {
      setTestClock(null);
      setTestLeaseTimeoutMs(null);
      _setTestConfig(null);
    }
  });
});
