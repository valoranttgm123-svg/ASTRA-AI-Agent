import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { npmScriptCommand } from "../lib/tools/npm-command";

test("npm verification uses a fixed script and native executable on Windows", async () => {
  const command = await npmScriptCommand("test");
  assert.deepEqual(command.args.slice(-2), ["run", "test"]);
  if (process.platform === "win32") {
    assert.equal(command.command, process.execPath);
    assert.equal(command.args[0], path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"));
  } else assert.equal(command.command, "npm");
});

test("npm verification never accepts shell fragments or additional flags", async () => {
  for (const script of ["test & whoami", "--help", "test;echo unsafe", "../test", "install"]) {
    await assert.rejects(npmScriptCommand(script), /Unsupported verification script/);
  }
});
