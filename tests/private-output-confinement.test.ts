import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  prepareRuntimePerformancePath,
  resolveRuntimePerformancePath,
} from "../lib/performance/private-output";
import {
  preparePrivateAstraOutputFile,
} from "../lib/security/private-output";

function symlinkUnavailable(
  error: unknown,
) {
  const code =
    error &&
    typeof error === "object" &&
    "code" in error
      ? String(
          (error as { code?: unknown })
            .code,
        )
      : "";

  return (
    code === "EPERM" ||
    code === "EACCES" ||
    code === "ENOTSUP"
  );
}

test("runtime performance output is confined to .astra/performance", () => {
  assert.throws(
    () =>
      resolveRuntimePerformancePath(
        path.resolve(
          "docs",
          "runtime-evidence.json",
        ),
      ),
    /must stay inside/i,
  );

  const safe =
    prepareRuntimePerformancePath(
      path.resolve(
        ".astra",
        "performance",
        "runtime-test.json",
      ),
    );
  assert.equal(
    safe,
    path.resolve(
      ".astra",
      "performance",
      "runtime-test.json",
    ),
  );
});

test("private output rejects symlinked directories and output files", async (t) => {
  const privateRoot =
    path.resolve(".astra");
  await mkdir(privateRoot, {
    recursive: true,
  });

  const testRoot = await mkdtemp(
    path.join(
      privateRoot,
      "private-output-test-",
    ),
  );
  const outside = await mkdtemp(
    path.join(
      os.tmpdir(),
      "astra-private-output-outside-",
    ),
  );

  try {
    const linkedDirectory =
      path.join(
        testRoot,
        "linked-dir",
      );

    try {
      await symlink(
        outside,
        linkedDirectory,
        "dir",
      );
    } catch (error) {
      if (symlinkUnavailable(error)) {
        t.diagnostic(
          "Directory symlink creation unavailable on this platform.",
        );
        return;
      }
      throw error;
    }

    assert.throws(
      () =>
        preparePrivateAstraOutputFile(
          path.join(
            linkedDirectory,
            "escape.json",
          ),
          testRoot,
        ),
      /symbolic link/,
    );

    const safeDir = path.join(
      testRoot,
      "safe",
    );
    await mkdir(safeDir);

    const outsideFile = path.join(
      outside,
      "outside.json",
    );
    await writeFile(
      outsideFile,
      "{}\n",
      "utf8",
    );

    const linkedFile = path.join(
      safeDir,
      "linked.json",
    );
    try {
      await symlink(
        outsideFile,
        linkedFile,
        "file",
      );
    } catch (error) {
      if (symlinkUnavailable(error)) {
        t.diagnostic(
          "File symlink creation unavailable on this platform.",
        );
        return;
      }
      throw error;
    }

    assert.throws(
      () =>
        preparePrivateAstraOutputFile(
          linkedFile,
          testRoot,
        ),
      /regular file|symbolic link/,
    );
  } finally {
    await rm(testRoot, {
      recursive: true,
      force: true,
    });
    await rm(outside, {
      recursive: true,
      force: true,
    });
  }
});

test("release and validation evidence writers use private output preparation", () => {
  const sources = [
    "scripts/release/repository-gate.ts",
    "scripts/release/core-report.ts",
    "scripts/release/record-manual-gate.ts",
    "scripts/release/record-release-context.ts",
    "scripts/release/self-check.ts",
    "scripts/validation/full-system-preflight.ts",
    "scripts/performance/measure-runtime.ts",
    "scripts/release/browser-performance-bundle.ts",
    "app/api/performance/browser-evidence/route.ts",
  ].map((file) =>
    readFileSync(
      path.resolve(file),
      "utf8",
    ),
  );

  for (const source of sources) {
    assert.match(
      source,
      /prepare(?:Release|Readiness|Validation|Runtime|Browser)/,
    );
  }
});
