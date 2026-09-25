import assert from "node:assert/strict";
import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

async function createSymlink(
  target: string,
  linkPath: string,
  type?: "file" | "dir",
) {
  try {
    await symlink(target, linkPath, type);
    return true;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
    if (["EPERM", "EACCES", "ENOSYS"].includes(code)) return false;
    throw error;
  }
}

import type { AstraIdentitySession } from "../lib/identity/contracts";
import {
  identityPermissionCeiling,
  identityPermissionView,
  sessionCanRequestExternalWrite,
  sessionCanUseSecrets,
} from "../lib/identity/policy";
import { AstraIdentitySessionRegistry } from "../lib/identity/sessions";
import {
  createEnvironmentSecretProvider,
  AstraSecretBroker,
} from "../lib/identity/secrets";
import {
  loadTrustStore,
  registerPendingDevice,
  saveTrustStore,
  setTrustedDeviceState,
} from "../lib/identity/store";

const originalTrustFile = process.env.ASTRA_TRUST_FILE;
const originalExampleSecret = process.env.ASTRA_TEST_SECRET;

afterEach(() => {
  if (originalTrustFile === undefined) {
    delete process.env.ASTRA_TRUST_FILE;
  } else {
    process.env.ASTRA_TRUST_FILE = originalTrustFile;
  }
  if (originalExampleSecret === undefined) {
    delete process.env.ASTRA_TEST_SECRET;
  } else {
    process.env.ASTRA_TEST_SECRET = originalExampleSecret;
  }
});

function unlockedSession(
  overrides: Partial<AstraIdentitySession> = {},
): AstraIdentitySession {
  return {
    id: "session-1",
    principalId: "owner",
    role: "owner",
    state: "unlocked",
    scopes: ["brain.chat", "secrets.use", "external.write"],
    createdAt: "2026-09-22T08:00:00.000Z",
    expiresAt: "2026-09-22T16:00:00.000Z",
    lastActivityAt: "2026-09-22T08:00:00.000Z",
    unlockedAt: "2026-09-22T08:00:00.000Z",
    unlockEvidence: {
      method: "os_session",
      verifiedAt: "2026-09-22T08:00:00.000Z",
      detail: "OS session verified.",
    },
    ...overrides,
  };
}

test("identity role/session state only sets a permission ceiling, never Level 4", () => {
  assert.equal(
    identityPermissionCeiling(
      unlockedSession({ state: "locked", unlockedAt: undefined, unlockEvidence: undefined }),
    ),
    1,
  );
  assert.equal(identityPermissionCeiling(unlockedSession({ role: "guest" })), 1);
  assert.equal(
    identityPermissionCeiling(unlockedSession({ role: "trusted_user" })),
    2,
  );
  assert.equal(identityPermissionCeiling(unlockedSession({ role: "owner" })), 3);

  const view = identityPermissionView(unlockedSession());
  assert.equal(view.permissionCeiling, 3);
  assert.match(view.detail, /approval remain independently required/i);
});

test("secret and external-write scopes require an unlocked trusted session", () => {
  assert.equal(sessionCanUseSecrets(unlockedSession()), true);
  assert.equal(sessionCanRequestExternalWrite(unlockedSession()), true);

  assert.equal(
    sessionCanUseSecrets(
      unlockedSession({ role: "guest" }),
    ),
    false,
  );
  assert.equal(
    sessionCanUseSecrets(
      unlockedSession({
        state: "locked",
        unlockedAt: undefined,
        unlockEvidence: undefined,
      }),
    ),
    false,
  );
  assert.equal(
    sessionCanRequestExternalWrite(
      unlockedSession({
        scopes: ["brain.chat", "secrets.use"],
      }),
    ),
    false,
  );
});

test("session registry creates locked sessions, requires explicit verified unlock evidence, and prunes expiry", () => {
  const registry = new AstraIdentitySessionRegistry();
  const created = registry.create({
    principalId: "owner",
    role: "owner",
    scopes: ["brain.chat", "secrets.use"],
    ttlMs: 60_000,
    now: new Date("2026-09-22T08:00:00.000Z"),
  });
  assert.equal(created.state, "locked");

  const unlocked = registry.unlock({
    sessionId: created.id,
    evidence: {
      method: "explicit_owner_approval",
      verifiedAt: "2026-09-22T08:00:05.000Z",
      detail: "Owner explicitly approved unlock.",
    },
    now: new Date("2026-09-22T08:00:05.000Z"),
  });
  assert.equal(unlocked.state, "unlocked");

  const locked = registry.lock(
    created.id,
    new Date("2026-09-22T08:00:10.000Z"),
  );
  assert.equal(locked.state, "locked");

  assert.equal(
    registry.get(
      created.id,
      new Date("2026-09-22T08:02:00.000Z"),
    ),
    undefined,
  );
});

test("trusted-device registry persists only hashed identity metadata and enforces revoke semantics", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-trust-"));
  const trustFile = path.join(root, "trust.json");
  process.env.ASTRA_TRUST_FILE = trustFile;

  const pending = await registerPendingDevice({
    id: "pc2",
    label: "PC2",
    fingerprintHash: "a".repeat(64),
    scopes: ["brain.chat", "device.route"],
    now: new Date("2026-09-22T08:00:00.000Z"),
  });
  assert.equal(pending.state, "pending");

  const trusted = await setTrustedDeviceState({
    id: "pc2",
    state: "trusted",
    now: new Date("2026-09-22T08:01:00.000Z"),
  });
  assert.equal(trusted.state, "trusted");

  await assert.rejects(
    setTrustedDeviceState({
      id: "pc2",
      state: "pending",
      now: new Date("2026-09-22T08:02:00.000Z"),
    }),
    /cannot return to pending/i,
  );

  const revoked = await setTrustedDeviceState({
    id: "pc2",
    state: "revoked",
    now: new Date("2026-09-22T08:03:00.000Z"),
  });
  assert.equal(revoked.state, "revoked");

  await assert.rejects(
    setTrustedDeviceState({
      id: "pc2",
      state: "trusted",
      now: new Date("2026-09-22T08:04:00.000Z"),
    }),
    /cannot be silently re-trusted/i,
  );

  const raw = await readFile(trustFile, "utf8");
  assert.match(raw, /"fingerprintHash"/);
  assert.doesNotMatch(raw, /password|api[_-]?key|secret/i);
});

test("trust store rejects duplicate fingerprint identities and symbolic-link targets", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-trust-link-"));
  const target = path.join(root, "target.json");
  const linked = path.join(root, "trust.json");

  await writeFile(
    target,
    JSON.stringify({ schemaVersion: 1, devices: [] }),
    "utf8",
  );
  const created = await createSymlink(target, linked);
  if (!created) {
    t.skip("symlinks are unavailable in this environment");
    return;
  }
  process.env.ASTRA_TRUST_FILE = linked;

  const linkedLoad = await loadTrustStore();
  assert.equal(linkedLoad.available, false);
  assert.match(linkedLoad.detail, /symbolic link/i);

  process.env.ASTRA_TRUST_FILE = path.join(root, "normal.json");
  await assert.rejects(
    saveTrustStore({
      schemaVersion: 1,
      devices: [
        {
          id: "one",
          label: "One",
          fingerprintHash: "b".repeat(64),
          state: "pending",
          scopes: [],
          createdAt: "2026-09-22T08:00:00.000Z",
          updatedAt: "2026-09-22T08:00:00.000Z",
        },
        {
          id: "two",
          label: "Two",
          fingerprintHash: "b".repeat(64),
          state: "pending",
          scopes: [],
          createdAt: "2026-09-22T08:00:00.000Z",
          updatedAt: "2026-09-22T08:00:00.000Z",
        },
      ],
    }),
    /duplicate trusted device fingerprint/i,
  );
});

test("secret broker exposes presence only and resolves values only inside authorized callback", async () => {
  process.env.ASTRA_TEST_SECRET = "never-log-this-secret";

  const broker = new AstraSecretBroker().register(
    createEnvironmentSecretProvider({
      "nvidia.api-key": "ASTRA_TEST_SECRET",
    }),
  );
  const reference = {
    id: "nvidia",
    providerId: "environment",
    secretName: "nvidia.api-key",
    purpose: "NVIDIA runtime authentication",
  };

  const presence = await broker.presence(reference);
  assert.equal(presence.configured, true);
  assert.doesNotMatch(presence.detail, /never-log-this-secret/);

  await assert.rejects(
    broker.withSecret({
      reference,
      session: unlockedSession({
        state: "locked",
        unlockedAt: undefined,
        unlockEvidence: undefined,
      }),
      consume: async () => "should-not-run",
    }),
    /not allowed to use secrets/i,
  );

  const result = await broker.withSecret({
    reference,
    session: unlockedSession(),
    consume: async (secret) => secret === "never-log-this-secret",
  });
  assert.equal(result, true);
});
