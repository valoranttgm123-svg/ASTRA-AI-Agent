# ASTRA Final Repository Audit — 2026-09-21

This document records the final repository-side audit performed before handing the next execution stage to Codex on the real target environment.

## Audit boundary

Audited repository areas:

- Brain/provider routing and approval boundaries;
- Planner and Tool Runtime permission floors;
- Automation approval/STOP semantics;
- process cancellation and child-process cleanup;
- Sonor/MEM-X adapter safety boundary;
- project/filesystem path confinement and symlink handling;
- public-web/research SSRF and loopback boundaries;
- GitHub transport verification;
- optional paid-cloud transport;
- Windows install/update/reinstall/startup tooling;
- private release evidence paths, hashes, runtime provenance and Phase 20 validation;
- API Host/Origin/mutation guards;
- CI permissions and release gate workflow;
- tracked secret/private-runtime hygiene;
- Codex continuation/handoff state.

Repository inspection and CI do not replace target-PC, physical, login, browser, Sonor, or real integration evidence.

## Concrete findings fixed by the final audit

### PR #147 — nested browser runtime provenance

Merge commit:

`5338f3f184ab84102f635dfb89255e090b43dba9`

Finding:

- the browser release bundle bound its top-level commit to the current repository commit;
- however, a manually altered bundle could carry a stale `runtime.commit` inside an individual scenario.

Fix:

- bundle creation and validation now require every embedded scenario runtime to match the expected clean commit;
- start/completion runtime verification flags are required for every scenario;
- regression coverage rejects stale/tampered nested runtime commits.

CI: **SUCCESS**

### PR #148 — paid-cloud transport security

Merge commit:

`95b2d6e8d82dae4da85650609650e72a5a14c8ef`

Finding:

- the optional cloud provider is explicit opt-in, but a misconfigured remote `http://` endpoint could receive the configured Bearer API key over cleartext.

Fix:

- non-loopback cloud endpoints require HTTPS;
- loopback HTTP remains allowed for local/test-compatible providers;
- credential-bearing provider URLs are rejected;
- status fails closed before sending a request when the URL is unsafe.

CI: **SUCCESS**

### PR #149 — exact GitHub remote verification

Merge commit:

`542e5f7494c23b525eccf38a503adf330b7a7cfc`

Finding:

- GitHub push verification previously accepted a remote string when it merely contained a `github.com`-looking substring.

Fix:

- HTTPS/SSH URLs must resolve to the exact hostname `github.com`;
- canonical `git@github.com:owner/repo.git` remains supported;
- HTTP, embedded credentials, lookalike hosts and path-substring bypasses are rejected.

CI: **SUCCESS**

### PR #150 — full owned process-tree STOP

Merge commit:

`32f3f8f340a6bfc4004c5b4eeedd116682dae854`

Finding:

- direct `child.kill()` cancellation could leave descendant work running, especially on Windows when Codex/npm/git spawned additional processes.

Fix:

- shared owned-process-tree termination helper;
- Windows uses `taskkill /PID <pid> /T /F` with direct-child fallback;
- POSIX owned subprocesses use a dedicated process group and group termination;
- Codex timeout/completion/STOP and bounded process STOP/output-limit paths use the same helper;
- regression coverage proves descendant termination on CI and locks the Windows tree-kill contract.

CI: **SUCCESS**

## Verified repository conclusions

The audit found the following repository properties to be fail-closed or conservatively implemented:

- approval required by default;
- shell, file writes, external actions and paid cloud disabled by default;
- Level-3 approvals are scoped/single-use and cannot exceed an internal permission ceiling;
- Level-4 normal execution remains unavailable;
- Tool Registry enforces side-effect permission floors independently of planner output;
- project file reads/writes use registered workspaces, realpath checks and sensitive-path restrictions;
- writable symlink targets fail closed;
- private release evidence rejects path/symlink escapes from real `.astra/`;
- release PASS evidence is hash/size checked again by the core report;
- target/runtime/browser evidence is tied to clean build identity;
- public web fetch pins DNS, rejects private/reserved addresses and revalidates redirects;
- Sonor and SearXNG transports remain loopback-constrained;
- ASTRA and Ollama Windows startup scripts reject non-loopback listeners;
- Windows update uses fast-forward-only Git and preserves private runtime state;
- API mutation surfaces use loopback Host, same-origin/cross-site protection, ASTRA client header, JSON content type and bounded request bodies;
- CI uses read-only repository permissions and runs build, tests, typecheck, lint, high-severity dependency audit and diff checks;
- current tracked tree contains no real `.env.local`, credentials, private key, auth file or `.astra/` runtime evidence.

## GitHub repository governance note

At audit time:

- `main` branch protection: **OFF**;
- repository rulesets: **none**.

This does not invalidate ASTRA runtime behavior, but GitHub administrators should enable repository protection so direct pushes cannot bypass the intended PR + CI workflow.

Recommended repository setting:

- require pull request before merge;
- require the ASTRA CI check;
- block force pushes;
- block branch deletion.

The available ChatGPT GitHub connector does not expose a branch-protection/ruleset mutation, so this remains a manual GitHub administrator setting rather than a source-code task.

## Remaining gates that are not repository-verifiable

These are still **NOT PASS** until real target evidence exists:

1. Phase 14 — real Automation Level-2/3 approval and STOP.
2. MEM-X — real Sonor/Graphify/Obsidian endpoint, provenance, fallback and cancellation.
3. Phase 16 — real target runtime/browser/Humanoid HIGH measurements.
4. Phase 17 — real scenarios A–E, approved actions where configured, failure variants and emergency STOP.
5. Phase 19 — real Windows install/startup/update/reinstall and preservation checks.
6. Phase 20 — final report generated only from the resulting private evidence.

Recommended target-PC start:

```powershell
git switch main
git pull --ff-only
npm run release:repo-gate
powershell -ExecutionPolicy Bypass -File .\scripts\windows\collect-target-pc-evidence.ps1 -IncludePerformance -IncludeChatPreflight -Provider auto
```

Then follow:

- `docs/AUTOMATION_VALIDATION.md`;
- `docs/SONOR_CODEX_MISSION.md`;
- `docs/BROWSER_PERFORMANCE_EVIDENCE.md`;
- `docs/FULL_SYSTEM_VALIDATION.md`;
- `docs/MANUAL_RELEASE_EVIDENCE.md`;
- `docs/CORE_RELEASE_REPORT.md`.

## Final repository-side audit status

`REPOSITORY AUDIT COMPLETE THROUGH PR #150 / CI VERIFIED / NO ADDITIONAL CONCRETE REPOSITORY DEFECT IDENTIFIED IN THE AUDITED RELEASE-SECURITY SCOPE / REAL TARGET-PC GATES REMAIN`

Do not use this statement as a target-PC release PASS. A Phase 20 `READY` status still requires the real evidence described above.
