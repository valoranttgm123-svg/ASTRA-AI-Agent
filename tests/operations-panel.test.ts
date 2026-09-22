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
    /Production executors and real restart evidence remain separate\s+integration gates/,
  );
  assert.doesNotMatch(panel, /PRODUCTION EXECUTOR READY/);
  assert.doesNotMatch(panel, /RESTART VERIFIED/);
});


test("event inbox reads canonical Event Engine state without fabricating sources", () => {
  const panel = source("components/AstraOperationsPanel.tsx");

  assert.match(panel, /fetch\("\/api\/events"/);
  assert.match(panel, /EVENT INBOX \+ SUBSCRIPTIONS/);
  assert.match(panel, /RECENT EVENT RECORDS/);
  assert.match(panel, /UNACKNOWLEDGED/);
  assert.match(panel, /does not fabricate source activity/);
  assert.match(panel, /does not expose\s+manual event publishing/);
});

test("event inbox mutations are limited to ack and subscription status", () => {
  const panel = source("components/AstraOperationsPanel.tsx");

  assert.match(panel, /action: "ack"/);
  assert.match(panel, /action: "status"/);
  assert.match(panel, /"x-astra-client": "1"/);
  assert.doesNotMatch(panel, /action:\s*"publish"/);
  assert.doesNotMatch(panel, /action:\s*"upsert"/);
  assert.doesNotMatch(panel, /publishIncomingEvent/);
});

test("event inbox only acknowledges delivered unacknowledged records", () => {
  const panel = source("components/AstraOperationsPanel.tsx");

  assert.match(panel, /event\.disposition === "delivered"/);
  assert.match(panel, /!event\.acknowledgedAt/);
  assert.match(panel, /ACKNOWLEDGE/);
});


test("GitHub Actions source UI is read-only toward GitHub and only triggers local sync", () => {
  const panel = source("components/AstraOperationsPanel.tsx");

  assert.match(panel, /fetch\("\/api\/events\/github"/);
  assert.match(panel, /SYNC GITHUB/);
  assert.match(panel, /body: JSON\.stringify\(\{ action: "sync" \}\)/);
  assert.doesNotMatch(panel, /workflow_dispatch/);
  assert.doesNotMatch(panel, /actions\/runs\/[^"']+\/rerun/);
});


test("service-health source UI only triggers local guarded sync", () => {
  const panel = source("components/AstraOperationsPanel.tsx");

  assert.match(panel, /fetch\("\/api\/events\/health"/);
  assert.match(panel, /LOCAL SERVICE HEALTH SOURCE/);
  assert.match(panel, /SYNC HEALTH/);
  assert.match(panel, /body: JSON\.stringify\(\{ action: "sync" \}\)/);
  assert.doesNotMatch(panel, /action:\s*"publish"/);
});
