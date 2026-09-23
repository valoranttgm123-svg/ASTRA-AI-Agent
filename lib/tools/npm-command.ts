import { access } from "node:fs/promises";
import path from "node:path";

/** Do not spawn npm.cmd with shell:false (EINVAL on Windows), or enable a shell
 * for untrusted project inputs. Use the npm CLI shipped beside the running Node.
 */
export async function npmScriptCommand(script: string) {
  if (!["test", "typecheck", "lint", "build"].includes(script)) {
    throw new Error("Unsupported verification script.");
  }
  if (process.platform !== "win32") {
    return { command: "npm", args: ["run", script] };
  }
  const cli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  try {
    await access(cli);
  } catch {
    throw new Error("The Node installation used by ASTRA has no bundled npm CLI. Install Node with npm before project verification.");
  }
  return { command: process.execPath, args: [cli, "run", script] };
}
