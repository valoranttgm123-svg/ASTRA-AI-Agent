import assert from "node:assert/strict";
import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import { AstraPairingRegistry } from "../lib/devices/pairing";
import { AstraDevicePresenceRegistry } from "../lib/devices/presence";
import { planDeviceRoute } from "../lib/devices/routing";
import {
  loadDeviceStore,
  registerPendingDeviceNode,
  saveDeviceStore,
  setDeviceNodeState,
} from "../lib/devices/store";

const originalDeviceFile = process.env.ASTRA_DEVICE_FILE;

afterEach(() => {
  if (originalDeviceFile === undefined) {
    delete process.env.ASTRA_DEVICE_FILE;
  } else {
    process.env.ASTRA_DEVICE_FILE = originalDeviceFile;
  }
});

test("pairing challenge is single-use and device-bound", () => {
  const registry = new AstraPairingRegistry();
  const challenge = registry.create({
    deviceId: "pc2",
    now: new Date("2026-09-22T09:00:00.000Z"),
  });

  assert.equal(
    registry.consume({
      challengeId: challenge.id,
      deviceId: "wrong-device",
      token: challenge.token,
      now: new Date("2026-09-22T09:00:10.000Z"),
    }),
    false,
  );

  assert.equal(
    registry.consume({
      challengeId: challenge.id,
      deviceId: "pc2",
      token: challenge.token,
      now: new Date("2026-09-22T09:00:20.000Z"),
    }),
    false,
  );

  const second = registry.create({
    deviceId: "pc2",
    now: new Date("2026-09-22T09:01:00.000Z"),
  });
  assert.equal(
    registry.consume({
      challengeId: second.id,
      deviceId: "pc2",
      token: second.token,
      now: new Date("2026-09-22T09:01:05.000Z"),
    }),
    true,
  );
  assert.equal(registry.size(), 0);
});

test("expired pairing challenge and revoked-device challenge fail closed", () => {
  const registry = new AstraPairingRegistry();
  const expired = registry.create({
    deviceId: "pc2",
    ttlMs: 1_000,
    now: new Date("2026-09-22T09:00:00.000Z"),
  });
  assert.equal(
    registry.consume({
      challengeId: expired.id,
      deviceId: "pc2",
      token: expired.token,
      now: new Date("2026-09-22T09:00:02.000Z"),
    }),
    false,
  );

  const revoked = registry.create({
    deviceId: "pc2",
    now: new Date("2026-09-22T09:02:00.000Z"),
  });
  registry.revokeForDevice("pc2");
  assert.equal(
    registry.consume({
      challengeId: revoked.id,
      deviceId: "pc2",
      token: revoked.token,
      now: new Date("2026-09-22T09:02:10.000Z"),
    }),
    false,
  );
});

test("presence advertisements expire and carry only bounded capabilities", () => {
  const presence = new AstraDevicePresenceRegistry();
  const live = presence.advertise({
    deviceId: "pc2",
    capabilities: ["codex", "files.read", "codex"],
    ttlMs: 1_000,
    now: new Date("2026-09-22T09:00:00.000Z"),
  });
  assert.deepEqual(live.capabilities, ["codex", "files.read"]);
  assert.equal(
    presence.get("pc2", new Date("2026-09-22T09:00:00.500Z"))?.online,
    true,
  );
  assert.equal(
    presence.get("pc2", new Date("2026-09-22T09:00:02.000Z")),
    undefined,
  );
});

test("device cannot become paired until linked trust identity is trusted and revoke is terminal", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-device-"));
  process.env.ASTRA_DEVICE_FILE = path.join(root, "devices.json");

  const pending = await registerPendingDeviceNode({
    id: "pc2",
    trustedDeviceId: "trust-pc2",
    label: "PC2",
    transport: "ssh",
    maxPermissionLevel: 2,
    capabilities: ["codex", "files.read"],
    now: new Date("2026-09-22T09:00:00.000Z"),
  });
  assert.equal(pending.state, "pending");

  await assert.rejects(
    setDeviceNodeState({
      id: "pc2",
      state: "paired",
      trustedDeviceState: "pending",
      now: new Date("2026-09-22T09:01:00.000Z"),
    }),
    /cannot be paired until/i,
  );

  const paired = await setDeviceNodeState({
    id: "pc2",
    state: "paired",
    trustedDeviceState: "trusted",
    now: new Date("2026-09-22T09:02:00.000Z"),
  });
  assert.equal(paired.state, "paired");

  const revoked = await setDeviceNodeState({
    id: "pc2",
    state: "revoked",
    trustedDeviceState: "revoked",
    now: new Date("2026-09-22T09:03:00.000Z"),
  });
  assert.equal(revoked.state, "revoked");

  await assert.rejects(
    setDeviceNodeState({
      id: "pc2",
      state: "paired",
      trustedDeviceState: "trusted",
      now: new Date("2026-09-22T09:04:00.000Z"),
    }),
    /cannot be reactivated/i,
  );
});

test("route planner selects only trusted paired live capability-matched devices and preserves approval", () => {
  const devices = [
    {
      id: "primary",
      trustedDeviceId: "trust-primary",
      label: "Primary",
      state: "paired" as const,
      transport: "local" as const,
      maxPermissionLevel: 1 as const,
      capabilities: ["files.read"],
      createdAt: "2026-09-22T08:00:00.000Z",
      updatedAt: "2026-09-22T08:00:00.000Z",
    },
    {
      id: "pc2",
      trustedDeviceId: "trust-pc2",
      label: "PC2",
      state: "paired" as const,
      transport: "ssh" as const,
      maxPermissionLevel: 2 as const,
      capabilities: ["codex"],
      createdAt: "2026-09-22T08:00:00.000Z",
      updatedAt: "2026-09-22T08:00:00.000Z",
    },
  ];

  const plan = planDeviceRoute({
    request: {
      capability: "codex",
      requiredPermissionLevel: 2,
    },
    devices,
    advertisements: [
      {
        deviceId: "primary",
        online: true,
        capabilities: ["files.read"],
        observedAt: "2026-09-22T09:00:00.000Z",
        expiresAt: "2026-09-22T09:05:00.000Z",
      },
      {
        deviceId: "pc2",
        online: true,
        capabilities: ["codex"],
        observedAt: "2026-09-22T09:00:00.000Z",
        expiresAt: "2026-09-22T09:05:00.000Z",
      },
    ],
    trustedDeviceIds: new Set(["trust-primary", "trust-pc2"]),
    now: new Date("2026-09-22T09:01:00.000Z"),
  });

  assert.equal(plan.selected?.deviceId, "pc2");
  assert.equal(plan.selected?.requiresApproval, true);
  assert.match(plan.selected?.detail ?? "", /approval remains required/i);

  const untrusted = planDeviceRoute({
    request: {
      capability: "codex",
      requiredPermissionLevel: 2,
    },
    devices,
    advertisements: [
      {
        deviceId: "pc2",
        online: true,
        capabilities: ["codex"],
        observedAt: "2026-09-22T09:00:00.000Z",
        expiresAt: "2026-09-22T09:05:00.000Z",
      },
    ],
    trustedDeviceIds: new Set(),
    now: new Date("2026-09-22T09:01:00.000Z"),
  });
  assert.equal(untrusted.selected, undefined);
});

test("expired advertisements and insufficient permission ceilings prevent routing", () => {
  const device = {
    id: "pc2",
    trustedDeviceId: "trust-pc2",
    label: "PC2",
    state: "paired" as const,
    transport: "ssh" as const,
    maxPermissionLevel: 1 as const,
    capabilities: ["codex"],
    createdAt: "2026-09-22T08:00:00.000Z",
    updatedAt: "2026-09-22T08:00:00.000Z",
  };
  const ad = {
    deviceId: "pc2",
    online: true as const,
    capabilities: ["codex"],
    observedAt: "2026-09-22T09:00:00.000Z",
    expiresAt: "2026-09-22T09:00:30.000Z",
  };

  assert.equal(
    planDeviceRoute({
      request: { capability: "codex", requiredPermissionLevel: 2 },
      devices: [device],
      advertisements: [ad],
      trustedDeviceIds: new Set(["trust-pc2"]),
      now: new Date("2026-09-22T09:00:10.000Z"),
    }).selected,
    undefined,
  );

  assert.equal(
    planDeviceRoute({
      request: { capability: "codex", requiredPermissionLevel: 1 },
      devices: [device],
      advertisements: [ad],
      trustedDeviceIds: new Set(["trust-pc2"]),
      now: new Date("2026-09-22T09:01:00.000Z"),
    }).selected,
    undefined,
  );
});

test("device registry rejects symlink targets and duplicate trusted identities", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-device-link-"));
  const target = path.join(root, "target.json");
  const linked = path.join(root, "devices.json");
  await writeFile(
    target,
    JSON.stringify({ schemaVersion: 1, devices: [] }),
    "utf8",
  );
  await symlink(target, linked);
  process.env.ASTRA_DEVICE_FILE = linked;

  const loaded = await loadDeviceStore();
  assert.equal(loaded.available, false);
  assert.match(loaded.detail, /symbolic link/i);

  process.env.ASTRA_DEVICE_FILE = path.join(root, "normal.json");
  const base = {
    label: "Node",
    state: "pending" as const,
    transport: "lan" as const,
    maxPermissionLevel: 1 as const,
    capabilities: ["files.read"],
    createdAt: "2026-09-22T08:00:00.000Z",
    updatedAt: "2026-09-22T08:00:00.000Z",
  };
  await assert.rejects(
    saveDeviceStore({
      schemaVersion: 1,
      devices: [
        {
          ...base,
          id: "one",
          trustedDeviceId: "same-trust",
        },
        {
          ...base,
          id: "two",
          trustedDeviceId: "same-trust",
        },
      ],
    }),
    /one trusted-device identity/i,
  );
});
