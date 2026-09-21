import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("browser performance endpoint is local guarded and writes only private evidence", () => {
  const route = readFileSync(
    path.resolve(
      "app",
      "api",
      "performance",
      "browser-evidence",
      "route.ts",
    ),
    "utf8",
  );
  const output = readFileSync(
    path.resolve(
      "lib",
      "performance",
      "private-output.ts",
    ),
    "utf8",
  );

  assert.match(
    route,
    /guardRequest\(request, true\)/,
  );
  assert.match(
    route,
    /parseBrowserPerformanceEvidence/,
  );
  assert.match(
    route,
    /prepareBrowserPerformancePath/,
  );
  assert.match(
    output,
    /\.astra", "performance/,
  );
  assert.match(
    route,
    /NOT_EVALUATED/,
  );
  assert.match(
    route,
    /rev-parse[\s\S]*HEAD/,
  );
  assert.match(
    route,
    /--untracked-files=normal/,
  );
  assert.match(
    route,
    /workingTreeClean/,
  );
  assert.match(
    route,
    /runtimeBuildIdentity/,
  );
  assert.match(
    route,
    /evidence\.runtime\.commit/,
  );
  assert.doesNotMatch(
    route,
    /READY["']/,
  );
});

test("Humanoid browser capture persists counts and telemetry, not chat or console text", () => {
  const hook = readFileSync(
    path.resolve(
      "components",
      "lab",
      "useHumanoidPerformanceCapture.ts",
    ),
    "utf8",
  );

  assert.match(hook, /frameIntervals|intervals/);
  assert.match(hook, /consoleErrorCount/);
  assert.match(hook, /consoleWarnCount/);
  assert.match(hook, /unhandledRejectionCount/);
  assert.match(hook, /longTaskCount/);
  assert.match(hook, /quality !== "high"/);
  assert.match(
    hook,
    /parseBrowserRuntimeIdentity/,
  );
  assert.equal(
    (
      hook.match(
        /await fetchRuntimeIdentity\(\)/g,
      ) ?? []
    ).length,
    2,
  );
  assert.match(
    hook,
    /runtimeAtCompletion\.commit[\s\S]*runtimeAtStart\.commit/,
  );

  assert.doesNotMatch(
    hook,
    /lastResponse\?\.message/,
  );
  assert.doesNotMatch(
    hook,
    /consoleMessages|errorMessages|warningMessages/,
  );
});
