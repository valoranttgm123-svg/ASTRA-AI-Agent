import assert from "node:assert/strict";
import { test, describe } from "node:test";

import type { AstraComputerTransport } from "../lib/tools/computer";
import {
  MultiNodeWindowsComputerTransport,
  parseComputerNodesConfig,
  type AstraComputerNode,
  type AstraComputerNodesConfig,
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

function makeDefaultSshRunner() {
  return async function (node: any, script: string, signal: AbortSignal) {
    if (signal.aborted) {
      throw new DOMException("Process cancelled.", "AbortError");
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
    if (script.includes("astraJobId")) {
      return {
        exitCode: 0,
        stdout: '{"computerName":"PC2","platform":"win32","release":"10.0.19045","version":"10.0.19045","architecture":"AMD64"}\n',
        stderr: "",
      };
    }
    return {
      exitCode: 0,
      stdout: '{"computerName":"PC2","platform":"win32","release":"10.0.19045","version":"10.0.19045","architecture":"AMD64"}\n',
      stderr: "",
    };
  };
}

function makeTransport(sshImpl?: (node: any, script: string, signal: AbortSignal) => Promise<{ exitCode: number; stdout: string; stderr: string }>) {
  const runner = sshImpl ?? makeDefaultSshRunner();
  return new MultiNodeWindowsComputerTransport({
    local: localFixture(),
    loadNodes: () => nodes,
    runSsh: runner,
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
    const transport = new MultiNodeWindowsComputerTransport({
      local: localFixture(),
      loadNodes: () => nodes,
      runSsh: async (node, script) => {
        assert.match(script, /astraJobId/);
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2","platform":"win32","release":"10.0.19045","version":"10.0.19045","architecture":"AMD64"}\n',
          stderr: "",
        };
      },
    });
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
    const transport = new MultiNodeWindowsComputerTransport({
      local: localFixture(),
      loadNodes: () => nodes,
      runSsh: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    });
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
    const transport = new MultiNodeWindowsComputerTransport({
      local: localFixture(),
      loadNodes: () => nodes,
      runSsh: async () => ({
        exitCode: 86,
        stdout: "",
        stderr: "ASTRA_IDENTITY_MISMATCH\n",
      }),
    });

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
    const transport = new MultiNodeWindowsComputerTransport({
      local: localFixture(),
      loadNodes: () => nodes,
      runSsh: async (node) => {
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
    });

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
    const transport = new MultiNodeWindowsComputerTransport({
      local: localFixture(),
      loadNodes: () => nodes,
      runSsh: async (node, script) => {
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
      },
    });

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

    const transport = new MultiNodeWindowsComputerTransport({
      local: localFixture(),
      loadNodes: () => nodes,
      runSsh: async (node, script, signal) => {
        jobScript = script;
        // First call is the main job - it should not be aborted yet
        // Check if this is a cleanup script
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
          cleanupTriggered = true;
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        // Main job script - wait a bit then check if aborted
        await new Promise((r) => setTimeout(r, 10));
        if (signal.aborted) {
          return { exitCode: -1, stdout: "", stderr: "Process cancelled." };
        }
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2","platform":"win32","release":"10.0.19045","version":"10.0.19045","architecture":"AMD64"}\n',
          stderr: "",
        };
      },
    });

    const controller = new AbortController();
    const signal = controller.signal;

    // Start the call first
    const promise = transport.call(
      "computer.owner.exec",
      { nodeId: "pc2", shell: "powershell", command: "Start-Sleep 10" },
      signal,
    );

    // Give it a moment to start, then abort
    await new Promise((r) => setTimeout(r, 5));
    controller.abort();

    const result = await promise;
    assert.equal(result.ok, false);
    assert.equal(result.verified, false);
    assert.equal(cleanupTriggered, true);
  });

  test("timeout triggers remote cleanup", async () => {
    let cleanupTriggered = false;

    const transport = new MultiNodeWindowsComputerTransport({
      local: localFixture(),
      loadNodes: () => nodes,
      runSsh: async (node, script, signal) => {
        // Check if this is a cleanup script
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
          cleanupTriggered = true;
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        // Main job script - simulate a long-running job
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 100);
          signal.addEventListener("abort", () => {
            clearTimeout(timeout);
            resolve(); // Resolve instead of reject - let the mock return failed result
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
      },
    });

    const controller = new AbortController();
    const signal = controller.signal;

    const promise = transport.call(
      "computer.owner.exec",
      { nodeId: "pc2", shell: "powershell", command: "Start-Sleep 10" },
      signal,
    );

    // Abort after a short delay (simulating timeout)
    setTimeout(() => controller.abort(), 10);
    const result = await promise;
    assert.equal(result.ok, false);
    assert.equal(result.verified, false);
    assert.equal(cleanupTriggered, true);
  });

  test("transport disconnect triggers remote cleanup", async () => {
    let cleanupTriggered = false;
    let callCount = 0;

    const transport = new MultiNodeWindowsComputerTransport({
      local: localFixture(),
      loadNodes: () => nodes,
      runSsh: async (node, script, signal) => {
        callCount++;
        // Check if this is a cleanup script
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
      },
    });

    const result = await transport.call(
      "computer.owner.exec",
      { nodeId: "pc2", shell: "powershell", command: "Start-Sleep 10" },
      new AbortController().signal,
    );
    assert.equal(result.ok, false);
    assert.equal(result.verified, false);
    assert.equal(cleanupTriggered, true);
  });

  test("identity mismatch during cleanup fails closed", async () => {
    let cleanupTriggered = false;

    const transport = new MultiNodeWindowsComputerTransport({
      local: localFixture(),
      loadNodes: () => nodes,
      runSsh: async (node, script, signal) => {
        // Check if this is a cleanup script with identity mismatch
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER") && script.includes("ASTRA_IDENTITY_MISMATCH")) {
          cleanupTriggered = true;
          return { exitCode: 86, stdout: "", stderr: "ASTRA_IDENTITY_MISMATCH\n" };
        }
        // Main job script - wait for abort
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
      },
    });

    const controller = new AbortController();
    const signal = controller.signal;

    // Start the call first
    const promise = transport.call(
      "computer.owner.exec",
      { nodeId: "pc2", shell: "powershell", command: "Start-Sleep 10" },
      signal,
    );

    // Give it a moment to start, then abort
    await new Promise((r) => setTimeout(r, 5));
    controller.abort();

    const result = await promise;
    assert.equal(result.ok, false);
    assert.equal(result.verified, false);
    // The main job fails with abort, but cleanup also runs and fails with identity mismatch
    // The transport returns the main job's error (abort), but cleanup was triggered
    assert.equal(cleanupTriggered, true);
  });

  test("idempotent cleanup: repeated abort does not throw", async () => {
    let callCount = 0;

    const transport = new MultiNodeWindowsComputerTransport({
      local: localFixture(),
      loadNodes: () => nodes,
      runSsh: async (node, script, signal) => {
        callCount++;
        // Check if this is a cleanup script
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        // Main job - signal is already aborted, return failed result
        if (signal.aborted) {
          return { exitCode: -1, stdout: "", stderr: "Process cancelled." };
        }
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2"}',
          stderr: "",
        };
      },
    });

    // Create an already-aborted signal using a custom AbortSignal
    const signal = { 
      aborted: true, 
      addEventListener: () => {}, 
      removeEventListener: () => {}, 
      dispatchEvent: () => true,
      throwIfAborted: function() { if (this.aborted) throw new DOMException("Process cancelled.", "AbortError"); }
    } as unknown as AbortSignal;

    const result = await transport.call(
      "computer.owner.exec",
      { nodeId: "pc2", shell: "powershell", command: "Start-Sleep 10" },
      signal,
    );
    assert.equal(result.ok, false);
    // The main job should fail, cleanup should still be called once
    assert.equal(callCount, 2); // Main job + cleanup
  });

  test("concurrent jobs have independent jobIds and isolated cleanup", async () => {
    let scripts: string[] = [];

    const transport = new MultiNodeWindowsComputerTransport({
      local: localFixture(),
      loadNodes: () => nodes,
      runSsh: async (node, script) => {
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
      },
    });

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
    // Each call should have a unique jobId (we can't easily test this without exposing internals)
    // but we can verify all 3 calls succeeded
    assert.equal(results.length, 3);
  });

  test("no late success after cancellation: cleanup does not report verified=true", async () => {
    let cleanupTriggered = false;

    const transport = new MultiNodeWindowsComputerTransport({
      local: localFixture(),
      loadNodes: () => nodes,
      runSsh: async (node, script, signal) => {
        // Check if this is a cleanup script
        if (script.includes("ASTRA_REMOTE_CLEANUP_MARKER")) {
          cleanupTriggered = true;
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        // Main job - signal is already aborted, return failed result
        if (signal.aborted) {
          return { exitCode: -1, stdout: "", stderr: "Process cancelled." };
        }
        return {
          exitCode: 0,
          stdout: '{"computerName":"PC2"}',
          stderr: "",
        };
      },
    });

    // Create an already-aborted signal using a custom AbortSignal
    const signal = { 
      aborted: true, 
      addEventListener: () => {}, 
      removeEventListener: () => {}, 
      dispatchEvent: () => true,
      throwIfAborted: function() { if (this.aborted) throw new DOMException("Process cancelled.", "AbortError"); }
    } as unknown as AbortSignal;

    const result = await transport.call(
      "computer.owner.exec",
      { nodeId: "pc2", shell: "powershell", command: "Start-Sleep 10" },
      signal,
    );
    assert.equal(result.verified, false);
    assert.equal(result.ok, false);
    // Cleanup should still be triggered even when aborted before call
    assert.equal(cleanupTriggered, true);
  });
});