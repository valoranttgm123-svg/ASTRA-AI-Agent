import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPUTER_TOOL_DEFINITIONS,
  createComputerToolRegistrations,
  type AstraComputerTransport,
} from "../lib/tools/computer";
import { createExecutableToolRegistry } from "../lib/tools/executor";

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
