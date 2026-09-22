import assert from "node:assert/strict";
import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import {
  loadNvidiaSkillCatalog,
  mergeNvidiaSkillCatalogState,
  refreshNvidiaSkillCatalog,
  normalizeNvidiaSkillCatalog,
  saveNvidiaSkillCatalog,
} from "../lib/nvidia/skill-catalog-cache";
import {
  loadNvidiaSkillState,
  normalizeNvidiaSkillState,
  planNvidiaSkillMutation,
  saveNvidiaSkillState,
} from "../lib/nvidia/skill-state";

const originalCatalogPath = process.env.ASTRA_NVIDIA_SKILL_CATALOG_FILE;
const originalStatePath = process.env.ASTRA_NVIDIA_SKILL_REGISTRY_FILE;

afterEach(() => {
  if (originalCatalogPath === undefined) {
    delete process.env.ASTRA_NVIDIA_SKILL_CATALOG_FILE;
  } else {
    process.env.ASTRA_NVIDIA_SKILL_CATALOG_FILE = originalCatalogPath;
  }
  if (originalStatePath === undefined) {
    delete process.env.ASTRA_NVIDIA_SKILL_REGISTRY_FILE;
  } else {
    process.env.ASTRA_NVIDIA_SKILL_REGISTRY_FILE = originalStatePath;
  }
});

function sampleCatalog() {
  return {
    schemaVersion: 1 as const,
    source: "nvidia-build-official",
    capturedAt: "2026-09-22T00:00:00.000Z",
    skills: [
      {
        id: "aiq-research",
        title: "AI-Q Research",
        categories: ["research"],
      },
      {
        id: "nemo-retriever",
        title: "NeMo Retriever",
        categories: ["rag"],
      },
    ],
  };
}

test("NVIDIA catalog snapshot normalizes and rejects duplicate ids", () => {
  const normalized = normalizeNvidiaSkillCatalog(sampleCatalog());
  assert.equal(normalized.skills.length, 2);

  assert.throws(
    () =>
      normalizeNvidiaSkillCatalog({
        ...sampleCatalog(),
        skills: [
          { id: "same", categories: [] },
          { id: "SAME", categories: [] },
        ],
      }),
    /Duplicate NVIDIA catalog skill id/i,
  );
});

test("NVIDIA skill state validates truth states and installation timestamps", () => {
  assert.throws(
    () =>
      normalizeNvidiaSkillState([
        {
          id: "aiq-research",
          state: "installed",
          source: "nvidia-build-official",
          updatedAt: "2026-09-22T00:00:00.000Z",
        },
      ]),
    /requires installedAt/i,
  );

  const normalized = normalizeNvidiaSkillState([
    {
      id: "aiq-research",
      state: "installed",
      source: "nvidia-build-official",
      installedAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-22T00:00:00.000Z",
    },
  ]);
  assert.equal(normalized[0].state, "installed");
});

test("catalog and installed-state stores use private bounded files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-nvidia-skill-"));
  const catalogFile = path.join(root, "catalog.json");
  const stateFile = path.join(root, "state.json");
  process.env.ASTRA_NVIDIA_SKILL_CATALOG_FILE = catalogFile;
  process.env.ASTRA_NVIDIA_SKILL_REGISTRY_FILE = stateFile;

  await saveNvidiaSkillCatalog(sampleCatalog());
  await saveNvidiaSkillState([
    {
      id: "aiq-research",
      state: "installed",
      source: "nvidia-build-official",
      installedAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-22T00:00:00.000Z",
    },
  ]);

  const catalog = await loadNvidiaSkillCatalog();
  const state = await loadNvidiaSkillState();
  assert.equal(catalog.available, true);
  assert.equal(catalog.snapshot?.skills.length, 2);
  assert.equal(state.available, true);
  assert.equal(state.skills[0].state, "installed");

  const raw = await readFile(stateFile, "utf8");
  assert.match(raw, /aiq-research/);
});

test("catalog merge reports truth state without inventing installed state", () => {
  const snapshot = normalizeNvidiaSkillCatalog(sampleCatalog());
  const view = mergeNvidiaSkillCatalogState(snapshot, [
    {
      id: "aiq-research",
      state: "disabled",
      source: "nvidia-build-official",
      installedAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-22T00:00:00.000Z",
      detail: "disabled for test",
    },
  ]);

  assert.equal(view[0].state, "disabled");
  assert.equal(view[1].state, "available");
});

test("skill mutations are dry-run Level-2 plans and incompatible install fails closed", () => {
  const install = planNvidiaSkillMutation({
    skillId: "aiq-research",
    action: "install",
    currentState: "available",
  });
  assert.equal(install.allowed, true);
  assert.equal(install.requiredPermissionLevel, 2);
  assert.equal(install.writesLocalState, true);
  assert.equal(install.targetState, "installed");

  const blocked = planNvidiaSkillMutation({
    skillId: "aiq-research",
    action: "install",
    currentState: "incompatible",
  });
  assert.equal(blocked.allowed, false);
});


test("catalog refresh is provider-neutral, persisted, and cancellable", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-nvidia-refresh-"));
  const catalogFile = path.join(root, "catalog.json");
  process.env.ASTRA_NVIDIA_SKILL_CATALOG_FILE = catalogFile;

  const result = await refreshNvidiaSkillCatalog({
    provider: {
      id: "fixture-provider",
      discover: async () => sampleCatalog(),
    },
  });

  assert.equal(result.provider, "fixture-provider");
  assert.equal(result.count, 2);

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    refreshNvidiaSkillCatalog({
      provider: {
        id: "fixture-provider",
        discover: async () => sampleCatalog(),
      },
      signal: controller.signal,
    }),
    /aborted/i,
  );
});


test("catalog and state stores reject symbolic-link targets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-nvidia-link-"));
  const target = path.join(root, "target.json");
  const linked = path.join(root, "linked.json");
  await writeFile(target, JSON.stringify(sampleCatalog()), "utf8");
  await symlink(target, linked);
  process.env.ASTRA_NVIDIA_SKILL_CATALOG_FILE = linked;

  const catalog = await loadNvidiaSkillCatalog();
  assert.equal(catalog.available, false);
  assert.match(catalog.detail, /symbolic link/i);
});
