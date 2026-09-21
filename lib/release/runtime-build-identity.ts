export type AstraRuntimeBuildIdentity = {
  commit: string;
  workingTreeClean: boolean;
};

export function runtimeBuildIdentity(): AstraRuntimeBuildIdentity {
  const commit = (process.env.ASTRA_BUILD_COMMIT ?? "")
    .trim()
    .toLowerCase();
  return {
    commit: /^[0-9a-f]{40}$/.test(commit)
      ? commit
      : "unknown",
    workingTreeClean:
      process.env.ASTRA_BUILD_WORKING_TREE_CLEAN === "true",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

export function assertRuntimeBuildIdentity(
  payload: unknown,
  expectedCommit: string,
) {
  if (!/^[0-9a-f]{40}$/i.test(expectedCommit)) {
    throw new Error("Expected runtime commit is invalid.");
  }
  if (!isRecord(payload) || !isRecord(payload.runtime)) {
    throw new Error("ASTRA runtime build identity is missing.");
  }

  const commit = payload.runtime.commit;
  if (
    typeof commit !== "string" ||
    !/^[0-9a-f]{40}$/i.test(commit) ||
    commit.toLowerCase() !== expectedCommit.toLowerCase() ||
    payload.runtime.workingTreeClean !== true
  ) {
    throw new Error(
      "Running ASTRA build does not match the clean repository commit.",
    );
  }

  return {
    commit: commit.toLowerCase(),
    workingTreeClean: true as const,
  };
}

export async function verifyRuntimeBuildIdentity(
  baseUrl: string,
  expectedCommit: string,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException(
          "ASTRA runtime build identity request timed out.",
          "TimeoutError",
        ),
      ),
    timeoutMs,
  );

  try {
    const response = await fetch(baseUrl + "/api/agent", {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-astra-client": "1",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `ASTRA runtime build identity returned HTTP ${response.status}.`,
      );
    }
    return assertRuntimeBuildIdentity(
      await response.json(),
      expectedCommit,
    );
  } finally {
    clearTimeout(timer);
  }
}
