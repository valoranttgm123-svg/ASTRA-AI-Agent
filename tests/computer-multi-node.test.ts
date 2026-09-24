import assert from "node:assert/strict";
import test from "node:test";

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
            },
          ],
        }),
      ),
    /requires expectedComputerName/i,
  );
});

test("remote system-info uses explicit trusted SSH node and returns target evidence", async () => {
  let calls = 0;
  const transport = new MultiNodeWindowsComputerTransport({
    local: localFixture(),
    loadNodes: () => nodes,
    runSsh: async (node: AstraComputerNode, script: string) => {
      calls += 1;
      assert.equal(node.id, "pc2");
      assert.match(script, /ASTRA_IDENTITY_MISMATCH/);
      assert.match(script, /PC2/);
      return {
        exitCode: 0,
        stdout:
          '{"computerName":"PC2","platform":"win32","release":"10.0.19045","version":"10.0.19045","architecture":"AMD64"}\n',
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

  assert.equal(calls, 1);
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
  let calls = 0;
  const transport = new MultiNodeWindowsComputerTransport({
    local: localFixture(),
    loadNodes: () => nodes,
    runSsh: async () => {
      calls += 1;
      return { exitCode: 0, stdout: "", stderr: "" };
    },
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
  assert.equal(calls, 0);
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
