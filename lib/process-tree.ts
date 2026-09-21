import {
  spawn,
  type ChildProcess,
} from "node:child_process";

export function shouldDetachOwnedProcess(
  platform: NodeJS.Platform = process.platform,
) {
  return platform !== "win32";
}

export function windowsTaskkillArgs(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error("Owned process PID must be a positive integer.");
  }

  return [
    "/PID",
    String(pid),
    "/T",
    "/F",
  ] as const;
}

function killDirectChild(child: ChildProcess) {
  try {
    child.kill();
  } catch {
    // Best-effort fallback only.
  }
}

export function terminateOwnedProcessTree(
  child: ChildProcess,
) {
  const pid = child.pid;
  if (!pid) {
    killDirectChild(child);
    return;
  }

  if (process.platform === "win32") {
    try {
      const killer = spawn(
        "taskkill.exe",
        [...windowsTaskkillArgs(pid)],
        {
          shell: false,
          windowsHide: true,
          stdio: "ignore",
        },
      );

      killer.once("error", () => {
        killDirectChild(child);
      });
      killer.unref();
    } catch {
      killDirectChild(child);
    }
    return;
  }

  try {
    // Owned POSIX children are spawned detached so their PID is also
    // the process-group id. Kill the whole group to avoid orphan work.
    process.kill(-pid, "SIGTERM");
  } catch {
    killDirectChild(child);
  }
}
