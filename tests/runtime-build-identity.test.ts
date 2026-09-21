import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertRuntimeBuildIdentity,
} from "../lib/release/runtime-build-identity";

const COMMIT = "a".repeat(40);

test("runtime build identity accepts only the expected clean build", () => {
  assert.deepEqual(
    assertRuntimeBuildIdentity(
      {
        runtime: {
          commit: COMMIT,
          workingTreeClean: true,
        },
      },
      COMMIT,
    ),
    {
      commit: COMMIT,
      workingTreeClean: true,
    },
  );
});

test("runtime build identity rejects stale, dirty, and missing attestations", () => {
  for (const payload of [
    {},
    {
      runtime: {
        commit: "b".repeat(40),
        workingTreeClean: true,
      },
    },
    {
      runtime: {
        commit: COMMIT,
        workingTreeClean: false,
      },
    },
  ]) {
    assert.throws(
      () => assertRuntimeBuildIdentity(payload, COMMIT),
      /runtime build identity|does not match/i,
    );
  }
});
