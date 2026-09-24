import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { WINDOWS_STARTUP_TASK_QUERY } from "../lib/release/windows-task-probe";

test("startup probe uses read-only native task lookups and propagates non-missing errors", () => {
  assert.match(WINDOWS_STARTUP_TASK_QUERY, /Schedule\.Service/);
  assert.match(WINDOWS_STARTUP_TASK_QUERY, /GetTask\(\$name\)/);
  assert.match(WINDOWS_STARTUP_TASK_QUERY, /HResult -ne -2147024894\) \{ throw \}/);
  assert.doesNotMatch(WINDOWS_STARTUP_TASK_QUERY, /Get-ScheduledTask|RegisterTask|DeleteTask|\.Run\(|\.Stop\(/);
});

test("native Windows startup probe returns both task states within the diagnostic budget", {
  skip: process.platform !== "win32",
}, () => {
  const raw = execFileSync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-Command", WINDOWS_STARTUP_TASK_QUERY,
  ], { encoding: "utf8", timeout: 5000, windowsHide: true });
  const records = JSON.parse(raw) as { name: string; state: string }[];
  assert.deepEqual(records.map((record) => record.name), ["ASTRA-Agent", "ASTRA-Ollama"]);
  for (const record of records) {
    assert.ok(["Unknown", "Disabled", "Queued", "Ready", "Running", "MISSING"].includes(record.state));
  }
});

test("native Windows startup probe classifies only a genuinely absent task as missing", {
  skip: process.platform !== "win32",
}, () => {
  // Query an absent, unique name without registering or changing any task.
  const name = `ASTRA-ReadOnly-Missing-Probe-${process.pid}-${Date.now()}`;
  const query = WINDOWS_STARTUP_TASK_QUERY.replace("@('ASTRA-Agent', 'ASTRA-Ollama')", `@('${name}')`);
  const raw = execFileSync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-Command", query,
  ], { encoding: "utf8", timeout: 5000, windowsHide: true });
  assert.deepEqual(JSON.parse(raw), [{ name, state: "MISSING" }]);
});
