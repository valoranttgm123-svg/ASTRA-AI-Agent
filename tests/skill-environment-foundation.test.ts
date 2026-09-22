import assert from "node:assert/strict";
import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import {
  applySkillMutation,
  checkSkillHealth,
  loadSkillStore,
  registerSkill,
} from "../lib/skills/registry";
import {
  checkEnvironmentDeviceHealth,
  loadEnvironmentStore,
  normalizeEnvironmentDevice,
  planEnvironmentOperation,
  registerEnvironmentDevice,
  setEnvironmentDeviceEnabled,
} from "../lib/environment/registry";
import { createToolRegistry } from "../lib/tools/registry";

const originalSkillFile = process.env.ASTRA_GENERIC_SKILL_REGISTRY_FILE;
const originalEnvironmentFile =
  process.env.ASTRA_ENVIRONMENT_REGISTRY_FILE;

afterEach(() => {
  if (originalSkillFile === undefined) {
    delete process.env.ASTRA_GENERIC_SKILL_REGISTRY_FILE;
  } else {
    process.env.ASTRA_GENERIC_SKILL_REGISTRY_FILE = originalSkillFile;
  }
  if (originalEnvironmentFile === undefined) {
    delete process.env.ASTRA_ENVIRONMENT_REGISTRY_FILE;
  } else {
    process.env.ASTRA_ENVIRONMENT_REGISTRY_FILE =
      originalEnvironmentFile;
  }
});

function toolRegistry() {
  return createToolRegistry([
    {
      id: "room.status",
      name: "Room status",
      category: "mcp",
      description: "Read a registered room device state.",
      permissionLevel: 1,
      sideEffect: "read",
      timeoutMs: 5_000,
      supportsCancellation: true,
      provider: "fixture",
      availability: "READY",
    },
    {
      id: "room.control",
      name: "Room control",
      category: "mcp",
      description: "Control a registered room device.",
      permissionLevel: 3,
      sideEffect: "external_write",
      timeoutMs: 5_000,
      supportsCancellation: true,
      provider: "fixture",
      availability: "READY",
    },
  ]);
}

test("generic skill starts untrusted/disabled and supports verified update rollback", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-skill-"));
  process.env.ASTRA_GENERIC_SKILL_REGISTRY_FILE = path.join(root, "skills.json");

  const created = await registerSkill({
    id: "room-helper",
    version: "1.0.0",
    capability: "room.status",
    toolIds: ["room.status"],
    provider: "fixture-provider",
    permissionLevel: 1,
    verificationMethod: "Read-back fixture response.",
    now: new Date("2026-09-22T10:00:00.000Z"),
  });

  assert.equal(created.trustState, "untrusted");
  assert.equal(created.installState, "registered");
  assert.equal(created.enabled, false);

  await assert.rejects(
    applySkillMutation({
      skillId: created.id,
      action: "install",
      verificationEvidence: "fixture",
    }),
    /untrusted/i,
  );

  await applySkillMutation({
    skillId: created.id,
    action: "review",
    now: new Date("2026-09-22T10:01:00.000Z"),
  });
  await applySkillMutation({
    skillId: created.id,
    action: "install",
    verificationEvidence: "provider install returned success and local manifest read back",
    now: new Date("2026-09-22T10:02:00.000Z"),
  });
  const enabled = await applySkillMutation({
    skillId: created.id,
    action: "enable",
    now: new Date("2026-09-22T10:03:00.000Z"),
  });

  assert.equal(enabled.enabled, true);
  assert.equal(
    checkSkillHealth({
      skill: enabled,
      tools: toolRegistry(),
    }).status,
    "READY",
  );

  const updated = await applySkillMutation({
    skillId: created.id,
    action: "update",
    targetVersion: "2.0.0",
    targetChecksum: "sha256:fixture-v2",
    verificationEvidence: "provider update verified by read-back",
    now: new Date("2026-09-22T10:04:00.000Z"),
  });
  assert.equal(updated.version, "2.0.0");
  assert.equal(updated.rollback?.version, "1.0.0");

  const rolledBack = await applySkillMutation({
    skillId: created.id,
    action: "rollback",
    verificationEvidence: "provider rollback verified by read-back",
    now: new Date("2026-09-22T10:05:00.000Z"),
  });
  assert.equal(rolledBack.version, "1.0.0");
  assert.equal(rolledBack.rollback?.version, "2.0.0");

  const disabled = await applySkillMutation({
    skillId: created.id,
    action: "disable",
    now: new Date("2026-09-22T10:06:00.000Z"),
  });
  assert.equal(disabled.enabled, false);
  assert.equal(
    checkSkillHealth({
      skill: disabled,
      tools: toolRegistry(),
    }).status,
    "DISABLED",
  );
});

test("generic skill health fails closed on understated tool permission and missing requirements", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-skill-health-"));
  process.env.ASTRA_GENERIC_SKILL_REGISTRY_FILE = path.join(root, "skills.json");

  const created = await registerSkill({
    id: "unsafe-declaration",
    version: "1.0.0",
    capability: "room.control",
    toolIds: ["room.control"],
    provider: "fixture-provider",
    permissionLevel: 1,
    network: "internet",
    secretNames: ["ROOM_TOKEN"],
    verificationMethod: "Provider read-back.",
  });
  await applySkillMutation({ skillId: created.id, action: "review" });
  await applySkillMutation({
    skillId: created.id,
    action: "install",
    verificationEvidence: "verified",
  });
  const enabled = await applySkillMutation({
    skillId: created.id,
    action: "enable",
  });

  assert.equal(
    checkSkillHealth({
      skill: enabled,
      tools: toolRegistry(),
      availableSecrets: new Set(["ROOM_TOKEN"]),
      internetAvailable: true,
    }).status,
    "ERROR",
  );

  const requirements = checkSkillHealth({
    skill: enabled,
    tools: createToolRegistry([
      {
        id: "room.control",
        name: "Compatible fixture",
        category: "mcp",
        description: "Read-only fixture for requirement ordering.",
        permissionLevel: 1,
        sideEffect: "read",
        timeoutMs: 5_000,
        supportsCancellation: true,
        provider: "fixture",
        availability: "READY",
      },
    ]),
  });
  assert.equal(requirements.status, "NOT_CONFIGURED");
  assert.match(requirements.detail, /secret/i);
});

test("environment devices are explicit, disabled by default, and writes stay approval-bound", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-environment-"));
  process.env.ASTRA_ENVIRONMENT_REGISTRY_FILE = path.join(
    root,
    "environment.json",
  );

  const created = await registerEnvironmentDevice({
    id: "desk-plug",
    label: "Desk smart plug",
    kind: "smart_plug",
    provider: "fixture-provider",
    privacyClass: "standard",
    capabilities: [
      {
        id: "status",
        mode: "read",
        toolId: "room.status",
        permissionLevel: 1,
      },
      {
        id: "power",
        mode: "write",
        toolId: "room.control",
        permissionLevel: 3,
      },
    ],
    now: new Date("2026-09-22T11:00:00.000Z"),
  });

  assert.equal(created.enabled, false);
  assert.equal(
    planEnvironmentOperation({
      device: created,
      capabilityId: "status",
      approvedPermissionLevel: 1,
    }).allowed,
    false,
  );

  const enabled = await setEnvironmentDeviceEnabled({
    deviceId: created.id,
    enabled: true,
    now: new Date("2026-09-22T11:01:00.000Z"),
  });

  assert.equal(
    checkEnvironmentDeviceHealth({
      device: enabled,
      tools: toolRegistry(),
    }).status,
    "READY",
  );

  const read = planEnvironmentOperation({
    device: enabled,
    capabilityId: "status",
    approvedPermissionLevel: 1,
  });
  assert.equal(read.allowed, true);
  assert.equal(read.requiresApproval, false);
  assert.equal(read.toolId, "room.status");

  const blockedWrite = planEnvironmentOperation({
    device: enabled,
    capabilityId: "power",
    approvedPermissionLevel: 2,
  });
  assert.equal(blockedWrite.allowed, false);
  assert.equal(blockedWrite.requiresApproval, true);

  const approvedWrite = planEnvironmentOperation({
    device: enabled,
    capabilityId: "power",
    approvedPermissionLevel: 3,
  });
  assert.equal(approvedWrite.allowed, true);
  assert.equal(approvedWrite.requiresApproval, true);
  assert.equal(approvedWrite.toolId, "room.control");
});

test("camera and sensor registrations require sensitive classification and per-operation privacy consent", async () => {
  assert.throws(
    () =>
      normalizeEnvironmentDevice({
        id: "camera-1",
        label: "Camera",
        kind: "camera",
        provider: "fixture",
        enabled: false,
        privacyClass: "standard",
        capabilities: [
          {
            id: "status",
            mode: "read",
            toolId: "room.status",
            permissionLevel: 1,
          },
        ],
        createdAt: "2026-09-22T11:00:00.000Z",
        updatedAt: "2026-09-22T11:00:00.000Z",
      }),
    /sensitive privacy/i,
  );

  const root = await mkdtemp(path.join(os.tmpdir(), "astra-camera-"));
  process.env.ASTRA_ENVIRONMENT_REGISTRY_FILE = path.join(
    root,
    "environment.json",
  );
  const camera = await registerEnvironmentDevice({
    id: "camera-1",
    label: "Office camera",
    kind: "camera",
    provider: "fixture",
    privacyClass: "sensitive",
    capabilities: [
      {
        id: "status",
        mode: "read",
        toolId: "room.status",
        permissionLevel: 1,
      },
    ],
  });
  const enabled = await setEnvironmentDeviceEnabled({
    deviceId: camera.id,
    enabled: true,
  });

  assert.equal(
    planEnvironmentOperation({
      device: enabled,
      capabilityId: "status",
      approvedPermissionLevel: 1,
    }).allowed,
    false,
  );
  assert.equal(
    planEnvironmentOperation({
      device: enabled,
      capabilityId: "status",
      approvedPermissionLevel: 1,
      privacyConsent: true,
    }).allowed,
    true,
  );
});

test("skill and environment registries reject symbolic-link targets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-phase29-link-"));
  const target = path.join(root, "target.json");
  const skillLink = path.join(root, "skills.json");
  const environmentLink = path.join(root, "environment.json");

  await writeFile(
    target,
    JSON.stringify({ schemaVersion: 1, skills: [] }),
    "utf8",
  );
  await symlink(target, skillLink);
  await symlink(target, environmentLink);

  process.env.ASTRA_GENERIC_SKILL_REGISTRY_FILE = skillLink;
  const skills = await loadSkillStore();
  assert.equal(skills.available, false);
  assert.match(skills.detail, /symbolic link/i);

  process.env.ASTRA_ENVIRONMENT_REGISTRY_FILE = environmentLink;
  const environment = await loadEnvironmentStore();
  assert.equal(environment.available, false);
  assert.match(environment.detail, /symbolic link/i);
});
