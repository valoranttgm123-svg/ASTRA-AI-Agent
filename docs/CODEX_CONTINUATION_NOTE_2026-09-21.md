# ChatGPT → Codex Continuation Note — 2026-09-21

This note records the repository truth after merged PRs #123–#126 so a later Codex session can continue without reconstructing the latest state from chat.

## Current merged repository state

Merged on `main`:

- PR #123 — conservative Phase 20 core release report tooling;
- PR #124 — private browser/Humanoid HIGH performance evidence capture;
- PR #125 — safe manual Phase 20 gate recorder;
- PR #126 — Phase 20 report context recorder.

These additions improve evidence collection/reporting only. They do **not** prove target-PC readiness by themselves.

## What remains genuinely external / target-PC gated

Do not mark these PASS from code inspection, CI, or repository state alone:

1. Phase 14 Automation approval + STOP validation on the real Windows target PC.
2. MEM-X real Sonor / Graphify / Obsidian audit and end-to-end provenance validation.
3. Phase 16 real target-PC/browser measurements, including Humanoid HIGH captures.
4. Phase 17 real scenarios A–E, including approved actions and emergency STOP.
5. Phase 19 real install / startup / update / reinstall / loopback verification.
6. Phase 20 final report status based on real private evidence.

## Safe first command on the target PC

From the real ASTRA repository root:

```powershell
git switch main
git pull --ff-only
powershell -ExecutionPolicy Bypass -File .\scripts\windows\collect-target-pc-evidence.ps1
```

That collector is read-only and must not be interpreted as completing the manual/physical gates.

## Browser/Humanoid evidence

Open:

`http://127.0.0.1:3017/lab/humanoid`

Set `QUALITY HIGH`, then capture at minimum:

- IDLE
- LISTENING
- THINKING
- SPEAKING
- Assembly
- Shockwave

Use `PERF CAPTURE`. Evidence is stored privately under `.astra/performance/`.

Do not mark `browser-humanoid-performance` PASS until the real captures and browser console state are reviewed.

## Phase 14 Automation validation

Run the documented real target-PC validation:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\validate-automation.ps1
```

Optional safe tick remains explicit. Also verify:

- Level-2 due occurrence stays approval-gated;
- Level-3 exact scope + single-use approval;
- STOP during a genuinely running owned occurrence;
- no late success event after STOP.

## Recording Phase 20 evidence

Use the safe recorder instead of editing final release status manually:

```powershell
npm run release:record-gate -- --gate <gate-id> --status <PASS|FAIL|NOT_RUN> [--evidence <private-path>] [--note "<text>"]
```

Required gate IDs:

- `automation-approval-stop`
- `sonor-graph-memory`
- `browser-humanoid-performance`
- `full-system-approved-actions`
- `emergency-stop`
- `windows-install-update-reinstall`

Record report labels separately:

```powershell
npm run release:record-context -- --connected "Ollama,Codex CLI" --requires-login "..." --not-implemented "..." --external-config-required true
```

Only record labels that are true on the target environment. Never put credentials/secrets in labels or notes.

Then generate the report:

```powershell
npm run release:core-report
```

Missing/incomplete evidence must remain `BLOCKED`.

## What Codex should improve when local evidence is unavailable

Codex may continue only repository-side work that is independently useful and does not fabricate evidence. In particular:

- audit PR #123–#126 tooling for missing regression coverage or inconsistent docs;
- keep AGENTS / tracker / worklog / handoff / release checklist synchronized;
- improve error handling, validation, redaction, path confinement, and deterministic report generation if a concrete defect is found;
- improve target-PC runbooks or evidence parsing when supported by tests;
- reconcile any newly opened stale PR/branch before release;
- fix real repository/test/build/lint/typecheck/audit failures.

Codex must **not**:

- invent benchmark values;
- invent Sonor/Graphify/Obsidian endpoint success;
- mark physical STOP/approval gates PASS without real evidence;
- infer install/update/reinstall success from scripts existing in GitHub;
- choose READY merely because repository tooling is complete;
- start Phase 21–30 as a substitute for unfinished Phase 18–20 release evidence.

## Resume rule

If the user says only:

`lanjutkan yang belum selesai`

Codex should:

1. read current `main`;
2. read `AGENTS.md`;
3. read `docs/CODEX_PROGRESS_TRACKER.md`;
4. read `docs/ASTRA_WORKLOG.md`;
5. read `docs/CODEX_HANDOFF.md`;
6. read `docs/CODEX_NEXT_MISSION.md`;
7. read this note;
8. select the first unfinished task that is implementable in the available environment;
9. validate, PR, merge, and update repository truth;
10. stop only when every remaining task genuinely requires target-PC/user/external access.

The objective remains: truthful, safe, recoverable, and ready for daily use — never fake READY.
