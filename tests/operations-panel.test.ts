import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

function source(file: string) {
  return readFileSync(path.resolve(file), "utf8");
}

test("operations panel is mounted on the main ASTRA surface", () => {
  const page = source("app/page.tsx");
  assert.match(page, /import AstraOperationsPanel/);
  assert.match(page, /<AstraOperationsPanel \/>/);
});

test("operations panel reads durable tasks and diagnostics from canonical APIs", () => {
  const panel = source("components/AstraOperationsPanel.tsx");

  assert.match(panel, /fetch\("\/api\/tasks"/);
  assert.match(panel, /fetch\(\s*"\/api\/diagnostics\?"/);
  assert.match(panel, /cache: "no-store"/);
  assert.match(panel, /DURABLE BACKGROUND TASKS/);
  assert.match(panel, /HEALTH \+ ACTION HISTORY/);
  assert.match(panel, /WHAT ASTRA DID/);
});

test("task lifecycle mutations preserve the guarded canonical task API", () => {
  const panel = source("components/AstraOperationsPanel.tsx");

  assert.match(panel, /method: "POST"/);
  assert.match(panel, /"x-astra-client": "1"/);
  assert.match(panel, /"resume", "pause", "cancel", "delete"/);
  assert.doesNotMatch(panel, /action:\s*"run"/);
  assert.doesNotMatch(panel, /executeBackgroundTask/);
});

test("diagnostics surface remains read-only and keeps the truth boundary visible", () => {
  const panel = source("components/AstraOperationsPanel.tsx");

  const diagnosticSection =
    panel.slice(panel.indexOf("refreshDiagnostics"), panel.indexOf("const refresh ="));
  assert.match(diagnosticSection, /method: "GET"/);
  assert.doesNotMatch(diagnosticSection, /method: "POST"/);
  assert.match(panel, /truthBoundary/);
  assert.match(panel, /Connectivity remains UNKNOWN until a real probe is wired/);
  assert.doesNotMatch(panel, /executeRecovery/);
  assert.doesNotMatch(panel, /reconnect_provider/);
});

test("operations panel does not claim production executors or real restart evidence", () => {
  const panel = source("components/AstraOperationsPanel.tsx");

  assert.match(
    panel,
    /Production executors and real restart evidence remain separate integration gates/,
  );
  assert.doesNotMatch(panel, /PRODUCTION EXECUTOR READY/);
  assert.doesNotMatch(panel, /RESTART VERIFIED/);
});
