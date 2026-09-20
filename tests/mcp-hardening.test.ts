import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  AstraMcpToolDescriptor,
  AstraMcpTransport,
} from "../lib/tools/mcp";
import { createToolRuntime } from "../lib/tools/runtime";

function executionOptions(
  approvedPermissionLevel: 0 | 1 | 2 | 3 | 4,
  allowExternalActions = false,
) {
  return {
    approvedPermissionLevel,
    policy: {
      allowShell: false,
      allowFileWrite: false,
      allowExternalActions,
    },
  };
}

test("Phase 15C1 isolates one MCP discovery outage and keeps healthy/native tools usable", async () => {
  const failures: Array<{ serverId: string; detail: string }> = [];

  const broken: AstraMcpTransport = {
    serverId: "broken-server",
    async listTools() {
      throw new Error("fixture MCP discovery outage");
    },
    async callTool() {
      throw new Error("must not be called");
    },
  };

  const healthy: AstraMcpTransport = {
    serverId: "healthy-server",
    async listTools() {
      return [
        {
          name: "lookup",
          description: "Read fixture knowledge",
          permissionLevel: 1,
          sideEffect: "read",
        },
      ];
    },
    async callTool() {
      return {
        ok: true,
        detail: "healthy fixture result",
        content: { ok: true },
      };
    },
  };

  const runtime = await createToolRuntime({
    mcpTransports: [broken, healthy],
    onMcpDiscoveryError: (failure) => failures.push(failure),
  });

  assert.equal(runtime.has("mcp.healthy-server.lookup"), true);
  assert.equal(runtime.has("project.context.search"), true);
  assert.equal(runtime.has("mcp.broken-server.lookup"), false);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].serverId, "broken-server");
  assert.match(failures[0].detail, /discovery outage/i);
});

test("Phase 15C1 does not swallow AbortSignal during MCP discovery", async () => {
  const controller = new AbortController();
  controller.abort(new DOMException("global stop", "AbortError"));

  const transport: AstraMcpTransport = {
    serverId: "cancelled-server",
    async listTools() {
      return [];
    },
    async callTool() {
      return { ok: true, detail: "not reached" };
    },
  };

  await assert.rejects(
    createToolRuntime({
      mcpTransports: [transport],
      signal: controller.signal,
    }),
    /global stop/i,
  );
});

test("Phase 15C1 skips malformed MCP descriptors and keeps a valid bounded tool", async () => {
  const oversizedSchema = {
    description: "x".repeat(17_000),
  };

  const raw = [
    null,
    {},
    { name: "", description: "empty name" },
    { name: "x".repeat(121), description: "oversized name" },
    { name: "missing-description", description: "" },
    {
      name: "bad-permission",
      description: "bad permission",
      permissionLevel: 9,
    },
    {
      name: "bad-side-effect",
      description: "bad side effect",
      sideEffect: "network-admin",
    },
    {
      name: "bad-schema",
      description: "bad schema",
      inputSchema: oversizedSchema,
    },
    {
      name: "valid-tool",
      description: "valid bounded descriptor",
      permissionLevel: 1,
      sideEffect: "read",
      inputSchema: {
        type: "object",
      },
    },
  ] as unknown as AstraMcpToolDescriptor[];

  const transport: AstraMcpTransport = {
    serverId: "descriptor-fixture",
    async listTools() {
      return raw;
    },
    async callTool() {
      return {
        ok: true,
        detail: "ok",
      };
    },
  };

  const runtime = await createToolRuntime({
    mcpTransports: [transport],
  });

  const mcpTools = runtime
    .list()
    .filter((tool) => tool.provider === "mcp:descriptor-fixture");

  assert.equal(mcpTools.length, 1);
  assert.equal(mcpTools[0].id, "mcp.descriptor-fixture.valid-tool");
  assert.equal(mcpTools[0].permissionLevel, 1);
});

test("Phase 15C1 collapses duplicate normalized MCP tool ids instead of crashing runtime creation", async () => {
  const transport: AstraMcpTransport = {
    serverId: "duplicate-fixture",
    async listTools() {
      return [
        {
          name: "Read File",
          description: "First descriptor",
          permissionLevel: 1,
          sideEffect: "read",
        },
        {
          name: "read-file",
          description: "Duplicate normalized id",
          permissionLevel: 1,
          sideEffect: "read",
        },
      ];
    },
    async callTool() {
      return {
        ok: true,
        detail: "ok",
      };
    },
  };

  const runtime = await createToolRuntime({
    mcpTransports: [transport],
  });

  const tools = runtime
    .list()
    .filter((tool) => tool.provider === "mcp:duplicate-fixture");

  assert.equal(tools.length, 1);
  assert.equal(tools[0].id, "mcp.duplicate-fixture.read-file");
});

test("Phase 15C1 raises MCP permission to the side-effect safety floor", async () => {
  let calls = 0;
  const transport: AstraMcpTransport = {
    serverId: "permission-fixture",
    async listTools() {
      return [
        {
          name: "publish",
          description: "External write fixture",
          permissionLevel: 0,
          sideEffect: "external_write",
        },
      ];
    },
    async callTool() {
      calls += 1;
      return {
        ok: true,
        detail: "published fixture",
      };
    },
  };

  const runtime = await createToolRuntime({
    mcpTransports: [transport],
  });
  const definition = runtime.get("mcp.permission-fixture.publish");

  assert.ok(definition);
  assert.equal(definition.permissionLevel, 3);
  assert.equal(definition.sideEffect, "external_write");

  const blocked = await runtime.execute(
    definition.id,
    {},
    executionOptions(1, true),
  );
  assert.equal(blocked.status, "blocked");
  assert.equal(calls, 0);

  const allowed = await runtime.execute(
    definition.id,
    {},
    executionOptions(3, true),
  );
  assert.equal(allowed.status, "completed");
  assert.equal(allowed.verified, true);
  assert.equal(calls, 1);
});

test("Phase 15C1 rejects malformed MCP call results without verified success", async () => {
  const transport: AstraMcpTransport = {
    serverId: "malformed-call",
    async listTools() {
      return [
        {
          name: "lookup",
          description: "Fixture",
          permissionLevel: 1,
          sideEffect: "read",
        },
      ];
    },
    async callTool() {
      return undefined as unknown as {
        ok: boolean;
        detail: string;
      };
    },
  };

  const runtime = await createToolRuntime({
    mcpTransports: [transport],
  });
  const result = await runtime.execute(
    "mcp.malformed-call.lookup",
    {},
    executionOptions(1),
  );

  assert.equal(result.status, "failed");
  assert.equal(result.verified, false);
  assert.match(result.detail, /malformed result/i);
});

test("Phase 15C1 applies the shared Tool Runtime output bound to MCP content", async () => {
  const transport: AstraMcpTransport = {
    serverId: "oversized-call",
    async listTools() {
      return [
        {
          name: "lookup",
          description: "Fixture",
          permissionLevel: 1,
          sideEffect: "read",
        },
      ];
    },
    async callTool() {
      return {
        ok: true,
        detail: "fixture",
        content: {
          text: "x".repeat(70_000),
        },
      };
    },
  };

  const runtime = await createToolRuntime({
    mcpTransports: [transport],
  });
  const result = await runtime.execute(
    "mcp.oversized-call.lookup",
    {},
    executionOptions(1),
  );

  assert.equal(result.status, "failed");
  assert.equal(result.verified, false);
  assert.match(result.detail, /output exceeded/i);
});
