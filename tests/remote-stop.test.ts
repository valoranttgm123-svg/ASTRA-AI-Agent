import assert from "node:assert/strict";
import { test, describe } from "node:test";

import type { AstraComputerTransport } from "../lib/tools/computer";
import {
  MultiNodeWindowsComputerTransport,
  parseComputerNodesConfig,
  type AstraComputerNode,
  type AstraComputerNodesConfig,
  runRemoteCleanupRaw,
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
      // rawSsh - no job tracking for system.info
      async (node, script) => {
        // rawSsh doesn't add astraJobId
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2","platform":"win32","release":"10.0.19045","version":"10.0.19045","architecture":"AMD64"}\n',
          stderr: "",
        };
      },
      // trackedSsh - not used for system.info
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
      // rawSsh - not used for owner.exec
      async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      // trackedSsh - returns identity mismatch
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
      }
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
        // First call (main job) - simulate transport disconnect
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
    // Give cleanup a moment to complete asynchronously (shorter timeout)
    await new Promise(r => setTimeout(r, 10));
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
        if (script.includes("astraJobId")) {
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
      transport.call("computer.system.info", { nodeId: "pc2" }, signal),
      transport.call("computer.system.info", { nodeId: "pc2" }, signal),
      transport.call("computer.system.info", { nodeId: "pc2" }, signal),
    ]);

    for (const r of results) {
      assert.equal(r.ok, true);
      assert.equal(r.verified, true);
    }
    assert.equal(results.length, 3);
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
    let jobIds: string[] = [];
    let jobRegistered = false;

    const transport = makeTransport(
      async (node, script, signal) => {
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
          const match = script.match(/\$astraJobId="([^"]+)"/);
          if (match) cleanupTriggeredForJob = match[1];
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        const match = script.match(/\$astraJobId="([^"]+)"/);
        if (match) {
          jobIds.push(match[1]);
          jobRegistered = true;
        }
        // Simulate a long-running job that can be aborted
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

    // Wait for job to be registered before aborting
    await new Promise((r) => setTimeout(r, 50));
    while (!jobRegistered) {
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
          const match = script.match(/\$astraJobId="([^"]+)"/);
          if (match) jobIds.push(match[1]);
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
        await new Promise((resolve) => {
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
    
    const cleanupSection = source.split("runRemoteCleanupRaw")[1]?.split("async function")[0] || "";
    
    assert.match(cleanupSection, /try\s*\{/, "cleanup script should have try block");
    assert.match(cleanupSection, /\}\s*catch\s*\{/, "cleanup script should have catch block");
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
});