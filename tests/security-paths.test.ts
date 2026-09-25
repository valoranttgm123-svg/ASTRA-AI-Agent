import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import type { AstraProjectRecord } from "../lib/projects/contracts";
import {
  resolveExistingProjectFile,
  resolveProjectWorkspace,
  resolveWritableProjectFile,
} from "../lib/projects/paths";

function normalizePath(p: string): string {
  return path.resolve(p);
}

let root = "";
let workspace = "";
let outside = "";

function project(): AstraProjectRecord {
  return {
    id: "security-fixture",
    name: "Security Fixture",
    aliases: [],
    workspace,
    repositories: [],
    docs: [],
    memoryNamespace: "security-fixture",
    goals: [],
    status: "active",
    openTasks: [],
    importantFiles: [],
    integrations: [],
  };
}

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

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "astra-phase15a-"));
  workspace = path.join(root, "workspace");
  outside = path.join(root, "outside");
  await mkdir(workspace, { recursive: true });
  await mkdir(outside, { recursive: true });
  await mkdir(path.join(workspace, "docs"), { recursive: true });
  await writeFile(path.join(workspace, "docs", "inside.md"), "safe");
  await writeFile(path.join(outside, "outside.md"), "outside");
});

after(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

test("Phase 15A resolves only a real registered workspace directory", async () => {
  const resolved = await resolveProjectWorkspace(project());
  assert.ok(resolved);
  assert.equal(normalizePath(resolved), normalizePath(workspace));

  const missing = project();
  missing.workspace = path.join(root, "missing");
  assert.equal(await resolveProjectWorkspace(missing), null);

  const fileWorkspace = project();
  fileWorkspace.workspace = path.join(workspace, "docs", "inside.md");
  assert.equal(await resolveProjectWorkspace(fileWorkspace), null);
});

test("Phase 15A accepts a normal registered text file and safe new write target", async () => {
  const existing = await resolveExistingProjectFile(project(), "docs/inside.md");
  assert.ok(existing);
  assert.equal(existing.relative, "docs/inside.md");
  assert.equal(normalizePath(existing.workspace), normalizePath(workspace));

  const writable = await resolveWritableProjectFile(project(), "docs/new.md");
  assert.ok(writable);
  assert.equal(writable.relative, "docs/new.md");
  assert.equal(normalizePath(writable.workspace), normalizePath(workspace));
  assert.equal(normalizePath(writable.absolute), normalizePath(path.join(workspace, "docs", "new.md")));
});

test("Phase 15A rejects traversal and absolute paths outside the workspace", async () => {
  assert.equal(
    await resolveExistingProjectFile(project(), "../outside/outside.md"),
    null,
  );
  assert.equal(
    await resolveWritableProjectFile(project(), "../outside/new.md"),
    null,
  );
  assert.equal(
    await resolveExistingProjectFile(project(), path.join(outside, "outside.md")),
    null,
  );
  assert.equal(
    await resolveWritableProjectFile(project(), path.join(outside, "new.md")),
    null,
  );
});

test("Phase 15A rejects sensitive and disallowed project paths", async () => {
  await mkdir(path.join(workspace, "secrets"), { recursive: true });
  await writeFile(path.join(workspace, ".env.local"), "TOKEN=fake");
  await writeFile(path.join(workspace, "secrets", "auth.json"), "{}");
  await writeFile(path.join(workspace, "docs", "private.pem"), "fake");
  await writeFile(path.join(workspace, "docs", "image.png"), "fake");

  for (const requested of [
    ".env.local",
    "secrets/auth.json",
    "docs/private.pem",
    "docs/image.png",
  ]) {
    assert.equal(await resolveExistingProjectFile(project(), requested), null);
    assert.equal(await resolveWritableProjectFile(project(), requested), null);
  }
});

test("Phase 15A rejects a read symlink that resolves outside the workspace", async (t) => {
  const link = path.join(workspace, "docs", "outside-link.md");
  const created = await createSymlink(path.join(outside, "outside.md"), link, "file");
  if (!created) {
    t.skip("symlinks are unavailable in this environment");
    return;
  }

  assert.equal(
    await resolveExistingProjectFile(project(), "docs/outside-link.md"),
    null,
  );
});

test("Phase 15A rejects writes through a symlinked parent outside the workspace", async (t) => {
  const linkDir = path.join(workspace, "external");
  const created = await createSymlink(outside, linkDir, "dir");
  if (!created) {
    t.skip("directory symlinks are unavailable in this environment");
    return;
  }

  assert.equal(
    await resolveWritableProjectFile(project(), "external/escaped.md"),
    null,
  );
});

test("Phase 15A rejects existing writable symlinks, including dangling symlinks", async (t) => {
  const existingLink = path.join(workspace, "docs", "existing-link.md");
  const danglingLink = path.join(workspace, "docs", "dangling-link.md");

  const existingCreated = await createSymlink(
    path.join(workspace, "docs", "inside.md"),
    existingLink,
    "file",
  );
  const danglingCreated = await createSymlink(
    path.join(outside, "not-created-yet.md"),
    danglingLink,
    "file",
  );

  if (!existingCreated || !danglingCreated) {
    t.skip("file symlinks are unavailable in this environment");
    return;
  }

  assert.equal(
    await resolveWritableProjectFile(project(), "docs/existing-link.md"),
    null,
  );
  assert.equal(
    await resolveWritableProjectFile(project(), "docs/dangling-link.md"),
    null,
  );
});
