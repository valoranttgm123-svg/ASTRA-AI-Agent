import { readFile } from "node:fs/promises";
import type { AstraProjectRecord } from "@/lib/projects/contracts";
import {
  resolveExistingProjectFile,
  resolveProjectWorkspace,
} from "@/lib/projects/paths";
import { getProjectRegistry } from "@/lib/projects/registry";
import type {
  AstraToolDefinition,
  AstraToolHandler,
} from "./contracts";
import { runBoundedProcess } from "./process";
import { npmScriptCommand } from "./npm-command";

async function registeredProject(
  projectId: string,
): Promise<AstraProjectRecord | null> {
  const registry = await getProjectRegistry();
  if (!registry.available) return null;
  return (
    registry.projects.find(
      (project) => project.id.toLowerCase() === projectId.toLowerCase(),
    ) ?? null
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(input: Record<string, unknown>, key: string) {
  return typeof input[key] === "string" ? input[key].trim() : "";
}

async function projectAndWorkspace(projectId: string) {
  const project = await registeredProject(projectId);
  if (!project) return null;
  const workspace = await resolveProjectWorkspace(project);
  if (!workspace) return null;
  return { project, workspace };
}

async function git(
  workspace: string,
  args: readonly string[],
  signal: AbortSignal,
) {
  return runBoundedProcess({
    command: "git",
    args,
    cwd: workspace,
    signal,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
    },
  });
}

function failureDetail(command: string, stderr: string, stdout: string) {
  const text = (stderr || stdout).trim().slice(0, 3000);
  return command + " failed" + (text ? ": " + text : ".");
}

export const LOCAL_GIT_TOOL_DEFINITIONS: readonly AstraToolDefinition[] = [
  {
    id: "project.git.status",
    name: "Project Git Status",
    category: "github",
    description:
      "Read the local Git branch and working-tree status for a registered project workspace.",
    permissionLevel: 1,
    sideEffect: "read",
    timeoutMs: 8_000,
    supportsCancellation: true,
    provider: "native-git",
    availability: "READY",
  },
  {
    id: "project.git.diff-file",
    name: "Project Git Diff File",
    category: "github",
    description:
      "Read the Git diff for one explicit safe file inside a registered project workspace.",
    permissionLevel: 1,
    sideEffect: "read",
    timeoutMs: 8_000,
    supportsCancellation: true,
    provider: "native-git",
    availability: "READY",
  },
  {
    id: "project.git.create-branch",
    name: "Project Git Create Branch",
    category: "github",
    description:
      "Create and switch to one validated local Git branch inside a registered project workspace.",
    permissionLevel: 2,
    sideEffect: "local_write",
    timeoutMs: 8_000,
    supportsCancellation: true,
    provider: "native-git",
    availability: "READY",
  },
  {
    id: "project.git.stage-files",
    name: "Project Git Stage Files",
    category: "github",
    description:
      "Stage only explicitly named safe files inside a registered project workspace.",
    permissionLevel: 2,
    sideEffect: "local_write",
    timeoutMs: 8_000,
    supportsCancellation: true,
    provider: "native-git",
    availability: "READY",
  },
  {
    id: "project.git.commit",
    name: "Project Git Commit",
    category: "github",
    description:
      "Commit only the currently staged safe project files after revalidating the staged set.",
    permissionLevel: 2,
    sideEffect: "local_write",
    timeoutMs: 15_000,
    supportsCancellation: true,
    provider: "native-git",
    availability: "READY",
  },
  {
    id: "project.verify.npm-script",
    name: "Project NPM Verification",
    category: "shell",
    description:
      "Run one allowlisted npm verification script (test, typecheck, lint, build) inside a registered project workspace.",
    permissionLevel: 2,
    sideEffect: "local_write",
    timeoutMs: 120_000,
    supportsCancellation: true,
    provider: "native-npm-verifier",
    availability: "READY",
  },
  {
    id: "github.push",
    name: "GitHub Push",
    category: "github",
    description:
      "Push an approved local branch to GitHub through a configured authenticated provider.",
    permissionLevel: 3,
    sideEffect: "external_write",
    timeoutMs: 60_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
  {
    id: "github.pull-request.open",
    name: "GitHub Open Pull Request",
    category: "github",
    description:
      "Open a pull request through a configured authenticated GitHub provider.",
    permissionLevel: 3,
    sideEffect: "external_write",
    timeoutMs: 60_000,
    supportsCancellation: true,
    availability: "NOT_CONFIGURED",
  },
];

const gitStatus: AstraToolHandler = async (input, context) => {
  if (!isObject(input)) {
    return { status: "failed", detail: "Input must be an object.", verified: false };
  }
  const projectId = stringField(input, "projectId");
  const target = await projectAndWorkspace(projectId);
  if (!target) {
    return { status: "failed", detail: "Registered Git project workspace is unavailable.", verified: false };
  }

  const result = await git(
    target.workspace,
    ["status", "--short", "--branch", "--untracked-files=normal"],
    context.signal,
  );
  if (result.exitCode !== 0) {
    return {
      status: "failed",
      detail: failureDetail("git status", result.stderr, result.stdout),
      verified: false,
      provider: context.definition.provider,
    };
  }

  return {
    status: "completed",
    detail: "Read local Git status.",
    verified: true,
    provider: context.definition.provider,
    output: {
      project: { id: target.project.id, name: target.project.name },
      status: result.stdout.trim(),
    },
  };
};

const gitDiffFile: AstraToolHandler = async (input, context) => {
  if (!isObject(input)) {
    return { status: "failed", detail: "Input must be an object.", verified: false };
  }

  const projectId = stringField(input, "projectId");
  const requestedPath = stringField(input, "path");
  const project = await registeredProject(projectId);
  if (!project) {
    return { status: "failed", detail: "Registered project not found.", verified: false };
  }

  const resolved = await resolveExistingProjectFile(project, requestedPath);
  if (!resolved) {
    return {
      status: "failed",
      detail: "Diff path is unavailable, outside the workspace, sensitive, or unsupported.",
      verified: false,
    };
  }

  const result = await git(
    resolved.workspace,
    ["diff", "--no-ext-diff", "--", resolved.relative],
    context.signal,
  );
  if (result.exitCode !== 0) {
    return {
      status: "failed",
      detail: failureDetail("git diff", result.stderr, result.stdout),
      verified: false,
      provider: context.definition.provider,
    };
  }

  return {
    status: "completed",
    detail: "Read bounded Git diff for " + resolved.relative + ".",
    verified: true,
    provider: context.definition.provider,
    output: {
      path: resolved.relative,
      diff: result.stdout.slice(0, 60_000),
      truncated: result.stdout.length > 60_000,
    },
  };
};

function validBranchName(value: string) {
  return (
    value.length >= 1 &&
    value.length <= 160 &&
    !value.startsWith("-") &&
    !value.includes("..") &&
    !value.includes("@{") &&
    !value.includes("//") &&
    !/[\s~^:?*\[\\]/.test(value)
  );
}

const gitCreateBranch: AstraToolHandler = async (input, context) => {
  if (!isObject(input)) {
    return { status: "failed", detail: "Input must be an object.", verified: false };
  }

  const projectId = stringField(input, "projectId");
  const branch = stringField(input, "branch");
  if (!validBranchName(branch)) {
    return { status: "failed", detail: "Branch name is invalid.", verified: false };
  }

  const target = await projectAndWorkspace(projectId);
  if (!target) {
    return { status: "failed", detail: "Registered Git project workspace is unavailable.", verified: false };
  }

  const check = await git(
    target.workspace,
    ["check-ref-format", "--branch", branch],
    context.signal,
  );
  if (check.exitCode !== 0) {
    return { status: "failed", detail: "Git rejected the requested branch name.", verified: false };
  }

  const create = await git(
    target.workspace,
    ["switch", "-c", branch],
    context.signal,
  );
  if (create.exitCode !== 0) {
    return {
      status: "failed",
      detail: failureDetail("git switch -c", create.stderr, create.stdout),
      verified: false,
      provider: context.definition.provider,
    };
  }

  const verify = await git(
    target.workspace,
    ["branch", "--show-current"],
    context.signal,
  );
  if (verify.exitCode !== 0 || verify.stdout.trim() !== branch) {
    return { status: "failed", detail: "Branch creation could not be verified.", verified: false };
  }

  return {
    status: "completed",
    detail: "Created and verified local branch " + branch + ".",
    verified: true,
    provider: context.definition.provider,
    output: { branch },
  };
};

const gitStageFiles: AstraToolHandler = async (input, context) => {
  if (!isObject(input)) {
    return { status: "failed", detail: "Input must be an object.", verified: false };
  }

  const projectId = stringField(input, "projectId");
  const paths = Array.isArray(input.paths)
    ? input.paths
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];

  if (paths.length === 0) {
    return { status: "failed", detail: "At least one explicit path is required.", verified: false };
  }

  const project = await registeredProject(projectId);
  if (!project) {
    return { status: "failed", detail: "Registered project not found.", verified: false };
  }

  const resolved = [];
  for (const requestedPath of paths) {
    context.signal.throwIfAborted();
    const file = await resolveExistingProjectFile(project, requestedPath);
    if (!file) {
      return {
        status: "failed",
        detail: "One requested stage path is unavailable or unsafe: " + requestedPath,
        verified: false,
      };
    }
    resolved.push(file);
  }

  const workspace = resolved[0].workspace;
  if (resolved.some((file) => file.workspace !== workspace)) {
    return { status: "failed", detail: "Stage paths resolved to inconsistent workspaces.", verified: false };
  }

  const relativePaths = [...new Set(resolved.map((file) => file.relative))];
  const add = await git(
    workspace,
    ["add", "--", ...relativePaths],
    context.signal,
  );
  if (add.exitCode !== 0) {
    return {
      status: "failed",
      detail: failureDetail("git add", add.stderr, add.stdout),
      verified: false,
      provider: context.definition.provider,
    };
  }

  const staged = await git(
    workspace,
    ["diff", "--cached", "--name-only", "--"],
    context.signal,
  );
  if (staged.exitCode !== 0) {
    return { status: "failed", detail: "Could not verify staged files.", verified: false };
  }

  const stagedNames = new Set(
    staged.stdout
      .split(/\r?\n/)
      .map((item) => item.trim().replace(/\\/g, "/"))
      .filter(Boolean),
  );
  if (!relativePaths.every((item) => stagedNames.has(item))) {
    return { status: "failed", detail: "Not all requested files were verified as staged.", verified: false };
  }

  return {
    status: "completed",
    detail: "Staged " + relativePaths.length + " explicit safe file(s).",
    verified: true,
    provider: context.definition.provider,
    output: { paths: relativePaths },
  };
};

const gitCommit: AstraToolHandler = async (input, context) => {
  if (!isObject(input)) {
    return { status: "failed", detail: "Input must be an object.", verified: false };
  }

  const projectId = stringField(input, "projectId");
  const message = stringField(input, "message").replace(/[\r\n\0]/g, " ").slice(0, 200);
  if (!message) {
    return { status: "failed", detail: "Commit message is required.", verified: false };
  }

  const target = await projectAndWorkspace(projectId);
  if (!target) {
    return { status: "failed", detail: "Registered Git project workspace is unavailable.", verified: false };
  }

  const staged = await git(
    target.workspace,
    ["diff", "--cached", "--name-only", "--"],
    context.signal,
  );
  const stagedPaths = staged.stdout
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (staged.exitCode !== 0 || stagedPaths.length === 0) {
    return { status: "failed", detail: "No staged files are available to commit.", verified: false };
  }

  for (const stagedPath of stagedPaths) {
    context.signal.throwIfAborted();
    const safe = await resolveExistingProjectFile(target.project, stagedPath);
    if (!safe) {
      return {
        status: "blocked",
        detail:
          "Commit blocked because the staged set contains a deleted, sensitive, unsupported, or out-of-workspace path: " +
          stagedPath,
        verified: false,
      };
    }
  }

  const before = await git(
    target.workspace,
    ["rev-parse", "HEAD"],
    context.signal,
  );
  if (before.exitCode !== 0) {
    return {
      status: "failed",
      detail: "ASTRA local commit currently requires an existing Git HEAD.",
      verified: false,
    };
  }

  const commit = await git(
    target.workspace,
    ["commit", "-m", message],
    context.signal,
  );
  if (commit.exitCode !== 0) {
    return {
      status: "failed",
      detail: failureDetail("git commit", commit.stderr, commit.stdout),
      verified: false,
      provider: context.definition.provider,
    };
  }

  const after = await git(
    target.workspace,
    ["rev-parse", "HEAD"],
    context.signal,
  );
  if (
    after.exitCode !== 0 ||
    !after.stdout.trim() ||
    after.stdout.trim() === before.stdout.trim()
  ) {
    return { status: "failed", detail: "Commit could not be verified by a new HEAD.", verified: false };
  }

  return {
    status: "completed",
    detail: "Created and verified local commit " + after.stdout.trim().slice(0, 12) + ".",
    verified: true,
    provider: context.definition.provider,
    output: {
      commit: after.stdout.trim(),
      files: stagedPaths,
      message,
    },
  };
};

const ALLOWED_NPM_SCRIPTS = new Set(["test", "typecheck", "lint", "build"]);

const npmVerify: AstraToolHandler = async (input, context) => {
  if (!isObject(input)) {
    return { status: "failed", detail: "Input must be an object.", verified: false };
  }

  const projectId = stringField(input, "projectId");
  const script = stringField(input, "script").toLowerCase();
  if (!ALLOWED_NPM_SCRIPTS.has(script)) {
    return {
      status: "failed",
      detail: "Only test, typecheck, lint, and build verification scripts are allowlisted.",
      verified: false,
    };
  }

  const target = await projectAndWorkspace(projectId);
  if (!target) {
    return { status: "failed", detail: "Registered project workspace is unavailable.", verified: false };
  }

  const packageFile = await resolveExistingProjectFile(target.project, "package.json");
  if (!packageFile) {
    return { status: "failed", detail: "Registered project has no safe package.json.", verified: false };
  }

  let parsed: { scripts?: Record<string, string> };
  try {
    parsed = JSON.parse(await readFile(packageFile.absolute, "utf8")) as {
      scripts?: Record<string, string>;
    };
  } catch {
    return { status: "failed", detail: "package.json could not be parsed.", verified: false };
  }

  if (!parsed.scripts?.[script]) {
    return {
      status: "failed",
      detail: "The requested allowlisted npm script is not defined by the project.",
      verified: false,
    };
  }

  const invocation = await npmScriptCommand(script);
  const result = await runBoundedProcess({
    ...invocation,
    cwd: target.workspace,
    signal: context.signal,
    env: {
      ...process.env,
      CI: "1",
    },
  });

  if (result.exitCode !== 0) {
    return {
      status: "failed",
      detail: failureDetail("npm run " + script, result.stderr, result.stdout),
      verified: false,
      provider: context.definition.provider,
      output: {
        script,
        stdout: result.stdout.slice(-12_000),
        stderr: result.stderr.slice(-12_000),
      },
    };
  }

  return {
    status: "completed",
    detail: "npm run " + script + " completed with exit code 0.",
    verified: true,
    provider: context.definition.provider,
    output: {
      script,
      exitCode: result.exitCode,
      stdout: result.stdout.slice(-12_000),
      stderr: result.stderr.slice(-12_000),
    },
  };
};

export const LOCAL_GIT_TOOL_HANDLERS: Readonly<Record<string, AstraToolHandler>> = {
  "project.git.status": gitStatus,
  "project.git.diff-file": gitDiffFile,
  "project.git.create-branch": gitCreateBranch,
  "project.git.stage-files": gitStageFiles,
  "project.git.commit": gitCommit,
  "project.verify.npm-script": npmVerify,
};
