import { execFileSync } from "node:child_process";

export type CleanRepositorySnapshot = {
  commit: string;
  workingTreeClean: true;
};

function runGit(args: readonly string[]) {
  return execFileSync(
    "git",
    [...args],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  ).trim();
}

export function cleanRepositorySnapshot(): CleanRepositorySnapshot {
  const commit = runGit(["rev-parse", "HEAD"]);

  if (!/^[0-9a-f]{40}$/i.test(commit)) {
    throw new Error(
      "Cannot capture release evidence without a valid Git HEAD commit.",
    );
  }

  const status = runGit([
    "status",
    "--porcelain",
    "--untracked-files=normal",
  ]);

  if (status.length > 0) {
    throw new Error(
      "Release evidence requires a clean Git working tree.",
    );
  }

  return {
    commit: commit.toLowerCase(),
    workingTreeClean: true,
  };
}

export function assertSameCleanRepositorySnapshot(
  expected: CleanRepositorySnapshot,
) {
  const current = cleanRepositorySnapshot();

  if (current.commit !== expected.commit) {
    throw new Error(
      "Git HEAD changed while release evidence was being captured.",
    );
  }

  return current;
}
