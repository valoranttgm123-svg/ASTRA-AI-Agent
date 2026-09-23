import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";

import { ASTRA_AGENT_MAP } from "../lib/agent/roster";
import {
  chatWithCodex,
  getCodexStatus,
} from "../lib/brain/codex";
import type { AstraBrainPermissionSnapshot } from "../lib/brain/types";
import {
  shouldDetachOwnedProcess,
  windowsTaskkillArgs,
} from "../lib/process-tree";

let root = "";
let execFile = "";
let pidFile = "";
let descendantPidFile = "";

const readOnlyPolicy: AstraBrainPermissionSnapshot = {
  requireApproval: true,
  allowShell: false,
  allowFileWrite: false,
  allowExternalActions: false,
  allowPaidCloud: false,
};

async function waitForPid(file: string, timeoutMs = 1500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const value = Number((await readFile(file, "utf8")).trim());
      if (Number.isInteger(value) && value > 0) return value;
    } catch {
      // Child may not have created the pid file yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Fake Codex child did not publish its pid.");
}

function pidAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForExit(pid: number, timeoutMs = 1500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!pidAlive(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return !pidAlive(pid);
}

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "astra-codex-process-"));
  execFile = path.join(root, "exec");
  pidFile = path.join(root, "fake-codex.pid");
  descendantPidFile = path.join(root, "fake-codex-descendant.pid");

  await writeFile(
    execFile,
    [
      'const fs = require("node:fs");',
      'const mode = process.env.ASTRA_FAKE_CODEX_MODE || "success";',
      'const pidFile = process.env.ASTRA_FAKE_CODEX_PID_FILE;',
      'if (pidFile) fs.writeFileSync(pidFile, String(process.pid));',
      'if (mode === "tree") {',
      '  const child = require("node:child_process").spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore",windowsHide:true});',
      '  fs.writeFileSync(pidFile+".descendant",String(child.pid));',
      '  setInterval(()=>{},1000);',
      '}',
      'if (mode === "stream") {',
      '  console.log(JSON.stringify({type:"item.started",item:{type:"agent_message",text:""}}));',
      '  console.log(JSON.stringify({type:"item.updated",item:{type:"agent_message",text:"fixture "}}));',
      '  console.log(JSON.stringify({type:"item.updated",item:{type:"agent_message",text:"fixture codex "}}));',
      '  console.log(JSON.stringify({type:"item.completed",item:{type:"agent_message",text:"fixture codex response"}}));',
      '  console.log(JSON.stringify({type:"turn.completed"}));',
      '  process.exit(0);',
      '}',
      'if (mode === "success") {',
      '  console.log(JSON.stringify({type:"item.completed",item:{type:"agent_message",text:"fixture codex response"}}));',
      '  console.log(JSON.stringify({type:"turn.completed"}));',
      '  process.exit(0);',
      '}',
      'if (mode === "malformed") {',
      '  console.log("not-json");',
      '  console.log(JSON.stringify({type:"turn.completed"}));',
      '  process.exit(0);',
      '}',
      'if (mode === "nonzero") {',
      '  console.error("fixture codex child failure");',
      '  process.exit(7);',
      '}',
      'if (mode === "leak") {',
      '  console.error("Authorization: Bearer fake_codex_secret_1234567890 api_key=sk-proj-FAKECODEXSECRET1234567890 approvalToken=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee https://example.test/?token=fake-codex-query C:\\\\Users\\\\alice\\\\ASTRA\\\\auth.json");',
      '  process.exit(9);',
      '}',
      'if (mode === "hang-tree") {',
      '  const { spawn } = require("node:child_process");',
      '  const descendant = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });',
      '  const descendantPidFile = process.env.ASTRA_FAKE_CODEX_DESC_PID_FILE;',
      '  if (descendantPidFile) fs.writeFileSync(descendantPidFile, String(descendant.pid));',
      '  setInterval(() => {}, 1000);',
      '} else if (mode === "hang") {',
      '  setInterval(() => {}, 1000);',
      '} else if (mode !== "tree") {',
      '  process.exit(0);',
      '}',
      "",
    ].join("\n"),
    "utf8",
  );
});

after(async () => {
  // Windows can retain the fixture's current-directory handle briefly after
  // process termination. Exit assertions above remain mandatory.
  if (root) await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
});

beforeEach(async () => {
  await rm(pidFile, { force: true });
  await rm(descendantPidFile, { force: true });
  process.env.ASTRA_CODEX_ENABLED = "true";
  process.env.ASTRA_CODEX_COMMAND = process.execPath;
  process.env.ASTRA_CODEX_WORKDIR = root;
  process.env.ASTRA_CODEX_SANDBOX = "read-only";
  process.env.ASTRA_CODEX_TIMEOUT_MS = "3000";
  process.env.ASTRA_CODEX_STATUS_TIMEOUT_MS = "1000";
  process.env.ASTRA_FAKE_CODEX_MODE = "success";
  process.env.ASTRA_FAKE_CODEX_PID_FILE = pidFile;
  process.env.ASTRA_FAKE_CODEX_DESC_PID_FILE = descendantPidFile;
  delete process.env.ASTRA_CODEX_ALLOW_DANGER_FULL_ACCESS;
  delete process.env.ASTRA_CODEX_MODEL;
});

test("owned process termination strategy uses Windows tree kill and POSIX process groups", () => {
  assert.deepEqual(
    windowsTaskkillArgs(4321),
    ["/PID", "4321", "/T", "/F"],
  );
  assert.equal(
    shouldDetachOwnedProcess("win32"),
    false,
  );
  assert.equal(
    shouldDetachOwnedProcess("linux"),
    true,
  );
});

test("Phase 15D2 fake Codex fixture exercises the real child-process path", async () => {
  const status = await getCodexStatus(readOnlyPolicy);
  assert.equal(status.available, true);
  assert.equal(status.sandbox, "read-only");

  const result = await chatWithCodex({
    input: "inspect fixture",
    agent: ASTRA_AGENT_MAP.developer,
    policy: readOnlyPolicy,
  });

  assert.equal(result.message, "fixture codex response");
  assert.equal(result.sandbox, "read-only");
});

test("Codex chat forwards incremental agent-message updates without duplicating text", async () => {
  process.env.ASTRA_FAKE_CODEX_MODE = "stream";
  const tokens: string[] = [];

  const result = await chatWithCodex({
    input: "inspect fixture",
    agent: ASTRA_AGENT_MAP.developer,
    policy: readOnlyPolicy,
    onToken: (token) => tokens.push(token),
  });

  assert.equal(result.message, "fixture codex response");
  assert.deepEqual(tokens, ["fixture ", "codex ", "response"]);
  assert.equal(tokens.join(""), result.message);
});

test("Phase 15D2 malformed Codex JSONL cannot become a successful final response", async () => {
  process.env.ASTRA_FAKE_CODEX_MODE = "malformed";

  await assert.rejects(
    chatWithCodex({
      input: "inspect fixture",
      agent: ASTRA_AGENT_MAP.developer,
      policy: readOnlyPolicy,
    }),
    /without a final agent message/i,
  );
});

test("Phase 15D2 non-zero Codex child exit fails truthfully", async () => {
  process.env.ASTRA_FAKE_CODEX_MODE = "nonzero";

  await assert.rejects(
    chatWithCodex({
      input: "inspect fixture",
      agent: ASTRA_AGENT_MAP.developer,
      policy: readOnlyPolicy,
    }),
    /fixture codex child failure|exited with code 7/i,
  );
});

test("Phase 15E Codex stderr is redacted before error exposure", async () => {
  process.env.ASTRA_FAKE_CODEX_MODE = "leak";

  await assert.rejects(
    chatWithCodex({
      input: "inspect fixture",
      agent: ASTRA_AGENT_MAP.developer,
      policy: readOnlyPolicy,
    }),
    (error: Error) => {
      assert.doesNotMatch(error.message, /fake_codex_secret/i);
      assert.doesNotMatch(error.message, /FAKECODEXSECRET/i);
      assert.doesNotMatch(error.message, /aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/i);
      assert.doesNotMatch(error.message, /fake-codex-query/i);
      assert.doesNotMatch(error.message, /Users\\\\alice/i);
      assert.match(error.message, /redacted|local-path/i);
      return true;
    },
  );
});

test("Phase 15D2 Codex timeout kills the owned child process", async () => {
  process.env.ASTRA_FAKE_CODEX_MODE = "hang";
  process.env.ASTRA_CODEX_TIMEOUT_MS = "500";

  const pending = chatWithCodex({
    input: "inspect fixture",
    agent: ASTRA_AGENT_MAP.developer,
    policy: readOnlyPolicy,
  });
  const pid = await waitForPid(pidFile);

  await assert.rejects(pending, /timed out/i);
  assert.equal(await waitForExit(pid), true);
});

test("Phase 15D2 global STOP kills the full owned Codex process tree", async () => {
  process.env.ASTRA_FAKE_CODEX_MODE = "hang-tree";
  process.env.ASTRA_CODEX_TIMEOUT_MS = "5000";

  const controller = new AbortController();
  const pending = chatWithCodex({
    input: "inspect fixture",
    agent: ASTRA_AGENT_MAP.developer,
    policy: readOnlyPolicy,
    signal: controller.signal,
  });

  const parentPid = await waitForPid(pidFile);
  const descendantPid = await waitForPid(descendantPidFile);

  controller.abort(
    new DOMException("global stop", "AbortError"),
  );

  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(await waitForExit(parentPid), true);
  assert.equal(await waitForExit(descendantPid), true);
});

test("Phase 15D2 global STOP cancels Codex and kills the owned child process", async () => {
  process.env.ASTRA_FAKE_CODEX_MODE = "hang";
  process.env.ASTRA_CODEX_TIMEOUT_MS = "5000";

  const controller = new AbortController();
  const pending = chatWithCodex({
    input: "inspect fixture",
    agent: ASTRA_AGENT_MAP.developer,
    policy: readOnlyPolicy,
    signal: controller.signal,
  });
  const pid = await waitForPid(pidFile);

  controller.abort(
    new DOMException("global stop", "AbortError"),
  );

  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(await waitForExit(pid), true);
});

test("Codex chat and verification never inherit global writable sandbox permission", async () => {
  process.env.ASTRA_CODEX_SANDBOX = "danger-full-access";
  process.env.ASTRA_CODEX_ALLOW_DANGER_FULL_ACCESS = "true";
  const policy = { ...readOnlyPolicy, allowShell: true, allowFileWrite: true };
  for (const verificationRequested of [false, true]) {
    const response = await chatWithCodex({input: "inspect fixture", agent: ASTRA_AGENT_MAP.developer, policy, verificationRequested});
    assert.equal(response.sandbox, "read-only");
  }
});

test("Windows STOP terminates the owned Codex descendant without killing unrelated Node", {skip: process.platform !== "win32"}, async () => {
  process.env.ASTRA_FAKE_CODEX_MODE = "tree";
  const controller = new AbortController();
  const pending = chatWithCodex({input: "fixture", agent: ASTRA_AGENT_MAP.developer, policy: readOnlyPolicy, signal: controller.signal});
  const rejected = assert.rejects(pending, {name: "AbortError"});
  const pid = await waitForPid(pidFile);
  const descendant = await waitForPid(pidFile + ".descendant");
  controller.abort();
  await rejected;
  assert.equal(await waitForExit(pid), true);
  assert.equal(await waitForExit(descendant), true);
  assert.equal(pidAlive(process.pid), true);
});
