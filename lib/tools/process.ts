import { spawn } from "node:child_process";

const MAX_PROCESS_OUTPUT = 64_000;

export type AstraProcessResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export async function runBoundedProcess({
  command,
  args,
  cwd,
  signal,
  env,
}: {
  command: string;
  args: readonly string[];
  cwd: string;
  signal: AbortSignal;
  env?: NodeJS.ProcessEnv;
}): Promise<AstraProcessResult> {
  signal.throwIfAborted();

  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd,
      env: env ?? process.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (
      error: Error | null,
      result?: AstraProcessResult,
    ) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve(result as AstraProcessResult);
    };

    const killForOverflow = () => {
      child.kill();
      const error = new Error("Process output exceeded the ASTRA safety limit.");
      error.name = "OutputLimitError";
      finish(error);
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      if (settled) return;
      stdout += chunk.toString("utf8");
      if (stdout.length + stderr.length > MAX_PROCESS_OUTPUT) {
        killForOverflow();
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      if (settled) return;
      stderr += chunk.toString("utf8");
      if (stdout.length + stderr.length > MAX_PROCESS_OUTPUT) {
        killForOverflow();
      }
    });

    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (settled) return;
      finish(null, {
        exitCode: typeof code === "number" ? code : -1,
        stdout: stdout.slice(0, MAX_PROCESS_OUTPUT),
        stderr: stderr.slice(0, MAX_PROCESS_OUTPUT),
      });
    });

    const onAbort = () => {
      child.kill();
      const reason =
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException("Process cancelled.", "AbortError");
      finish(reason);
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}
