import { execFileSync } from "node:child_process";

function buildRepositoryIdentity() {
  try {
    const commit = execFileSync(
      "git",
      ["rev-parse", "HEAD"],
      { encoding: "utf8" },
    ).trim().toLowerCase();
    const status = execFileSync(
      "git",
      ["status", "--porcelain", "--untracked-files=normal"],
      { encoding: "utf8" },
    ).trim();

    return {
      commit: /^[0-9a-f]{40}$/.test(commit) ? commit : "unknown",
      workingTreeClean: status.length === 0,
    };
  } catch {
    return {
      commit: "unknown",
      workingTreeClean: false,
    };
  }
}

const buildIdentity = buildRepositoryIdentity();

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    ASTRA_BUILD_COMMIT: buildIdentity.commit,
    ASTRA_BUILD_WORKING_TREE_CLEAN:
      buildIdentity.workingTreeClean ? "true" : "false",
  },
};

export default nextConfig;
