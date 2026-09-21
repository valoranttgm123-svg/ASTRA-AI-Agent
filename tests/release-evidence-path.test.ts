import assert from "node:assert/strict";
import {
  realpathSync,
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
  assertExistingPrivateAstraEvidenceFile,
  assertPrivateAstraEvidencePath,
} from "../lib/release/private-output";

test("release evidence input must resolve to a real file inside .astra", async (t) => {
  const privateRoot = path.resolve(".astra");
  await mkdir(privateRoot, {
    recursive: true,
  });

  const insideDir = await mkdtemp(
    path.join(
      privateRoot,
      "release-input-test-",
    ),
  );
  const outsideDir = await mkdtemp(
    path.join(
      os.tmpdir(),
      "astra-release-outside-",
    ),
  );

  try {
    const insideFile = path.join(
      insideDir,
      "evidence.json",
    );
    await writeFile(
      insideFile,
      "{}\n",
      "utf8",
    );

    assert.equal(
      assertExistingPrivateAstraEvidenceFile(
        insideFile,
      ),
      realpathSync(insideFile),
    );

    assert.throws(
      () =>
        assertExistingPrivateAstraEvidenceFile(
          insideDir,
        ),
      /regular file/,
    );

    const outsideFile = path.join(
      outsideDir,
      "outside.json",
    );
    await writeFile(
      outsideFile,
      "{}\n",
      "utf8",
    );

    assert.throws(
      () =>
        assertPrivateAstraEvidencePath(
          outsideFile,
        ),
      /stay inside \.astra/,
    );

    const linkPath = path.join(
      insideDir,
      "escape.json",
    );

    try {
      await symlink(
        outsideFile,
        linkPath,
        "file",
      );
    } catch (error) {
      const code =
        error &&
        typeof error === "object" &&
        "code" in error
          ? String(
              (error as { code?: unknown }).code,
            )
          : "";

      if (
        code === "EPERM" ||
        code === "EACCES" ||
        code === "ENOTSUP"
      ) {
        t.diagnostic(
          "Symlink creation unavailable; escape assertion skipped on this platform.",
        );
        return;
      }
      throw error;
    }

    assert.throws(
      () =>
        assertExistingPrivateAstraEvidenceFile(
          linkPath,
        ),
      /resolved outside \.astra/,
    );
  } finally {
    await rm(insideDir, {
      recursive: true,
      force: true,
    });
    await rm(outsideDir, {
      recursive: true,
      force: true,
    });
  }
});
