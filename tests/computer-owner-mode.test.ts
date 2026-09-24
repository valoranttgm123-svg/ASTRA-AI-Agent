import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPUTER_TOOL_DEFINITIONS,
  createComputerToolRegistrations,
  parseDirectOwnerCommand,
  parseDirectReadOnlyComputerCommand,
  type AstraComputerTransport,
} from "../lib/tools/computer";
import { createExecutableToolRegistry } from "../lib/tools/executor";

test("direct read-only parser preserves explicit remote target and rejects ambiguity", () => {
  assert.deepEqual(
    parseDirectReadOnlyComputerCommand("cek versi Windows PC3"),
    {
      toolId: "computer.system.info",
      nodeId: "pc3",
    },
  );

  assert.deepEqual(
    parseDirectReadOnlyComputerCommand("lihat process list @devicesnr"),
    {
      toolId: "computer.process.list",
      nodeId: "devicesnr",
    },
  );

  assert.deepEqual(
    parseDirectReadOnlyComputerCommand("cek versi Windows"),
    {
      toolId: "computer.system.info",
    },
  );

  assert.equal(
    parseDirectReadOnlyComputerCommand("cek versi Windows PC2 dan PC3"),
    null,
  );
});

test("read-only system info timeout is compatible with bounded SSH connect timeout", () => {
  const definition = COMPUTER_TOOL_DEFINITIONS.find(
    (tool) => tool.id === "computer.system.info",
  );
  assert.ok(definition);
  assert.ok(definition.timeoutMs > 8_000);
});

test("Owner Mode command is a cancellable Level-2 computer capability", () => {
  const definition = COMPUTER_TOOL_DEFINITIONS.find(
    (tool) => tool.id === "computer.owner.exec",
  );

  assert.ok(definition);
  assert.equal(definition.permissionLevel, 2);
  assert.equal(definition.sideEffect, "local_write");
  assert.equal(definition.supportsCancellation, true);
  assert.equal(definition.availability, "NOT_CONFIGURED");
});

test("Owner Mode registration executes only when shell policy allows it", async () => {
  let calls = 0;

  const transport: AstraComputerTransport = {
    provider: "fixture-owner",
    async status() {
      return {
        configured: true,
        available: true,
        provider: "fixture-owner",
        detail: "fixture ready",
        capabilities: ["computer.owner.exec"],
      };
    },
    async call(capability, input) {
      calls += 1;
      assert.equal(capability, "computer.owner.exec");
      assert.deepEqual(input, {
        command: "Write-Output ASTRA_OWNER_OK",
        shell: "powershell",
      });

      return {
        ok: true,
        verified: true,
        detail: "fixture command completed",
        output: {
          exitCode: 0,
          stdout: "ASTRA_OWNER_OK\n",
          stderr: "",
        },
      };
    },
  };

  const registrations = await createComputerToolRegistrations(transport);
  const runtime = createExecutableToolRegistry(
    registrations.definitions,
    registrations.handlers,
  );

  const blocked = await runtime.execute(
    "computer.owner.exec",
    {
      command: "Write-Output ASTRA_OWNER_OK",
      shell: "powershell",
    },
    {
      approvedPermissionLevel: 2,
      policy: {
        allowShell: false,
        allowFileWrite: true,
        allowExternalActions: false,
      },
    },
  );

  assert.equal(blocked.status, "blocked");
  assert.equal(calls, 0);

  const completed = await runtime.execute(
    "computer.owner.exec",
    {
      command: "Write-Output ASTRA_OWNER_OK",
      shell: "powershell",
    },
    {
      approvedPermissionLevel: 2,
      policy: {
        allowShell: true,
        allowFileWrite: true,
        allowExternalActions: false,
      },
    },
  );

  assert.equal(completed.status, "completed");
  assert.equal(completed.verified, true);
  assert.equal(calls, 1);
});


test("explicit Owner Mode prefixes parse without natural-language planning", () => {
  assert.deepEqual(
    parseDirectOwnerCommand("powershell: Write-Output ASTRA_OWNER_OK"),
    {
      shell: "powershell",
      command: "Write-Output ASTRA_OWNER_OK",
    },
  );

  assert.deepEqual(
    parseDirectOwnerCommand("jalankan owner mode cmd: whoami"),
    {
      shell: "cmd",
      command: "whoami",
    },
  );

  assert.deepEqual(
    parseDirectOwnerCommand("run pwsh: Get-Date"),
    {
      shell: "powershell",
      command: "Get-Date",
    },
  );

  assert.deepEqual(
    parseDirectOwnerCommand("run owner mode @pc2 powershell: hostname"),
    {
      nodeId: "pc2",
      shell: "powershell",
      command: "hostname",
    },
  );
});

test("Owner Mode direct parser rejects ambiguous natural language and oversized commands", () => {
  assert.equal(
    parseDirectOwnerCommand("tolong hapus file sementara di komputer ini"),
    null,
  );
  assert.equal(parseDirectOwnerCommand("powershell:"), null);
  assert.equal(parseDirectOwnerCommand("@-bad powershell: whoami"), null);
  assert.equal(
    parseDirectOwnerCommand("powershell: " + "x".repeat(8193)),
    null,
  );
});
