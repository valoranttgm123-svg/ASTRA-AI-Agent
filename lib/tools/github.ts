import type { AstraProjectRecord } from "@/lib/projects/contracts";
import { resolveProjectWorkspace } from "@/lib/projects/paths";
import { getProjectRegistry } from "@/lib/projects/registry";
import type {
  AstraToolDefinition,
  AstraToolHandler,
} from "./contracts";
import { runBoundedProcess } from "./process";

export type AstraGitHubTransportStatus = {
  configured: boolean;
  available: boolean;
  provider: string;
  detail: string;
};

export type AstraGitHubTransport = {
  readonly provider: string;
  status(signal?: AbortSignal): Promise<AstraGitHubTransportStatus>;
  push(input: {
    workspace: string;
    branch: string;
    remote: string;
    signal: AbortSignal;
  }): Promise<{ ok: boolean; detail: string; output?: unknown }>;
  openPullRequest(input: {
    workspace: string;
    base: string;
    head: string;
    title: string;
    body: string;
    signal: AbortSignal;
  }): Promise<{ ok: boolean; detail: string; output?: unknown }>;
  ciStatus(input: {
    workspace: string;
    branch?: string;
    limit: number;
    signal: AbortSignal;
  }): Promise<{ ok: boolean; detail: string; output?: unknown }>;
};

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

function validGitRef(value: string) {
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

async function targetProject(projectId: string) {
  const project = await registeredProject(projectId);
  if (!project) return null;
  const workspace = await resolveProjectWorkspace(project);
  if (!workspace) return null;
  return { project, workspace };
}

function cleanProcessDetail(value: string) {
  return value
    .replace(/gh[pousr]_[A-Za-z0-9_]+/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .trim()
    .slice(0, 4000);
}

async function runGh(
  args: readonly string[],
  cwd: string,
  signal: AbortSignal,
) {
  const executable = process.platform === "win32" ? "gh.exe" : "gh";
  return runBoundedProcess({
    command: executable,
    args,
    cwd,
    signal,
    env: {
      ...process.env,
      GH_PROMPT_DISABLED: "1",
      GIT_TERMINAL_PROMPT: "0",
    },
  });
}

async function runGit(
  args: readonly string[],
  cwd: string,
  signal: AbortSignal,
) {
  return runBoundedProcess({
    command: "git",
    args,
    cwd,
    signal,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
    },
  });
}

export class GhCliGitHubTransport implements AstraGitHubTransport {
  readonly provider = "github-gh-cli";

  async status(signal?: AbortSignal): Promise<AstraGitHubTransportStatus> {
    const controller = signal
      ? null
      : new AbortController();
    const effectiveSignal = signal ?? controller!.signal;

    try {
      const version = await runGh(["--version"], process.cwd(), effectiveSignal);
      if (version.exitCode !== 0) {
        return {
          configured: false,
          available: false,
          provider: this.provider,
          detail: "GitHub CLI is not available.",
        };
      }

      const auth = await runGh(
        ["auth", "status", "--hostname", "github.com"],
        process.cwd(),
        effectiveSignal,
      );
      if (auth.exitCode !== 0) {
        return {
          configured: false,
          available: false,
          provider: this.provider,
          detail:
            "GitHub CLI is installed but no verified github.com authentication is available.",
        };
      }

      return {
        configured: true,
        available: true,
        provider: this.provider,
        detail: "GitHub CLI authentication for github.com is verified.",
      };
    } catch {
      return {
        configured: false,
        available: false,
        provider: this.provider,
        detail: "GitHub CLI is unavailable or could not be checked.",
      };
    }
  }

  async push(input: {
    workspace: string;
    branch: string;
    remote: string;
    signal: AbortSignal;
  }) {
    const remoteCheck = await runGit(
      ["remote", "get-url", input.remote],
      input.workspace,
      input.signal,
    );
    if (remoteCheck.exitCode !== 0) {
      return {
        ok: false,
        detail: "Configured Git remote is unavailable.",
      };
    }

    const remoteUrl = remoteCheck.stdout.trim();
    if (!/(?:github\.com[:/])/i.test(remoteUrl)) {
      return {
        ok: false,
        detail: "External push is restricted to a verified GitHub remote.",
      };
    }

    const current = await runGit(
      ["branch", "--show-current"],
      input.workspace,
      input.signal,
    );
    if (current.exitCode !== 0 || current.stdout.trim() !== input.branch) {
      return {
        ok: false,
        detail: "Current local branch does not match the approved push branch.",
      };
    }

    const push = await runGit(
      ["push", "--set-upstream", input.remote, input.branch],
      input.workspace,
      input.signal,
    );
    if (push.exitCode !== 0) {
      return {
        ok: false,
        detail:
          "GitHub push failed: " +
          cleanProcessDetail(push.stderr || push.stdout),
      };
    }

    const verify = await runGit(
      ["ls-remote", "--heads", input.remote, "refs/heads/" + input.branch],
      input.workspace,
      input.signal,
    );
    if (
      verify.exitCode !== 0 ||
      !verify.stdout.includes("refs/heads/" + input.branch)
    ) {
      return {
        ok: false,
        detail: "Push returned success but remote branch verification failed.",
      };
    }

    return {
      ok: true,
      detail: "Pushed and verified remote branch " + input.branch + ".",
      output: {
        branch: input.branch,
        remote: input.remote,
        verifiedRemoteRef: true,
      },
    };
  }

  async openPullRequest(input: {
    workspace: string;
    base: string;
    head: string;
    title: string;
    body: string;
    signal: AbortSignal;
  }) {
    const result = await runGh(
      [
        "pr",
        "create",
        "--base",
        input.base,
        "--head",
        input.head,
        "--title",
        input.title,
        "--body",
        input.body,
      ],
      input.workspace,
      input.signal,
    );

    if (result.exitCode !== 0) {
      return {
        ok: false,
        detail:
          "GitHub pull request creation failed: " +
          cleanProcessDetail(result.stderr || result.stdout),
      };
    }

    const url = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => /^https:\/\/github\.com\//i.test(line));

    if (!url) {
      return {
        ok: false,
        detail:
          "GitHub CLI returned success but ASTRA could not verify the pull request URL.",
      };
    }

    return {
      ok: true,
      detail: "Created and verified GitHub pull request.",
      output: {
        url,
        base: input.base,
        head: input.head,
      },
    };
  }

  async ciStatus(input: {
    workspace: string;
    branch?: string;
    limit: number;
    signal: AbortSignal;
  }) {
    const args = [
      "run",
      "list",
      "--limit",
      String(Math.max(1, Math.min(20, input.limit))),
      "--json",
      "databaseId,name,headBranch,status,conclusion,url,workflowName",
    ];
    if (input.branch) {
      args.push("--branch", input.branch);
    }

    const result = await runGh(args, input.workspace, input.signal);
    if (result.exitCode !== 0) {
      return {
        ok: false,
        detail:
          "GitHub CI status read failed: " +
          cleanProcessDetail(result.stderr || result.stdout),
      };
    }

    try {
      const runs = JSON.parse(result.stdout) as unknown;
      if (!Array.isArray(runs)) throw new Error("not an array");
      return {
        ok: true,
        detail:
          "Read " +
          runs.length +
          " GitHub workflow run" +
          (runs.length === 1 ? "." : "s."),
        output: { runs },
      };
    } catch {
      return {
        ok: false,
        detail: "GitHub CLI returned malformed workflow JSON.",
      };
    }
  }
}

export async function createGitHubToolRegistrations(
  transport: AstraGitHubTransport,
  signal?: AbortSignal,
): Promise<{
  definitions: AstraToolDefinition[];
  handlers: Record<string, AstraToolHandler>;
  status: AstraGitHubTransportStatus;
}> {
  const status = await transport.status(signal);

  const availability = status.available ? "READY" : "NOT_CONFIGURED";
  const definitions: AstraToolDefinition[] = [
    {
      id: "github.push",
      name: "GitHub Push",
      category: "github",
      description:
        "Push one approved current local branch to the verified GitHub origin and verify the remote ref.",
      permissionLevel: 3,
      sideEffect: "external_write",
      timeoutMs: 60_000,
      supportsCancellation: true,
      provider: status.available ? transport.provider : undefined,
      availability,
    },
    {
      id: "github.pull-request.open",
      name: "GitHub Open Pull Request",
      category: "github",
      description:
        "Open one approved GitHub pull request and verify the returned GitHub URL.",
      permissionLevel: 3,
      sideEffect: "external_write",
      timeoutMs: 60_000,
      supportsCancellation: true,
      provider: status.available ? transport.provider : undefined,
      availability,
    },
    {
      id: "github.ci.status",
      name: "GitHub CI Status",
      category: "github",
      description:
        "Read recent GitHub Actions workflow status for the registered project repository.",
      permissionLevel: 1,
      sideEffect: "read",
      timeoutMs: 30_000,
      supportsCancellation: true,
      provider: status.available ? transport.provider : undefined,
      availability,
    },
  ];

  if (!status.available) {
    return { definitions, handlers: {}, status };
  }

  const push: AstraToolHandler = async (input, context) => {
    if (!isObject(input)) {
      return { status: "failed", detail: "Input must be an object.", verified: false };
    }

    const projectId = stringField(input, "projectId");
    const branch = stringField(input, "branch");
    const remote = stringField(input, "remote") || "origin";
    if (!projectId || !validGitRef(branch) || !/^[A-Za-z0-9._-]{1,80}$/.test(remote)) {
      return { status: "failed", detail: "projectId, valid branch and remote are required.", verified: false };
    }

    const target = await targetProject(projectId);
    if (!target) {
      return { status: "failed", detail: "Registered project workspace is unavailable.", verified: false };
    }

    const result = await transport.push({
      workspace: target.workspace,
      branch,
      remote,
      signal: context.signal,
    });

    return {
      status: result.ok ? "completed" : "failed",
      detail: result.detail,
      verified: result.ok,
      output: result.output,
      provider: transport.provider,
    };
  };

  const openPullRequest: AstraToolHandler = async (input, context) => {
    if (!isObject(input)) {
      return { status: "failed", detail: "Input must be an object.", verified: false };
    }

    const projectId = stringField(input, "projectId");
    const base = stringField(input, "base");
    const head = stringField(input, "head");
    const title = stringField(input, "title").replace(/[\r\n\0]/g, " ").slice(0, 200);
    const body =
      typeof input.body === "string"
        ? input.body.replace(/\0/g, "").slice(0, 12_000)
        : "";

    if (
      !projectId ||
      !validGitRef(base) ||
      !validGitRef(head) ||
      !title
    ) {
      return { status: "failed", detail: "projectId, valid base/head and title are required.", verified: false };
    }

    const target = await targetProject(projectId);
    if (!target) {
      return { status: "failed", detail: "Registered project workspace is unavailable.", verified: false };
    }

    const result = await transport.openPullRequest({
      workspace: target.workspace,
      base,
      head,
      title,
      body,
      signal: context.signal,
    });

    return {
      status: result.ok ? "completed" : "failed",
      detail: result.detail,
      verified: result.ok,
      output: result.output,
      provider: transport.provider,
    };
  };

  const ciStatus: AstraToolHandler = async (input, context) => {
    if (!isObject(input)) {
      return { status: "failed", detail: "Input must be an object.", verified: false };
    }

    const projectId = stringField(input, "projectId");
    const branch = stringField(input, "branch");
    const limit =
      typeof input.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 10;

    if (!projectId || (branch && !validGitRef(branch))) {
      return { status: "failed", detail: "A valid projectId and optional branch are required.", verified: false };
    }

    const target = await targetProject(projectId);
    if (!target) {
      return { status: "failed", detail: "Registered project workspace is unavailable.", verified: false };
    }

    const result = await transport.ciStatus({
      workspace: target.workspace,
      branch: branch || undefined,
      limit,
      signal: context.signal,
    });

    return {
      status: result.ok ? "completed" : "failed",
      detail: result.detail,
      verified: result.ok,
      output: result.output,
      provider: transport.provider,
    };
  };

  return {
    definitions,
    handlers: {
      "github.push": push,
      "github.pull-request.open": openPullRequest,
      "github.ci.status": ciStatus,
    },
    status,
  };
}
