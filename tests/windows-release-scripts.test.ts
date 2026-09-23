import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

function readWindowsScript(name: string) {
  return readFileSync(
    path.resolve("scripts", "windows", name),
    "utf8",
  );
}

test("Windows update stops only the exact checkout server, including an orphaned task child", () => {
  const stop = readWindowsScript("stop-astra-runtime.ps1");
  assert.match(stop, /Get-NetTCPConnection -LocalPort \$Port/);
  assert.match(stop, /\[regex\]::Escape\(\$nextCli\)/);
  assert.match(stop, /CommandLine -notmatch \$ownedPattern/);
  assert.match(stop, /CreationDate -ne \$candidate.CreationDate/);
  assert.match(stop, /Stop-Process -Id \$current.ProcessId/);
  assert.doesNotMatch(stop, /Stop-Process\s+-Name|taskkill[^\n]*\/IM/i);
  assert.match(readWindowsScript("update-local.ps1"), /stop-astra-runtime.ps1/);
  assert.match(readWindowsScript("uninstall-local.ps1"), /stop-astra-runtime.ps1/);
});

test("Phase 19B updater is fast-forward only and preserves private runtime paths", () => {
  const source = readWindowsScript("update-local.ps1");

  assert.match(source, /pull[\s\S]*--ff-only/i);
  assert.match(source, /status --porcelain --untracked-files=no/i);
  assert.match(source, /\.env\.local/);
  assert.match(source, /\.astra/);
  assert.match(source, /self-check\.ps1/i);
  assert.match(source, /install-local\.ps1/i);

  assert.doesNotMatch(source, /\bgit\s+reset\b/i);
  assert.doesNotMatch(source, /\bgit\s+clean\b/i);
  assert.doesNotMatch(
    source,
    /Remove-Item[^\n]*(?:\.env\.local|\.astra)/i,
  );
});

test("Phase 19B reinstall uses existing non-destructive install/uninstall wrappers and checks private preservation", () => {
  const source = readWindowsScript(
    "reinstall-local.ps1",
  );
  const uninstall = readWindowsScript(
    "uninstall-local.ps1",
  );

  assert.match(source, /uninstall-local\.ps1/i);
  assert.match(source, /install-local\.ps1/i);
  assert.match(source, /self-check\.ps1/i);
  assert.match(source, /\.env\.local/);
  assert.match(source, /\.astra/);

  assert.doesNotMatch(
    source,
    /Remove-Item[^\n]*(?:\.env\.local|\.astra)/i,
  );
  assert.doesNotMatch(uninstall, /\.env\.local/i);
  assert.doesNotMatch(uninstall, /\.astra/i);
  assert.doesNotMatch(
    uninstall,
    /Remove-Item[^\n]*(?:node_modules|AI-Models|\\.ollama|Ollama\\\\models)/i,
  );
});

test("Phase 19B uninstall remains scoped to startup tasks and desktop shortcut", () => {
  const source = readWindowsScript(
    "uninstall-local.ps1",
  );

  assert.match(source, /ASTRA-Agent/);
  assert.match(source, /ASTRA-Ollama/);
  assert.match(source, /ASTRA\.url/);
  assert.match(
    source,
    /File proyek dan model tidak dihapus/i,
  );
});


test("Phase 19C Windows preflight is read-only and enforces the supported runtime baseline", () => {
  const source = readWindowsScript(
    "preflight-local.ps1",
  );

  assert.match(source, /Get-Command node\.exe/i);
  assert.match(source, /Get-Command npm\.cmd/i);
  assert.match(source, /Get-Command git\.exe/i);
  assert.match(
    source,
    /\$nodeMajor\s+-lt\s+20/i,
  );
  assert.match(source, /package\.json/i);
  assert.match(source, /package-lock\.json/i);
  assert.match(source, /RequiresAdministrator\s*=\s*\$false/i);
  assert.match(source, /127\.0\.0\.1/);
  assert.match(
    source,
    /Get-NetTCPConnection\s+-LocalPort\s+\$Port/i,
  );
  assert.match(
    source,
    /LocalAddress\s+-ne\s+"127\.0\.0\.1"[\s\S]*LocalAddress\s+-ne\s+"::1"/i,
  );
  assert.match(
    source,
    /listener non-loopback/i,
  );

  assert.doesNotMatch(
    source,
    /Register-ScheduledTask|Unregister-ScheduledTask|Start-ScheduledTask|Stop-ScheduledTask|Remove-Item|git\s+pull|npm\s+ci|npm\s+run\s+build/i,
  );
});

test("Phase 19B reinstall completes dependency/build validation before teardown", () => {
  const source = readWindowsScript(
    "reinstall-local.ps1",
  );

  const npmCi = source.indexOf(
    'Invoke-Native -FilePath $npm -Arguments @("ci")',
  );
  const npmBuild = source.indexOf(
    'Invoke-Native -FilePath $npm -Arguments @("run", "build")',
  );
  const uninstall = source.indexOf(
    "& $uninstaller",
  );
  const install = source.indexOf(
    "& $installer -Port $Port -SkipBuild",
  );

  assert.ok(npmCi >= 0);
  assert.ok(npmBuild > npmCi);
  assert.ok(uninstall > npmBuild);
  assert.ok(install > uninstall);
  assert.doesNotMatch(
    source.slice(0, uninstall),
    /Unregister-ScheduledTask|Remove-Item/,
  );
});

test("Phase 19C install update and reinstall run preflight before their first mutation", () => {
  const cases = [
    {
      name: "install-local.ps1",
      firstMutation: "npm ci",
    },
    {
      name: "update-local.ps1",
      firstMutation: "git pull",
    },
    {
      name: "reinstall-local.ps1",
      firstMutation: "& $uninstaller",
    },
  ] as const;

  for (const item of cases) {
    const source = readWindowsScript(item.name);
    const preflightIndex = source.indexOf(
      "& $preflight -Port $Port",
    );
    const mutationIndex = source.indexOf(
      item.firstMutation,
    );

    assert.ok(
      preflightIndex >= 0,
      item.name + " must invoke preflight",
    );
    assert.ok(
      mutationIndex >= 0,
      item.name + " mutation anchor missing",
    );
    assert.ok(
      preflightIndex < mutationIndex,
      item.name + " must preflight before mutation",
    );
  }
});
