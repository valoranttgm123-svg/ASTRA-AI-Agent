export type RepositoryGateStep = {
  id:
    | "test"
    | "typecheck"
    | "lint"
    | "build"
    | "audit"
    | "diff-check";
  label: string;
  executable: "npm" | "git";
  args: readonly string[];
};

export const REPOSITORY_GATE_STEPS: readonly RepositoryGateStep[] = [
  {
    id: "test",
    label: "Unit and integration tests",
    executable: "npm",
    args: ["test"],
  },
  {
    id: "typecheck",
    label: "TypeScript typecheck",
    executable: "npm",
    args: ["run", "typecheck"],
  },
  {
    id: "lint",
    label: "Lint",
    executable: "npm",
    args: ["run", "lint"],
  },
  {
    id: "build",
    label: "Production build",
    executable: "npm",
    args: ["run", "build"],
  },
  {
    id: "audit",
    label: "High-severity dependency audit",
    executable: "npm",
    args: ["audit", "--audit-level=high"],
  },
  {
    id: "diff-check",
    label: "Git whitespace/error diff check",
    executable: "git",
    args: ["diff", "--check"],
  },
];

export function repositoryGateExecutable(
  executable: RepositoryGateStep["executable"],
  platform = process.platform,
) {
  if (executable === "npm" && platform === "win32") {
    return "npm.cmd";
  }
  return executable;
}
