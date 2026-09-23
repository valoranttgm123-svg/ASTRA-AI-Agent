import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { register } from "../instrumentation";

test("instrumentation puts its only dependency behind the compile-time Node guard", () => {
  const source = ts.createSourceFile("instrumentation.ts", readFileSync("instrumentation.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const fn = source.statements.find(ts.isFunctionDeclaration)!;
  assert.equal(source.statements.length, 1);
  const guard = fn.body!.statements[0];
  assert.ok(ts.isIfStatement(guard));
  assert.equal(guard.expression.getText(source), 'process.env.NEXT_RUNTIME === "nodejs"');
  assert.equal(fn.body!.statements.length, 1);
  assert.match(guard.thenStatement.getText(source), /import\("\.\/lib\/brain\/startup"\)/);
});

test("Edge and unknown runtimes do not start Node services or preload", async () => {
  const previous = process.env.NEXT_RUNTIME;
  try {
    process.env.NEXT_RUNTIME = "edge";
    await register();
    delete process.env.NEXT_RUNTIME;
    await register();
  } finally {
    if (previous === undefined) delete process.env.NEXT_RUNTIME;
    else process.env.NEXT_RUNTIME = previous;
  }
});
