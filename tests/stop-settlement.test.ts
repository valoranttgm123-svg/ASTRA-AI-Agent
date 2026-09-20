import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deriveCapabilityRuntimeMap,
} from "../lib/agent/capability-runtime";
import type {
  AstraBrainEvent,
  AstraBrainStatus,
} from "../lib/brain/types";

const baseStatus: AstraBrainStatus = {
  ready: true,
  provider: "routing_only",
  mode: "routing_only",
  detail: "fixture",
  capabilities: {
    ops: {
      state: "READY",
      detail: "Ops ready",
    },
  },
};

test("Phase 15D2 automation cancellation settles Command Center Ops out of ACTIVE without fake success", () => {
  const events: AstraBrainEvent[] = [
    {
      id: "automation-start",
      type: "automation.started",
      at: 1,
      visualNode: "ops",
      label: "Automation started",
      detail: "Fixture occurrence started",
    },
    {
      id: "automation-cancel",
      type: "automation.cancelled",
      at: 2,
      visualNode: "ops",
      label: "Automation cancelled",
      detail: "Global STOP cancelled the occurrence",
    },
  ];

  const runtime = deriveCapabilityRuntimeMap(
    baseStatus,
    events,
  );

  assert.equal(runtime.ops.state, "BLOCKED");
  assert.equal(
    runtime.ops.lastEventType,
    "automation.cancelled",
  );
  assert.notEqual(runtime.ops.state, "ACTIVE");
  assert.equal(
    events.some(
      (event) => event.type === "automation.completed",
    ),
    false,
  );
});

test("Phase 15D2 a later real response.ready may reset terminal STOP visualization to the truthful base state", () => {
  const events: AstraBrainEvent[] = [
    {
      id: "automation-start",
      type: "automation.started",
      at: 1,
      visualNode: "ops",
      label: "Automation started",
    },
    {
      id: "automation-cancel",
      type: "automation.cancelled",
      at: 2,
      visualNode: "ops",
      label: "Automation cancelled",
    },
    {
      id: "response-ready",
      type: "response.ready",
      at: 3,
      visualNode: "chief_of_staff",
      label: "Response ready",
    },
  ];

  const runtime = deriveCapabilityRuntimeMap(
    baseStatus,
    events,
  );

  assert.equal(runtime.ops.state, "READY");
  assert.equal(runtime.ops.detail, "Ops ready");
});
