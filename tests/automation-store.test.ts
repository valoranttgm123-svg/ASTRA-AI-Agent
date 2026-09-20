import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import type { AstraAutomationDefinition } from "../lib/automation/contracts";
import {
  getAutomationStorePath,
  loadAutomationStore,
  normalizeAutomationDefinitions,
  saveAutomationStore,
} from "../lib/automation/store";

function fixture(
  overrides: Partial<AstraAutomationDefinition> = {},
): AstraAutomationDefinition {
  return {
    id: "fixture-daily-summary",
    title: "Project summary",
    goal: "Inspect registered project context and prepare a read-only summary.",
    projectId: "astra",
    createdAt: "2026-09-20T08:00:00.000Z",
    updatedAt: "2026-09-20T08:00:00.000Z",
    status: "enabled",
    schedule: {
      kind: "interval",
      anchorAt: "2026-09-20T09:00:00.000Z",
      everyMinutes: 60,
    },
    requiredPermissionLevel: 1,
    maxRuntimeMs: 60_000,
    ...overrides,
  };
}

async function withPrivateStore(
  run: (source: string) => Promise<void>,
) {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-automation-"));
  const source = path.join(root, ".astra", "automations.json");
  const previousFile = process.env.ASTRA_AUTOMATION_FILE;
  const previousEnabled = process.env.ASTRA_AUTOMATION_ENABLED;

  process.env.ASTRA_AUTOMATION_FILE = source;
  process.env.ASTRA_AUTOMATION_ENABLED = "true";

  try {
    await run(source);
  } finally {
    if (previousFile === undefined) delete process.env.ASTRA_AUTOMATION_FILE;
    else process.env.ASTRA_AUTOMATION_FILE = previousFile;

    if (previousEnabled === undefined) {
      delete process.env.ASTRA_AUTOMATION_ENABLED;
    } else {
      process.env.ASTRA_AUTOMATION_ENABLED = previousEnabled;
    }

    await rm(root, { recursive: true, force: true });
  }
}

test("Phase 14B private store starts empty and round-trips validated jobs", async () => {
  await withPrivateStore(async (source) => {
    const empty = await loadAutomationStore();
    assert.equal(empty.available, true);
    assert.deepEqual(empty.automations, []);
    assert.equal(getAutomationStorePath(), source);

    const saved = await saveAutomationStore([
      fixture(),
      fixture({
        id: "fixture-external",
        title: "Approved external follow-up",
        requiredPermissionLevel: 3,
        schedule: {
          kind: "once",
          runAt: "2026-09-21T09:00:00.000Z",
        },
      }),
    ]);
    assert.equal(saved.count, 2);

    const loaded = await loadAutomationStore();
    assert.equal(loaded.available, true);
    assert.equal(loaded.automations.length, 2);
    assert.equal(loaded.automations[0].id, "fixture-daily-summary");
    assert.equal(loaded.automations[1].requiredPermissionLevel, 3);
  });
});

test("Phase 14B malformed store fails closed with zero runnable definitions", async () => {
  await withPrivateStore(async (source) => {
    await writeFile(source, "{ not-json", {
      encoding: "utf8",
      flag: "w",
    });

    const loaded = await loadAutomationStore();
    assert.equal(loaded.available, false);
    assert.deepEqual(loaded.automations, []);
    assert.match(loaded.detail, /could not be loaded safely/i);
  });
});

test("Phase 14B store rejects duplicate IDs and Level 4 definitions", () => {
  assert.throws(
    () => normalizeAutomationDefinitions([fixture(), fixture()]),
    /duplicate automation id/i,
  );

  assert.throws(
    () =>
      normalizeAutomationDefinitions([
        fixture({ requiredPermissionLevel: 4 }),
      ]),
    /Level-4/i,
  );
});

test("Phase 14B disabled automation store cannot be read or written", async () => {
  await withPrivateStore(async () => {
    process.env.ASTRA_AUTOMATION_ENABLED = "false";

    const loaded = await loadAutomationStore();
    assert.equal(loaded.enabled, false);
    assert.equal(loaded.available, false);
    assert.deepEqual(loaded.automations, []);

    await assert.rejects(
      () => saveAutomationStore([fixture()]),
      /disabled/i,
    );
  });
});

test("Phase 14B store rejects structurally invalid definitions before persistence", async () => {
  await withPrivateStore(async () => {
    const invalid = {
      ...fixture(),
      status: "mystery",
    } as unknown;

    assert.throws(
      () => normalizeAutomationDefinitions([invalid]),
      /status is invalid/i,
    );
  });
});
