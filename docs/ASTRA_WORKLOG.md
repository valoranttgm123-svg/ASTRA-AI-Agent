# ASTRA DURABLE WORKLOG

## 2026-09-24 — safe parallel work saturation checkpoint

- Completed the private SSH/evidence leak audit (PASS) and authoritative status-drift cleanup on draft PR #241.
- Status-drift cleanup CI passed on head `7fad5efb854fac93c847bef45a76406cb78cd7dd`.
- Reviewed remaining safe parallel opportunities and intentionally stopped adding duplicate runbooks/checklists.
- ChatGPT repository-side parallel work is now `SATURATED_WAITING_FOR_TARGET_EVIDENCE`.
- Next repository action must be triggered by new Codex PASS/FAIL/BLOCKED evidence, a reproduced repository defect, completion of the active target checkpoint, or an owner requirement change.
- `main` remains unchanged.

## 2026-09-24 — authoritative status-drift cleanup

- Audited current authoritative draft docs for stale multi-PC/PR #239 language.
- Updated current pointer, collaboration baseline, Codex mission and multi-PC handoff to the post-bootstrap reality: PC1 LOCAL; three remotes privately registered/marker-validated; remaining deep remote evidence only.
- Marked old PR #239/#233/full-audit handoff snapshots that still looked ACTIVE as HISTORICAL/SUPERSEDED instead of rewriting chronological evidence.
- Preserved ASTRA_WORKLOG historical entries as history.
- No runtime code and no `main` state changed.

## 2026-09-24 — private SSH/evidence leak audit

- Scanned all 15 current PR #241 files plus five SSH/config core files directly on the draft branch.
- Checked current private alias strings, private-key material, IdentityFile/key paths, RFC1918 addresses, obvious credential assignments and literal SSH user@host topology.
- Result: PASS; no matching private topology/credential material was found in the inspected public/draft scope.
- Exact aliases/topology remain private and private evidence remains under gitignored `.astra/`.
- No runtime code and no `main` state changed.

## 2026-09-24 — owner mandates checkpoint after every completed task

- Owner explicitly requires a durable checkpoint after every completed ASTRA work slice.
- Rule applies equally to ChatGPT and Codex.
- Checkpoint must be written before the next task begins and must include completion, validation, state, exact next action and DO NOT REPEAT scope.
- During commit-bound evidence freeze, checkpoint updates remain on the active draft branch/PR rather than moving `main`.
- Collaboration protocol, session recovery, current pointer and handoff were updated accordingly.

## 2026-09-24 — additional draft evidence/release preparation

- Added a public-safe multi-PC evidence result template; real topology/results remain private under `.astra/`.
- Added a final release freeze checklist aligned with ASTRA's same-commit runtime/evidence requirement.
- Added a post-Codex reconciliation checklist so target evidence cannot remain only in chat/PR comments.
- Compared 12 recent merged documentation/fix branches against current `main`; all currently have `ahead_by = 0` and are only future cleanup candidates.
- No branches were deleted and `main` was not moved. All work remains on draft PR #241.

## 2026-09-24 — safe parallel evidence/release preparation

- On draft PR #241, ChatGPT prepared a target evidence runbook for the remaining multi-PC gates without changing runtime code or `main`.
- Prepared a final release execution matrix that orders M1-M6, extended JARVIS phases and NVIDIA real-backend gates without duplicate work.
- Prepared a branch hygiene plan from current branch-family inventory; no deletion is authorized during active target evidence.
- These artifacts remain draft-only so Codex can continue target work without moving the commit used for evidence.

## 2026-09-24 — exact-build evidence freeze prepared

- Live repository review after Codex PR #239 found stale pointer/mission instructions that still told Codex to repeat install/SSH verification/bootstrap already completed on PC1.
- Release documents require the running ASTRA build, repository gate/evidence and clean repository HEAD to match the same commit throughout official capture.
- ChatGPT therefore prepared a collaboration rule that freezes `main` during official commit-bound target/release evidence capture.
- While Codex continues target evidence, ChatGPT cleanup work must remain on branch/draft PR and must not move `main`.
- The draft also advances the current multi-PC mission to administrator/file/service, unreachable/wrong-node, remote STOP/KILL and pinned multi-step evidence.
- No runtime code changes are included.

## 2026-09-24 — PR #239 merged; remote evidence continues

- Codex PR #239 merged as `290164a8787cf895a9c1a32018c700cf8d6ad551`.
- Exact PR head CI passed. CI reported 464 tests, 460 pass, 0 fail and 4 skips; typecheck/lint/build/audit/diff checks passed with 0 dependency vulnerabilities.
- Codex reported the clean production source installed on PC1, startup health in 7,384 ms, default self-check PASS and Windows release-validator PASS.
- Private configuration/project/automation hashes were preserved.
- The private node registry now contains only three individually reverified remote Windows targets; PC1 remains LOCAL.
- Direct ASTRA remote marker checks passed on all three registered remotes and unknown-node fail-closed passed.
- Remaining multi-PC evidence is administrator/file/service control, unreachable/wrong-node behavior, remote STOP/KILL and one pinned-target multi-step task.
- Pointer/handoff/tracker were synchronized because the prior top-level status still incorrectly said PR #239 ACTIVE after merge.

## 2026-09-24 — Codex resumes against the latest ChatGPT handoff

- ACTOR: Codex; STATE: ACTIVE; PR #239.
- Merged current main `63bdd14` (CI #646 SUCCESS) into the existing native probe
  fix, retaining PR #225-#238 transport, hardening and collaboration work.
- Interrupted the older-base repository gate after 453 passing tests; those
  results are not evidence for the combined build. Re-run all gates on the
  exact combined commit, install it, then validate the existing remote transport.
- Earlier morning SSH observations below are historical and need a fresh check.

## 2026-09-24 — native Windows startup inspection

- PR #224 merged `0a0962a3494f066c14eb40850dcb1597e8178c3a`, CI #607/#608
  SUCCESS. Production `ffb4caa` installed; 449 tests and repository gate passed;
  private configuration/project/automation hashes unchanged.
- Real Codex chat and UI STOP passed with deliberate WebGL denial in only the
  test browser. Approved Humanoid image and disabled capture controls verified
  at 390x844, with no browser errors in the final scenario. Not physical HP/HIGH.
- Self-check repeatedly timed out loading the Windows CIM task module despite
  two running startup tasks. Replaced only the read-only query with native COM,
  retaining hidden five-second subprocess and propagating non-missing errors.
- Ten focused tests and live self-check passed; actual child-process probe
  completed in 964 ms. Unknown states no longer produce READY.
- Existing strict SSH aliases identify PC2 and SNRPC2; DeviceSNR DNS fails.
  This is not ASTRA remote transport completion. Sonor unchanged.
- See `WINDOWS_TASK_PROBE_2026-09-24.md`; final PR/build/install evidence must
  be recorded before handoff. Physical and comprehensive gates remain open.

## 2026-09-24 — PC1 confirmed as ASTRA local hub

- Owner confirmed that PC1 is the current PC and ASTRA hub/local machine.
- PC1 must remain LOCAL in ASTRA and must not be duplicated into the private SSH remote-node registry.
- Remaining connected Codex targets are remote candidates only after `ssh -G` and remote `COMPUTERNAME` verification.
- No SSH transport code changed.

## 2026-09-24 — SSH target inventory refreshed from owner evidence

- Owner supplied newer Codex connection evidence showing four PC targets currently connected.
- This supersedes the older physical observation that intended SSH aliases failed name resolution.
- Exact SSH aliases are intentionally not committed because the multi-PC registry/topology is private local configuration.
- Codex must verify the current private aliases with `ssh -G` and remote `COMPUTERNAME`, identify the ASTRA hub/local machine, and bootstrap only true remote targets into the gitignored registry.
- No SSH transport architecture was changed.

## 2026-09-24 — post-remediation fail-closed hardening

- Re-audited current main after PR #235 and found two additional repository hardening opportunities.
- Explicit remote read-only requests now return BLOCKED on remote tool/node failure or unavailability rather than falling through to planner reinterpretation.
- Private computer-node registry now rejects root-level secret-like fields and unsupported root metadata, in addition to the existing per-node strict schema.
- Added root-schema regression tests.
- This is a focused extension of PR #233 hardening, not a replacement Computer architecture.
- Validation passed: 460 tests / 458 pass / 0 fail / 2 Windows-only skips; build/typecheck/lint/audit/diff checks PASS; 0 dependency vulnerabilities.

## 2026-09-24 — stale audit pointer closed

- Post-merge verification found the current pointer still contained the original pre-remediation audit defect list below the newer PR #233 completion block.
- Updated the pointer and full-audit banner so historical findings cannot be mistaken for current defects.
- No runtime behavior changed; remaining work is target/runtime/provider evidence only.

## 2026-09-24 — audit remediation PR #233

- Started focused follow-up from the merged full audit; existing Computer/Sonor architecture is preserved rather than rebuilt.
- Direct read-only Computer parsing now carries explicit `PC<n>` or `@node-id` targets into Tool Runtime and rejects ambiguous multiple targets instead of silently defaulting remote intent to LOCAL.
- `computer.system.info` timeout was raised above the SSH 8-second connect bound; local execution still returns immediately when fast.
- Multi-PC node config now recursively rejects secret-like keys and rejects unsupported top-level fields.
- SSH trust bootstrap now writes a sibling temp file, parses it back for validation, atomically replaces/moves the final registry, and cleans temp state.
- Added regression tests for remote target parsing, timeout compatibility, nested secrets/unknown fields and atomic bootstrap semantics.
- Canonical MEM-X docs now preserve already-validated Sonor retrieval/project scope/Graphify/Obsidian provenance and leave only degradation/cancellation/Diagnostics/release evidence pending.
- NVIDIA and JARVIS tracker duplication/non-task checkbox drift was normalized; historical recovery branch wording was relabeled.
- Safe warning cleanup removed unused non-visual code/imports and made Humanoid V9 gesture dependencies explicit. Approved raw image rendering was not changed merely to silence optimization warnings.
- PR #233 newest-head CI passed and merged as `52135e16f4113460807ff9005a72ba7efc53d911`. Repository remediation is complete; remaining work is target/runtime evidence.

## 2026-09-24 — full repository/runtime-readiness audit

- Audited current main, open PRs/issues, PR #217-#231 merge/CI state, collaboration docs, execution trackers, release/security/performance docs, multi-PC code, SSH bootstrap, Tool Runtime timeout/cancellation, and latest CI logs.
- Full findings are durable in `docs/FULL_AUDIT_2026-09-24.md`.
- Confirmed no open PR/issue at audit start; PR #217-#231 merged; latest #231 PR-head CI passed build/tests/typecheck/lint/audit/diff with 457 tests, 455 pass, 0 fail, 2 Windows-only skips and 0 vulnerabilities.
- Found concrete repo defects: direct remote read target can be dropped to LOCAL; system-info 5s timeout conflicts with SSH 8s connect timeout.
- Found continuity drift: stale broad Sonor/MEM-X status in authoritative docs, duplicate NVIDIA checklist gates, historical active/current wording, and overlapping/non-task tracker boxes.
- Found hardening/maintenance items: bootstrap write is fail-all-before-write but not true temp+replace atomic; nested secret-like node fields are not recursively rejected; CI/build warnings remain.
- Target runtime is not proven to match exact current main. Do not capture final PC2-PC4/release evidence until repository follow-ups merge and the clean target build is updated.

## 2026-09-24 — improvement acceptance clarification

- Owner clarified that the no-competition rule must not block good Codex ideas.
- Codex should refine existing ChatGPT work by default, but a clearly better evidence-backed design is welcome and should be adopted when it materially improves correctness, security, reliability, maintainability, performance, UX, compatibility or simplicity.
- Replacement without reason remains prohibited; superior validated refinement is explicitly allowed.
- Any replacement/refactor must document the current problem, proposed improvement, evidence, preserved work/tests, migration risk and validation result.

## 2026-09-24 — no-competition ChatGPT ↔ Codex work division

- Owner clarified that ChatGPT and Codex must not compete for or duplicate the same ASTRA work.
- ChatGPT owns every safe repository task it can perform and verify; anything it cannot truthfully finish must be handed to Codex with a precise trail.
- Codex must refine/finish an incomplete ChatGPT implementation against the real target/runtime/provider rather than start a parallel replacement by default.
- If one agent has ACTIVE work, the other must inspect that branch/PR/handoff before touching the same subsystem.
- Parallel execution is reserved for clearly independent slices.
- Every transfer now records completed scope, unfinished scope/reason, branch/PR/commit, validation, blocker, exact next action and DO NOT REPEAT boundaries.

## 2026-09-24 — ChatGPT ↔ Codex cross-session collaboration rule

- Owner identified a recurring continuity failure: after interrupted/new ChatGPT sessions, completed or blocked work could be repeated and roadmap state could lag behind actual changes.
- Added the mandatory `docs/ASTRA_COLLABORATION_PROTOCOL.md` so GitHub, not conversational memory alone, is the durable ASTRA project memory.
- Both ChatGPT and Codex must inspect live main/CI/open PRs before work, preserve active/blocked branches, and never recreate merged work without concrete regression evidence.
- Every meaningful change must update `CURRENT_EXECUTION_POINTER`, `JARVIS_PROGRESS_TRACKER`, `ASTRA_WORKLOG` and the relevant handoff/validation document in the same work slice.
- Required states distinguish DONE, REPO_DONE_TARGET_PENDING, ACTIVE, BLOCKED, NOT_STARTED and SUPERSEDED.
- New-session shorthand such as `lanjutkan` means recover from repository truth and continue; the owner must not be asked to reconstruct old chats.

## 2026-09-24 — WebGL-denied browser refinement

- PR #223 merged `bc0d2d450c921ec9aaa86bf686c118c7271228d4` after CI #605;
  main CI #606 passed. Clean production `1d3fd72` installed with private data
  hashes unchanged. Full local gate passed 446 tests, typecheck, lint, build,
  audit (zero vulnerabilities), diff check; PR comment stores target results.
- Live browser had 10 WebGL errors at load, 18 after toggling voice output and
  28 after changing provider. Async R3F context creation bypassed the intended
  render boundary; ordinary rerenders retried a browser-blocked context.
- Added a one-time WebGL2 availability probe before R3F mounting, retaining
  the existing SVG ring and original humanoid artwork when unavailable.
- Disabled 3D evidence capture without an available renderer/GPU observation.
  Quality parameters, artwork, providers, permissions and Sonor are unchanged.
- Recheck a clean production build in a real browser after merge. Fallback is
  not a claim of real hardware HIGH rendering or physical voice readiness.

## 2026-09-24 — runtime recovery after PR #222

- Inspected main `0b07a4c`, CI #604 SUCCESS, no open PR, clean checkout.
- Reproduced HTTP 500 (`node:child_process` in Edge instrumentation compilation)
  on the active development server; Ollama task had exited `3221225786` and
  port 11434 had no listener.
- Moved Node startup dependencies behind an explicit compile-time Node guard;
  retained background preload and existing Automation opt-in policy.
- Isolated the Ollama server in a hidden console and added independent provider
  readiness, preventing healthy Hermes from being counted as healthy Ollama.
- Added regression coverage. Development HTTP recovery, live Ollama 0.34.2 and
  `ASTRA_OWNER_DIRECT_OK` completed locally with routing-only/no memory/no planner.
- Production validation/PR result must be recorded against the final clean SHA;
  see `RUNTIME_RECOVERY_2026-09-24.md`. No Sonor data or permission flags changed.

## 2026-09-23 — measured Ollama prompt-prefill correction

Resumed from installed PR #213 / main CI #584, not the older Windows checkpoint.
Real SSE measured Ollama first token 10.6 s then 0.27–0.34 s warm, Codex about
6.2 s, AUTO 6.7 s through its configured Codex preference, and NVIDIA no token
within 60 s. A direct boundary trace isolated 6.8 s uncached prompt evaluation
against only 3.5 ms model loading. Reduced the existing context-free lightweight
prompt from 552 to 108 tokens; direct first token improved from 6.9 to 2.7 s.
Full project/security context, input metadata and provider preference remain.
No private text, credentials, graph data or runtime configuration is committed.
Clean-build production remeasurement and remaining manual release gates follow.

## 2026-09-23 — target-PC refinement in progress

PR #189 merged after CI #530 SUCCESS as
`2a5d2c40cddfa811c27b59aae2bfcf1795d28d8c`. Real mobile viewport, browser STOP,
Sonor scope/provenance and negative Level-2 approval checks are recorded in
`TARGET_PC_REFINEMENT_2026-09-23.md`. Follow-up fixes address observed Windows
console-interruption shutdowns, a too-short startup probe and repository-gate
npm EINVAL. No physical/approved-execution/full-release PASS is implied.

Merged the green Sonor evidence PR #188 (`35ab5aa7398f6d3c2afbc0119baf9f690247040e`, CI #528 SUCCESS).
Reconciled current main with the local Windows/provider/mobile fixes; see
`TARGET_PC_REFINEMENT_2026-09-23.md`. Local tests pass at the recorded scope;
the implementation PR and new-build runtime gates are still pending.

> Repository-owned chronological execution history.
>
> This file exists so Codex, ChatGPT, or a new local session can recover the project without relying on conversation history.
>
> Update this file after every merged implementation slice, security finding, release gate, or meaningful external validation.

## Recovery truth

Current merged `main` checkpoint before the active reconciliation PR:

- PR #170: `10bc9f57aeeed4431207a11f8b3626e07560c505`;
- Phase 15 repository hardening: **merged / CI verified**;
- Phase 16 runtime + Humanoid/browser evidence tooling: **merged / CI verified**;
- Phase 17A safe validation preflight: **merged / CI verified**;
- Phase 18–20 repository release/evidence tooling: **merged / CI verified**;
- Phase 19A–19G Windows repository tooling/hardening: **merged / CI verified**;
- NVIDIA MAX provider-neutral repository contracts: **merged / CI verified**;
- JARVIS repository foundations Phase 24/25/28/22/27/29: **merged / CI verified**;
- active reconciliation PR #171 recovers the missing Phase 16 main-UI evidence instrumentation and normalizes cross-session handoff;
- Phase 14 target-PC validation: **still required**;
- MEM-X real Sonor/Graphify/Obsidian validation: **still requires target-PC/local access**;
- Phase 16 real measurements, Phase 17 real scenarios, Phase 19 real Windows evidence and Phase 20 final report: **still required**.

## Durable milestone log

| Phase / Slice | PR | Merge commit | CI / Verification | Result / next |
| --- | ---: | --- | --- | --- |
| 14A Automation foundation | #81 | `e6d8b7a...` | CI verified | Scheduler/contracts safety foundation |
| 14B private automation store | #82 | `76d7d8d...` | CI verified | Durable private store |
| 14C1 bounded queue | #83 | `8eea45b...` | CI verified | Ready vs approval queue |
| 14C2 runner | #84 | `0fdddbd...` | CI verified | Cancellable at-most-once runner |
| 14D1 API + telemetry | #85 | `4fe5691334f2cf7ec830ad5849be05ba416af421` | CI verified | Loopback management + events |
| 14D2 approval-resume | #86 | `c282456173ca5a249463ce24ab6fe296fd3c1785` | CI verified | Exact occurrence Level 2/3 approval |
| 14D3A SSE | #87 | `8f768ce3e51c6caa36d27e1ae08abeba8fe2157f` | CI verified | Automation stream |
| 14D3B1 Runtime integration | #88 | `2dad2930b6f119dca1fa2d6427f0c5a8c955fa55` | CI verified | Shared Runtime/event bus |
| 14D3B2 panel | #89 | `8ece8be0bb548ba388b4b95f9605dd3f8964068a` | CI verified | Safe Automation UI |
| 14E1 read-only Brain ceiling | #90 | `fc166876ce113c388f06a89fb1ea263f62cbdd93` | CI verified | Hard internal Level 0/1 ceiling |
| 14E2 opt-in service | #91 | `feb442e2ee754279768531ea760a8ab8079e4bdc` | CI verified | Default-OFF local service |
| 14E3 final Automation integration | #92 | `de4fbefe6f9a23792a542a74d4d0ca1aef1aa208` | PR CI success; main CI success | Phase 14 implementation complete; target-PC validation remains |
| Codex mission handoff | #93 | `0f16be59b4268aa5c00fa3b0685b4b58f7b4262e` | CI verified | Phase 15–30 execution plan stored |
| Codex entrypoint | #94 | `1ad2831159e5d658158516e688d17618e6c53299` | CI verified | `AGENTS.md` points to current mission |
| One-line resume | #95 | `4e97211030a1259730b2c339a7aecad05b93005c` | CI verified | `lanjutkan yang belum selesai` is sufficient |
| 15A path/filesystem hardening | #96 | `125821b8edaa8dfc4d1137f26109ad24a9e394db` | CI verified | Dangling writable symlink fail-open closed |
| 15B untrusted retrieval boundary | #97 | `972dd2feb2659eb8dde9eccfcdb928c9acbccef4` | CI + post-merge main CI success | Retrieval/tool outputs are evidence, not authority; next P15C |

## Important security findings already fixed

### Phase 15A — dangling writable symlink

Previous behavior:
- `realpath()` failed for a dangling symlink;
- write resolver catch path could treat it like a safe new file.

Fix:
- `lstat()` distinguishes a real missing path from an existing symlink;
- existing writable symlinks fail closed;
- non-`ENOENT` failures fail closed;
- regression coverage lives in `tests/security-paths.test.ts`.

### Phase 15B — retrieved-content authority confusion

Previous behavior:
- local/project/Sonor memory was blended into provider context as ordinary text;
- provenance existed, but retrieved instruction-like text did not have one shared explicit authority boundary.

Fix:
- `lib/brain/context-safety.ts`;
- memory/project/Sonor/Graphify/Obsidian records become provenance-preserving JSON data;
- provider prompts state retrieved data cannot override ASTRA policy, approvals, project scope, privacy or tool authorization;
- prior plan/tool outputs are also marked UNTRUSTED DATA;
- regression coverage lives in `tests/context-safety.test.ts`.

## External/local gates that must not be faked

### Phase 14 target-PC validation

Still required:
- `scripts/windows/validate-automation.ps1`;
- optional explicit `-RunSafeTick`;
- Level-2 due occurrence remains approval-gated;
- Level-3 exact scope/single-use approval;
- STOP during real running occurrence;
- UI/service truth.

Until that occurs, report:

`PHASE 14 IMPLEMENTATION COMPLETE / CI VERIFIED / TARGET-PC VALIDATION REQUIRED`

### Sonor / Graphify / Obsidian

Still requires inspection of the real local system.

Do not:
- rebuild Sonor;
- guess endpoint paths;
- upload private graph DB/indexes;
- upload private Obsidian vault data;
- fake `graphify`/`obsidian` provenance.

Follow `docs/SONOR_CODEX_MISSION.md`.

## Next exact repository work

1. when target-PC access is available, execute the real Phase 14 Automation validation and Phase 19 Windows evidence commands;
2. audit/validate the real existing Sonor / Graphify / Obsidian stack exactly as documented; do not rebuild or fake it;
3. run Phase 16 target-PC/browser measurements and record real evidence;
4. run Phase 17 real full-system scenarios including STOP;
5. complete Phase 18 RC only after all required repository and local gates are truthful;
6. prepare/fill the Phase 20 report only from real evidence;
7. continue Phase 21–30 after the core gate is stable.

## Worklog update rule

Every merged feature/security slice must append:

- date;
- phase/slice;
- PR number;
- merge commit;
- CI status;
- files/components materially changed;
- important bug/security finding fixed;
- external validation still missing;
- exact next task.

Never mark local/physical verification PASS from repository inspection alone.

## Phase 15C1 — MCP failure isolation

- PR: **#99**
- merge commit: `6551a9b8537986251382495d6e39832e5bcf96e2`
- CI: **SUCCESS**
- result: optional MCP server failure no longer destroys native/healthy runtime; descriptor/call data is validated; permission floors and AbortSignal behavior are covered.
- next: **P15C2 provider outage/malformed-response matrix**.

## Phase 15C2 — provider failure matrix

- PR: **#100**
- merge commit: `c3d2398ad6a463a9fda4e4345aecf415db0a9f81`
- CI: **SUCCESS**
- result: P15C provider/MCP failure isolation complete; malformed/outage responses fail closed and provider readiness is payload-validated.
- next: **P15D Cancellation / timeout / network failure matrix**.

## Phase 15D1 — cancellation/timeout matrix

- PR: **#101**
- merge commit: `beec046f16142d75d5c27deca3e9acbb27cf584d`
- CI: **SUCCESS**
- result: provider STOP/timeout distinction and authoritative Tool Runtime timeout are covered.
- next: **P15D2 Codex child-process + Automation/Command Center STOP settlement**.

## Phase 15D2 — Codex STOP + runtime settlement

- PR: **#102**
- merge commit: `5d182999b7bcf3e63a560a06b2a2bb4a68b5405c`
- CI: **SUCCESS**
- result: Phase 15D complete; Codex owned child cleanup and Automation/Command Center STOP settlement are verified.
- next: **P15E Secret / error / telemetry leakage hardening**.
## Phase 15E — secret/error/telemetry hardening

- PR: **#103**
- merge commit: `5ee3f69e934712c19ca6b2733a9311a5fc1c0633`
- CI: **SUCCESS**
- result: shared public error/status/telemetry redaction boundary merged; fake-secret regression coverage passes.
- next: **P15F final security regression matrix/report**.
## Phase 15F — final security regression/report

- PR: **#104**
- merge commit: `d5e0b27e35584aa0ccd9ffb69f16e82134ac0eb2`
- CI: **SUCCESS**
- result: Phase 15 repository hardening complete; final matrix/report merged.
- truthful status: `PHASE 15 REPOSITORY HARDENING COMPLETE / CI VERIFIED / LOCAL RELEASE GATES REMAIN`
- next implementable repository work while MEM-X is externally blocked: **Phase 16 performance instrumentation/preparation**.

## Phase 16A — performance measurement instrumentation

- PR: **#105**
- merge commit: `dcc639bdd5fbe7254ee5a9922ee604fe581d8d55`
- CI: **SUCCESS**
- result: loopback runtime measurement harness, P50/P95 statistics and ASTRA SSE timing instrumentation merged.
- truth boundary: no target-PC/browser benchmark value is claimed.
- P16B/P16C remain local target-runtime gates.

## Phase 17A — safe full-system preflight

- PR: **#106**
- merge commit: `308406518db695f85554fbbf993a09c34fda606b`
- CI: **SUCCESS**
- result: privacy-preserving chat-mode preflight evidence runner for scenarios A–D merged.
- truth boundary: no Phase 17 scenario PASS is claimed; target-runtime real execution remains required.

## Repository cleanup — PR #51 audit

- audit PR: **#107**;
- compared `astra/v15-brain-streaming-telemetry` against current `main`;
- old branch: 16 commits ahead of its historic base, 621 commits behind current `main`;
- no unique unsuperseded production behavior/test identified;
- old NDJSON/`AsyncLocalStorage` telemetry is superseded by SSE/`onEvent`;
- audit: `docs/PR51_TELEMETRY_AUDIT.md`;
- next: merge audit documentation, then close PR #51 as superseded.

## Repository cleanup — final status

- PR #51: **closed as superseded**;
- audit: `docs/PR51_TELEMETRY_AUDIT.md`;
- open PR count after closure: **0**;
- current tree secret/private-path audit: **no suspicious tracked path matched**;
- historical branches remain intentionally as non-blocking snapshots;
- cleanup evidence: `docs/REPOSITORY_CLEANUP.md`;
- next repository-side work may prepare release/readiness tooling, but Phase 16/17 cannot be marked PASS without target-runtime evidence.

## Phase 19A — read-only readiness self-check

- PR: **#109**
- merge commit: `a398bfffc385e825d298fd52605c7b0392fc7287`
- CI: **SUCCESS**
- result: read-only runtime readiness self-check + Windows wrapper merged.
- truth boundary: target-PC readiness remains unverified until the self-check and remaining local gates are actually executed.

## In-flight checkpoint — Phase 19B

- PR: **#110**;
- branch: `astra/phase19b-update-reinstall-tooling`;
- scope: Windows fast-forward-only updater + non-destructive reinstall/repair wrapper;
- update rejects tracked local changes and branch mismatch;
- updater never runs `git reset` or `git clean`;
- pre-existing `.env.local` and `.astra/` presence is checked after update/reinstall;
- project files and Ollama models are not deleted by reinstall;
- self-check runs after successful update/reinstall;
- static regression tests lock destructive-command/private-path invariants;
- target-PC update/reinstall behavior remains unverified until actually executed.


## 2026-09-21 — Phase 19B–19G repository catch-up

Merged repository slices now present on `main`:

- P19B — PR #110 — safe fast-forward-only update and non-destructive reinstall/repair tooling;
- P19C — PR #115 — read-only Windows install preflight;
- P19D — PR #113 — read-only Windows release invariant validator;
- P19E — PR #114 — ASTRA-managed Ollama forced to loopback-only startup;
- P19F — PR #116 — ASTRA loopback runtime listener/identity hardening;
- P19G — PR #117 — bounded startup health gate replacing fragile fixed sleeps.

P19G merge commit:

`42657c7affc776057178416c5e777de388b98787`

Truth boundary:

- these are repository/tooling results;
- they do not prove the target Windows PC passes install/update/reinstall/startup;
- they do not complete Phase 14 local Automation validation;
- they do not prove Sonor/Graphify/Obsidian connectivity;
- they do not substitute for real Phase 16/17 evidence.

Open repository work:

- draft PR #111 (Phase 18A repository RC gate) has successful branch CI but predates later Phase 19 merges; reconcile it against current `main` before merging.


## 2026-09-21 — Phase 18A current-main repository RC gate

- PR: **#119**
- merge commit: `6ac2b98e6f99be68b75769654e78200f54d25fac`
- CI: **SUCCESS**
- added `npm run release:repo-gate`;
- gate runs tests, typecheck, lint, build, high-severity dependency audit and `git diff --check`;
- GitHub CI now uses full history and enforces PR/push diff checks;
- gate command set is explicitly non-destructive;
- stale/diverged PR #111 was closed as superseded rather than merged.
- truth boundary: this completes the repository RC gate implementation only; Phase 16/17/19 target-runtime evidence and Phase 14/MEM-X local validation remain open.


## 2026-09-21 — target-PC read-only evidence collector

- PR: **#121**
- merge commit: `67d6501bd9f61fe1f5819f7541ce5ab3101d26a8`
- CI: **SUCCESS**
- command: `powershell -ExecutionPolicy Bypass -File .\scripts\windows\collect-target-pc-evidence.ps1`
- default collection combines Windows preflight, runtime self-check, Windows release invariant validation and read-only Automation status/safety inspection;
- optional performance uses zero Ollama turns unless separately requested;
- optional Phase 17 chat preflight remains no-write;
- private evidence stays under `.astra/readiness/`;
- release verdict remains `NOT_EVALUATED`;
- manual approval/STOP, Sonor/Graphify/Obsidian, browser/Humanoid and real external-action evidence remain required.


## 2026-09-21 — Phase 20 evidence/report tooling + browser performance capture

### PR #123 — conservative Phase 20 core report tooling
- merge commit: `536acdf4c74c6d98fbae75faee6f2d9a85aa8996`;
- CI: **SUCCESS**;
- `npm run release:core-report`;
- repository-gate PASS evidence is stored privately under `.astra/release/`;
- missing/incomplete evidence yields `BLOCKED`;
- report outputs exact required Phase 20 sections;
- manual PASS requires real private evidence rather than prose claims.

### PR #124 — browser/Humanoid performance evidence
- merge commit: `16dc1836cffca8116c92338a10d4c4cb16d6709c`;
- CI: **SUCCESS** after fixing full `AstraAvatarState` typing;
- Humanoid V15 adds HIGH-quality private `PERF CAPTURE`;
- records frame/FPS, P50/P95/max frame time, slow frames, long-task counts, error/warn counts, viewport/DPR, GPU, optional JS heap, particle/state/effect metadata;
- does not persist prompt/response text, console message text, audio, camera frames, approval tokens or credentials;
- evidence stays under `.astra/performance/` with `NOT_EVALUATED`.

### PR #125 — safe Phase 20 manual gate recorder
- merge commit: `73bc822e2bdbdae9126412c9bf1a07369a6b0098`;
- CI: **SUCCESS**;
- `npm run release:record-gate`;
- only six official manual gate IDs are accepted;
- PASS requires an existing evidence file under `.astra/`;
- final release status is not selected by this command.

### PR #126 — Phase 20 report context recorder
- merge commit: `b687fd0588e96f7fa3e0a60d6e45811797be4fff`;
- CI: **SUCCESS**;
- `npm run release:record-context`;
- records bounded/redacted labels for CONNECTED, REQUIRES USER LOGIN and NOT IMPLEMENTED plus external-configuration-required;
- preserves gate evidence and cannot select READY.

Truth boundary after these merges:

`REPOSITORY EVIDENCE/REPORT TOOLING READY / CORE RELEASE STILL REQUIRES REAL TARGET-PC + PHYSICAL/INTEGRATION EVIDENCE`

Next real work:
1. update/pull current `main` on target Windows;
2. run repository gate and target-PC collector;
3. capture Humanoid HIGH browser scenarios;
4. execute and record manual gates with real evidence;
5. run Phase 17 approved scenarios + emergency STOP;
6. validate real Sonor/Graphify/Obsidian;
7. run `release:core-report` and fix every remaining BLOCKED gate before any READY claim.


## 2026-09-21 — Phase 20 evidence-shape/private-path hardening

- PR: **#129**
- merge commit: `e86fe028f0fa1f0d9f78c5ef5c426cd34ec1f50b`
- CI: **SUCCESS**
- files/components materially changed:
  - `lib/release/core-report.ts`;
  - `lib/release/private-output.ts`;
  - `scripts/release/core-report.ts`;
  - `scripts/release/record-manual-gate.ts`;
  - `tests/core-release-report.test.ts`;
  - `tests/release-evidence-path.test.ts`;
  - `docs/CORE_RELEASE_REPORT.md`.
- findings fixed:
  - JavaScript `typeof null === "object"` could let malformed runtime performance evidence count as captured;
  - any non-empty Phase 17 scenario array could previously count as chat-preflight captured instead of requiring completed A–D;
  - lexical-only `.astra/` evidence confinement could allow an inner symlink to resolve outside the private root;
  - directory paths could satisfy existence checks even though release evidence must be a real file.
- final behavior:
  - required runtime status endpoints must contain non-empty finite samples;
  - completion timestamp must be valid;
  - A–D chat-preflight scenarios must all be completed with structured evidence;
  - evidence inputs resolve through realpath and must remain regular files inside the real `.astra/` root;
  - regression coverage locks malformed evidence, partial scenarios, directories and symlink escapes.
- validation:
  - production build PASS;
  - 246 unit/integration tests PASS;
  - typecheck PASS;
  - lint PASS;
  - high-severity dependency audit PASS;
  - PR diff-check PASS.
- external validation still missing:
  - Phase 14 real approval/STOP;
  - MEM-X real Sonor/Graphify/Obsidian;
  - Phase 16 target/browser measurements;
  - Phase 17 real approved scenarios + emergency STOP;
  - Phase 19 install/update/reinstall/startup;
  - Phase 20 final evidence-backed verdict.
- exact next task:
  - use the target PC to collect real evidence; if target-PC access is unavailable, continue only newly discovered concrete repository defects and do not fabricate PASS/READY.

## 2026-09-21 — runtime/build provenance hardening through PR #145

### PR #142 — bind evidence to the running ASTRA build
- merge commit: `ac386507bb8709031a56d3a88d44021afa6a2d22`;
- CI: **SUCCESS**;
- embeds clean Git commit/build state in the production bundle and exposes it through `/api/agent`;
- runtime-performance, Phase 17 preflight and target-PC collection reject a stale/dirty ASTRA build.

### PR #143 — persist target-PC runtime attestation
- merge commit: `35275bcdae68950244f8993684e62079d908b222`;
- CI: **SUCCESS**;
- persists structured runtime identity in private target-PC evidence;
- Phase 20 rejects stale/dirty target runtime, duplicate check names and any recorded non-PASS check.

### PR #144 — verify runtime identity across evidence capture
- merge commit: `8ca527ebccd8a702094eb799721dc2d9165c41c2`;
- CI: **SUCCESS**;
- runtime-performance and Phase 17 preflight verify the same clean running build before and after capture;
- target-PC collector adds a final runtime-build attestation and Phase 20 requires both start/completion provenance.

### PR #145 — bind browser/Humanoid evidence to the running build
- merge commit: `03073fe8a95b7064b059aadcd4b9ff933c8c73e8`;
- CI: **SUCCESS**;
- browser capture verifies `/api/agent` runtime identity before and after sampling;
- save endpoint rejects stale/dirty runtime or repository mismatch;
- browser release bundle rejects captures without current clean start/end runtime provenance.

Repository audit result after PR #145:

`NO KNOWN INDEPENDENT REPOSITORY RELEASE-EVIDENCE TASK REMAINS / REAL TARGET-PC GATES REQUIRED`

Still not proven:
- Phase 14 Automation approval/STOP;
- MEM-X Sonor/Graphify/Obsidian;
- Phase 16 real target/browser measurements;
- Phase 17 approved full-system actions + emergency STOP;
- Phase 19 Windows install/update/reinstall/startup;
- Phase 20 final evidence-backed verdict.

Exact next task: continue on the real target PC using `docs/CODEX_CONTINUATION_NOTE_2026-09-21.md`. If target-PC access is unavailable, change repository code only for a newly reproducible concrete defect; do not fabricate evidence or start Phase 21–30 as a substitute.


## 2026-09-21 — final repository audit after PR #145

A fresh end-to-end repository audit was run before target-PC handoff. It found four additional concrete defects beyond the earlier saturation checkpoint.

### PR #147 — nested browser runtime provenance
- merge commit: `5338f3f184ab84102f635dfb89255e090b43dba9`;
- CI: **SUCCESS**;
- every browser release scenario now independently matches the expected clean runtime commit.

### PR #148 — secure optional-cloud transport
- merge commit: `95b2d6e8d82dae4da85650609650e72a5a14c8ef`;
- CI: **SUCCESS**;
- non-loopback cloud endpoints require HTTPS;
- credential-bearing provider URLs fail closed.

### PR #149 — exact GitHub remote host
- merge commit: `542e5f7494c23b525eccf38a503adf330b7a7cfc`;
- CI: **SUCCESS**;
- external GitHub push accepts only verified exact `github.com` remotes.

### PR #150 — owned process-tree STOP
- merge commit: `32f3f8f340a6bfc4004c5b4eeedd116682dae854`;
- CI: **SUCCESS**;
- Windows STOP uses process-tree termination rather than direct-child-only cleanup;
- POSIX uses owned process groups;
- descendant termination is covered by regression tests.

Additional audit conclusions:
- tracked secret/private-runtime scan clean;
- API mutation guards remain loopback/same-origin/bounded;
- filesystem/private evidence confinement remains fail-closed;
- CI uses read-only repository permissions and full verification;
- `main` branch protection is OFF and repository rulesets are empty; this is a manual GitHub governance recommendation because the available connector cannot configure repository protection.

Final repository-side audit status:

`REPOSITORY AUDIT COMPLETE THROUGH PR #150 / CI VERIFIED / NO ADDITIONAL CONCRETE REPOSITORY DEFECT IDENTIFIED IN THE AUDITED RELEASE-SECURITY SCOPE / REAL TARGET-PC GATES REMAIN`

Detailed audit: `docs/FINAL_REPOSITORY_AUDIT_2026-09-21.md`.

Exact next task: continue on the real target PC with Phase 14, MEM-X, Phase 16, Phase 17, Phase 19 and then Phase 20 evidence/reporting. Do not mark any of those gates PASS from repository CI alone.


## 2026-09-21 — NVIDIA Nemotron Ultra provider

- PR: **#152**
- merge commit: `c151d9d044829e14f66be84a70d56aaf163ea09c`
- CI: **SUCCESS**
- default model: `nvidia/nemotron-3-ultra-550b-a55b`
- hosted endpoint: `https://integrate.api.nvidia.com/v1`
- integration:
  - explicit `nvidia` provider in ASTRA API/UI;
  - NVIDIA remains OFF by default;
  - AUTO remains local-first unless `ASTRA_NVIDIA_AUTO_FALLBACK=true`;
  - private local/Sonor/project memory remains excluded unless `ASTRA_NVIDIA_INCLUDE_MEMORY=true`;
  - hosted NVIDIA traffic is restricted to the exact NVIDIA HTTPS endpoint; loopback HTTP/HTTPS remains available for self-hosted NIM;
  - NVIDIA reasoning cannot execute side effects or bypass ASTRA Tool Runtime/Codex approval gates;
  - runtime status validates the configured model through `/models`.
- regression coverage:
  - local OpenAI-compatible NIM fixture;
  - explicit NVIDIA routing without silent Ollama/Hermes/Codex substitution;
  - memory/AUTO fallback opt-ins;
  - missing hosted API key;
  - lookalike host / embedded credential rejection;
  - explicit NVIDIA execution remains blocked.
- truth boundary:
  - repository integration is CI verified;
  - real hosted NVIDIA readiness remains **NOT VERIFIED** until a valid `NVIDIA_API_KEY` is added only to target-PC `.env.local` and live runtime status succeeds.
- documentation: `docs/NVIDIA_NIM.md`.

## 2026-09-22 — NVIDIA JARVIS model mesh

- PR #154 merged.
- Merge commit: `ce5a5623867f443ffc931c6b4687b19e38412882`.
- CI run #418: SUCCESS (build, tests, typecheck, lint, dependency audit, diff-check).
- Replaced single-model NVIDIA routing with deterministic profiles:
  - Chief = Nemotron 3 Ultra 550B A55B;
  - Deep = GLM-5.3;
  - Fast = Nemotron 3.5 Lightning 30B A3B;
  - Vision = GLM-5.3 Flash.
- Runtime now reports the actual selected NVIDIA submodel.
- Health status requires the configured mesh models to be present and fails closed when a profile disappears.
- Security/privacy preserved: provider OFF by default, AUTO fallback OFF by default, memory forwarding OFF by default, exact hosted NVIDIA endpoint enforcement, NVIDIA EXECUTE blocked.
- Current multimodal truth boundary remains unchanged: image/camera/screen metadata is not pixel content. Vision is configured for the future real visual transport but is not falsely claimed as current perception.
- Real hosted readiness still requires the user's private target-PC `NVIDIA_API_KEY` and live validation.

## 2026-09-22 — NVIDIA MAX framework started

Owner approved the consolidated NVIDIA architecture as the final NVIDIA direction for ASTRA.

Started branch `feature/nvidia-max-framework` from `main` `f907c3e7e084d52922016a0163965880d77c79e2`.

Repository work completed in the branch so far:
- canonical `docs/NVIDIA_MAX_INTEGRATION.md`;
- `lib/nvidia/catalog.ts` with 10 NVIDIA integration subsystems and phase/exit-gate mapping;
- `lib/nvidia/skill-hub.ts` with bounded on-demand official core skill manifests;
- tests for uniqueness, authority boundaries, phase mapping, bounded routing, research/RAG/voice/vision recommendations;
- `lib/nvidia` included in lint;
- ASTRA MAX roadmap, Codex tracker, session recovery, Codex mission, and handoff updated.

Important: this foundation does not claim AI-Q, Retriever, Voice, DeepStream/VSS, NemoClaw, Guardrails, or Evaluation are connected. Those remain staged work with truthful exit gates.

Next repo task after merge: **NVA-1 Skill Hub discovery/install-state**.

Next target-PC release sequence remains: **Phase 14 → MEM-X → Phase 16 → Phase 17 → Phase 19 → Phase 20**.

## 2026-09-22 — NVIDIA NVA-1 Skill Hub state/cache contract

After PR #159 merged at `e155c75f98da4e07ca3c07b7f15d46ceb655f417`, repository-side NVA-1 continued on `feature/nvidia-skill-hub-state`.

Implemented:
- private bounded NVIDIA skill catalog snapshot cache;
- provider-neutral injected catalog discovery/refresh contract;
- no normal-request HTML scraping;
- private skill truth-state registry under `.astra/`;
- truth states `available / installed / disabled / incompatible`;
- optional source/version/checksum/install/update metadata;
- dry-run install/update/disable/enable/remove plans;
- local mutation requirement fixed at Permission Level 2;
- symlink rejection and bounded file sizes;
- cancellation-aware catalog refresh;
- regression tests for malformed/duplicate data, state truth, persistence, dry-run policy, cancellation, and symlink targets;
- `.env.example` documents private catalog/registry paths.

Not claimed:
- no NVIDIA skill is actually installed by this repository slice;
- no target-PC Codex skill mechanism has been verified yet.

Next repository task after merge: **NVA-2 AI-Q provider-neutral adapter contract**.
Next target-PC NVA-1 task: validate the supported NVIDIA/Codex skill install mechanism and install only approved core skills.

## 2026-09-22 — NVIDIA NVA-2…NVA-9 repository contracts

After PR #160 merged at `af7e05e1252b1b80e94b32cfbfedff6f2c7e006b`, started `feature/nvidia-max-subsystem-contracts`.

Implemented provider-neutral contracts:
- `lib/nvidia/aiq.ts`;
- `lib/nvidia/retriever.ts`;
- `lib/nvidia/document-intelligence.ts`;
- `lib/nvidia/voice.ts`;
- `lib/nvidia/vision.ts`;
- `lib/nvidia/governance.ts`;
- `tests/nvidia-subsystem-contracts.test.ts`.

Key safety properties:
- AI-Q is bounded/cancellable and can safely fall back to existing ASTRA research;
- Retriever enforces project/namespace isolation;
- Document Intelligence cannot mutate the original;
- Voice STOP/interruption returns to idle and invalid transitions fail;
- Vision requires consent and real positive-byte payload before perception is claimed;
- NemoClaw learned skills begin disabled and cannot increase permission;
- Guardrail decisions never become authorization;
- NVIDIA evaluation cannot select release READY.

No live NVIDIA backend readiness is claimed by this repository work.

If merged green, the NVIDIA repository architecture is intentionally considered saturated. Remaining NVIDIA work requires actual supported backend/runtime/PC evidence and belongs to Codex target-environment execution rather than speculative contract design.

## 2026-09-22 — NVIDIA MAX repository saturation reached

PR #161 merged at `84e5eb6aeb20dbdb737dc6d9ace149adfac73dbb` after full CI success.

Combined NVIDIA repository state:
- PR #159: canonical MAX framework/roadmap + bounded Skill Hub foundation;
- PR #160: private Skill Hub catalog/install truth-state contracts;
- PR #161: provider-neutral safety contracts for AI-Q, Retriever/RAG, Document Intelligence, Voice, Vision, NemoClaw/Hermes, Guardrails, and Evaluation.

Result:

`NVIDIA REPOSITORY ARCHITECTURE SATURATED / CI VERIFIED / REAL BACKEND + TARGET-PC INTEGRATION REQUIRED`

No additional speculative NVIDIA repository work should be created. Next changes require actual backend/runtime evidence or a concrete defect.

Core target-PC priority remains:
`Phase 14 → MEM-X → Phase 16 → Phase 17 → Phase 19 → Phase 20`.

## 2026-09-22 — recovery pointer cleanup after NVIDIA saturation

Fresh repository audit found Codex had already advanced beyond the interrupted NVA-1 session:

- PR #159: NVA-0 merged;
- PR #160: NVA-1 merged;
- PR #161: NVA-2…NVA-9 contracts merged;
- PR #162: NVIDIA MAX repository saturation merged;
- main push CI run #435: SUCCESS;
- open PRs at audit: 0.

Added `docs/CURRENT_EXECUTION_POINTER.md` and latest-override notes so future ChatGPT/Codex sessions do not restart stale NVA-1/NVA-2 instructions.

Next work is real target-PC/core release validation and real NVIDIA backend integration, not more speculative repository architecture.

## 2026-09-22 — Phase 24 Event Engine repository foundation started

Owner approved continued JARVIS repository foundation work while Codex/target-PC execution is unavailable.

Started `feature/phase24-event-engine` from `main` `8fe4b6b0fa18705319ece5aade6cf77627608947`.

Implemented in branch:
- `lib/events/contracts.ts`;
- `lib/events/engine.ts`;
- `lib/events/store.ts`;
- `lib/events/management.ts`;
- `lib/events/http.ts`;
- `app/api/events/route.ts`;
- `tests/event-engine.test.ts`;
- private store path in `.env.example`;
- lint coverage for Event Engine/API.

Safety properties:
- proactive events are notifications/evidence only, never execution authority;
- subscriptions default safely and can be disabled;
- dedupe/debounce/quiet-hours/rate-limit are deterministic;
- private state is bounded and symlink-safe;
- source adapters are not falsely claimed as connected.

Next after green merge: Phase 25 Durable Background Task Manager repository foundation.

## 2026-09-22 — Phase 25 Durable Background Task Manager started

Phase 24 Event Engine merged via PR #164 at `1327ee985c13c6486bcd9212cbfbc28b3d3187a0` after green CI.

Started `feature/phase25-durable-task-manager`.

Repository foundation includes:
- durable dependency-aware task queue;
- bounded concurrency + resource locks;
- Level 0/1 unattended ceiling and Level 2/3 waiting-approval state;
- pause/resume/cancel;
- checkpointing;
- retry/backoff;
- restart recovery;
- parallel execution for independent tasks;
- STOP propagation via active AbortControllers;
- private bounded/symlink-safe persistence;
- loopback management API;
- regression coverage.

Added `docs/JARVIS_PROGRESS_TRACKER.md` so interrupted sessions resume exact repository state rather than recreate completed work.

Next after merge: Phase 28 Diagnostics / Audit / Offline foundation.

## 2026-09-22 — Phase 28 Diagnostics / Audit / Offline repository foundation

Resumed after interruption and found Phase 24 and Phase 25 already merged.

Verified:
- PR #164 Phase 24 Event Engine merged;
- PR #165 Phase 25 Durable Background Task Manager merged at `2169d260ae4e52577053af442e10edc7ca1b6abf`;
- post-merge main CI #443 SUCCESS.

Started `feature/phase28-diagnostics-audit-offline`.

Implemented:
- `lib/diagnostics/contracts.ts`;
- `lib/diagnostics/health.ts`;
- `lib/diagnostics/recovery.ts`;
- `lib/diagnostics/audit.ts`;
- `lib/diagnostics/runtime.ts`;
- `app/api/diagnostics/route.ts`;
- `tests/diagnostics-foundation.test.ts`;
- lint coverage and private audit path configuration.

Safety/truth boundaries:
- connectivity defaults UNKNOWN;
- health is check-backed, not synthetic telemetry;
- audit redacts secrets/local paths;
- recovery is non-executing planning only;
- actual restart/recovery must pass Tool Runtime/approval;
- real offline/recovery evidence remains target-PC work.

Next after green merge: Phase 22 Identity / Trust / Secret boundary.

## 2026-09-22 — Phase 22 Identity / Trust / Secret repository foundation

After Phase 28 merged green, started `feature/phase22-identity-trust-secrets`.

Implemented:
- `lib/identity/contracts.ts`;
- `lib/identity/policy.ts`;
- `lib/identity/sessions.ts`;
- `lib/identity/store.ts`;
- `lib/identity/secrets.ts`;
- `tests/identity-trust-secrets.test.ts`;
- identity lint coverage;
- private `.astra/trust.json` configuration.

Security decisions:
- session identity only sets a permission ceiling;
- locked/guest session ceiling remains Level 1;
- trusted user unlocked ceiling max Level 2;
- owner unlocked ceiling max Level 3;
- Level-3 action still requires normal scoped approval;
- device registry stores fingerprint hash, not raw identity secret;
- revoked devices fail closed;
- secret values are not returned by status/presence and are not persisted by the broker.

Next after green merge: Phase 27 Multi-device foundation.

## 2026-09-22 — Phase 27 Multi-device repository foundation

After Phase 22 merged green, started `feature/phase27-multi-device-foundation`.

Implemented:
- `lib/devices/contracts.ts`;
- `lib/devices/pairing.ts`;
- `lib/devices/presence.ts`;
- `lib/devices/store.ts`;
- `lib/devices/routing.ts`;
- `tests/multi-device-foundation.test.ts`;
- lint coverage and private `.astra/devices.json` configuration.

Security decisions:
- pairing tokens are random, hashed, expiring and single-use;
- pairing never substitutes for Phase-22 trust;
- paired nodes require an already trusted device identity;
- revoked nodes cannot be reactivated;
- stale advertisements expire rather than remaining falsely online;
- Level-2/3 remote routes preserve approval;
- no Level-4 device ceiling;
- no public unauthenticated ASTRA transport is introduced.

Next after green merge: Phase 29 Generic Skill / Environment Device Registry.


## 2026-09-22 — Phase 29 generic skill/environment foundation

- confirmed Phase 27 PR #168 merged at `aa91850f68dc5bc677cb14a11cd54ab5da9fa36a` with main CI #451 SUCCESS;
- created `feature/phase29-skill-environment-registry`;
- added generic skill contracts/registry with untrusted-by-default state, review/install/enable/disable/update/rollback/remove lifecycle, health truth, permission/tool mapping, network/secret-name requirements, and private bounded persistence;
- added provider-neutral explicit environment registry with disabled-by-default devices, Tool Registry capability mapping, Level-3+ writes, privacy controls for camera/sensor classes, and no public control endpoint;
- added `tests/skill-environment-foundation.test.ts`;
- avoided collision with legacy `ASTRA_SKILLS_FILE` by using `ASTRA_GENERIC_SKILL_REGISTRY_FILE=.astra/generic-skills.json`;
- opened PR #169;
- CI #452 exposed one stale test env-var name (374/375 tests passed);
- patched the test;
- CI #453 completed SUCCESS for build, 375 tests, typecheck, lint, dependency audit, and PR diff-check;
- added `docs/SKILL_ENVIRONMENT_BRIDGE.md` and synchronized recovery/handoff trackers.

Remaining before repository completion:
- newest PR #169 head must pass CI after documentation changes;
- merge PR #169;
- update post-merge continuity truth on `main`.


## 2026-09-22 — Phase 29 merged / repository-foundation saturation

- PR #169 final head `adf8bfa36c1d19726fa2304779ecdb918b220cb3` passed CI #457;
- PR #169 merged to `main` as `390a5c35e50a5020ccf34f317edcc25f4837dcb1`;
- main push CI #458 passed all gates;
- Phase 29 is repository-complete;
- authorized independent JARVIS repository sequence Phase 24/25/28/22/27/29 is saturated;
- next work is real target-PC/provider integration and evidence, not another mock/foundation layer.


## 2026-09-22 — Cross-session reconciliation / Phase 16 main-UI evidence

- audited all **206** repository branches against current `main`;
- classified divergent early Humanoid/core, Phase 14/18, old Phase 28/29, old Windows private-evidence, old V15 telemetry, and stale documentation branches as superseded historical work after comparison with current-main implementations;
- found one concrete repository-side omission still required by current docs: Phase 16 main-UI evidence for Command Center active and Automation panel open;
- rebuilt that slice on current main instead of cherry-picking the stale prototype;
- added opt-in `?perf=1` UI performance probe, clean-build start/end provenance, private output, real-activity checks, Automation-panel presence checks, and regression coverage;
- normalized `AGENTS.md`, `CODEX_NEXT_MISSION.md`, execution pointer and recovery docs so older PR #150-era text is not treated as current mission;
- PR #171 final CI #466: **SUCCESS**;
- PR #171 merged to `main` as `cc8432edcf9e854bba9d0d78c14c7731fd279dbd`;
- post-merge main CI #467: **SUCCESS**;
- real Phase 16 target-browser measurements remain required; no benchmark PASS is claimed from CI.

Next:
`Phase 14 → MEM-X → Phase 16 real measurements → Phase 17 → Phase 19 → Phase 20`.
Do not restart historical branches unless a new concrete capability gap is demonstrated.


## 2026-09-22 — Operations UI refinement

After the repository foundation sequence was reconciled, two concrete unchecked repo-side gaps remained implementable without target-PC/provider access:

- Phase 25 durable background-task UI/runtime presence;
- Phase 28 user-facing diagnostics + audit/action-history panel.

PR #174 adds:
- `components/AstraOperationsPanel.tsx`;
- canonical `/api/tasks` task list/queue/checkpoint/error visibility;
- guarded resume/pause/cancel/delete lifecycle controls only;
- canonical read-only `/api/diagnostics` health + audit visibility;
- explicit connectivity UNKNOWN truth boundary;
- no recovery executor and no fake production-task executor;
- main-page mount, CSS, lint coverage and regression tests.

PR #174 final CI #483: SUCCESS.
PR #174 merged to `main` as `293216e9f94868d00b2636b125922ff09ec593db`.
The Phase 25 task-presence and Phase 28 diagnostics/action-history UI tracker items are complete.


## 2026-09-22 — Event Inbox refinement

Started `feature/event-inbox-ui` after PR #174 merged.

Scope:
- add Event Engine records/subscriptions to the existing Operations panel;
- use canonical `GET /api/events`;
- allow only guarded ACK and enable/disable subscription mutations;
- do not expose manual publish/upsert controls;
- display severity, disposition, acknowledgement, project and subscription provenance;
- retain explicit truth text that source activity is not fabricated.

Real GitHub/calendar/email/service adapters and proactive notification evidence remain separate integration gates.


## 2026-09-22 — Event Inbox merged / GitHub Actions adapter started

- PR #175 final CI #486: SUCCESS;
- PR #175 merged as `56059728be8ef60b1badb58a8ef13bade2ba569b`;
- Event Inbox is now canonical Operations UI;
- started `feature/github-actions-event-adapter`;
- adapter is read-only toward GitHub and local-write-only toward Event Engine;
- public repositories require no token; private repositories may use local `GITHUB_TOKEN`;
- exact GitHub Actions API endpoint/version is fixed in code;
- repeated poll state is skipped before publishing so an existing delivered/acknowledged record is not overwritten by a duplicate poll;
- opened PR #176 for the adapter;
- real background polling/proactive target-runtime delivery remains pending.

## 2026-09-22 — Phase 24 three-source repository checkpoint

- PR #178 provider-health diagnostics merged; main CI #501 SUCCESS.
- PR #180 local service-health Event Engine source merged; main CI #507 SUCCESS.
- PR #182 Automation lifecycle Event Engine bridge merged at `d04876391483500dda4f0755c4f1c120a25eae07`.
- PR #182 CI #512 passed; post-merge main CI #513 exposed one nondeterministic integration-test wait, not a runtime defect.
- PR #183 changed only that test to await canonical async Event Store publication; PR CI #516 SUCCESS.
- PR #183 merged at `0f1cff3723aeb30a56270b86d5b8dcfef713ca2a`; main CI #517 SUCCESS.
- Phase 24 now has three real repository-side source integrations: GitHub Actions, local service-health, and Automation lifecycle.
- Target-PC polling/proactive notification/failure/STOP/restart evidence is still required; repository CI is not production readiness.
- Phase 28 recovery execution remains intentionally pending because no recovery-specific Tool Runtime primitive currently exists. Do not substitute unrelated generic tools.


## 2026-09-23 — User complaint / refinement tracker

The following points are durable user-facing refinement requirements and are **not NVIDIA-only**. Treat them as product acceptance criteria for the whole ASTRA runtime.

- **ASTRA is still not responsive enough across providers/models.** The owner reports the problem is broader than NVIDIA; local and remote model paths must be measured and improved end-to-end instead of assuming one provider is the problem.
- **The UI must not appear frozen while any provider is working.** Every provider path that can stream should surface useful output as soon as it exists; non-streaming paths need truthful progress/working state rather than silence.
- **Routine conversation must stay lightweight.** Short/simple turns should avoid unnecessary planning, memory retrieval, specialist context, hidden reasoning and heavyweight model routing.
- **Provider/model selection must match task cost.** Heavy reasoning is acceptable only when the task actually needs it; routine interaction should take the fastest truthful path.
- **Many user-facing features are still not working or not yet proven on the target PC.** Codex must audit real runtime behavior feature-by-feature, distinguish READY vs disabled/not-configured/broken, then fix concrete failures one at a time.
- **Do not treat repository-complete contracts as working product features.** A feature is only accepted when the target runtime demonstrates its happy path plus relevant failure/permission/STOP behavior.
- **Do not arbitrarily change the agreed NVIDIA lineup.** Keep Chief=Nemotron Ultra, Deep=GLM-5.3, Fast=Nemotron Lightning, Vision=GLM-5.3 Flash unless target evidence proves a change is necessary.
- **Improve incrementally and preserve working configuration.** Fix one bottleneck or broken feature at a time, measure before/after on the target PC, and do not restart broad historical audits.
- **Codex is expected to take over soon.** It should resume from this tracker and the current execution pointer, not restart the project or redo completed repository work.

Observed target evidence that motivates the responsiveness work includes NVIDIA FAST around 42.44 s and NVIDIA DEEP around 286.26 s before tuning, but these numbers are examples of the broader responsiveness problem rather than the whole problem.

Current implementation work for one slice of responsiveness is tracked in the post-Codex responsiveness PR. Humanoid/GPU performance and broader feature readiness remain separate but active refinement tracks.


## 2026-09-23 — Cross-provider responsiveness refinement merged

Owner complaint remains broader than NVIDIA: ASTRA must feel responsive across all active provider paths and must not appear frozen while work is in progress.

Merged repository refinements:
- PR #196 — NVIDIA live-token path, Lightning hidden-thinking reduction, GLM low reasoning effort, fast-context support on the latest Codex Windows baseline.
- PR #197 — OpenAI-compatible Hermes chat streaming through ASTRA SSE.
- PR #198 — Codex incremental `agent_message` updates forwarded through ASTRA SSE.
- PR #199 — lightweight conceptual Developer Q&A stays on the fast local path instead of waking Codex and long-term memory unnecessarily.
- PR #201 — provider-neutral time-to-first-token and total Brain latency telemetry exposed in the Humanoid technical diagnostics without persisting prompt/response text.
- PR #202 — the main ASTRA console shows a truthful `MEMPROSES` state before the first provider token, then switches to live response text when tokens arrive.
- PR #204 — the reviewed Hermes Runs transport now forwards official `assistant.delta` SSE frames while final run status/output remains authoritative.
- PR #206 — restores the documented local-first AUTO order: general chat `Ollama → Hermes → permitted cloud`; engineering `Codex → Hermes → Ollama`.

All newest-head PR CI gates above passed before merge. These changes do not close the real target-PC performance gate: Codex/target validation must still measure the exact installed build and record time-to-first-token + total latency per active provider.

Next responsiveness validation on the target PC:
1. update/install the exact latest clean main;
2. measure AUTO, Ollama, Codex, NVIDIA and Hermes with the same lightweight prompt class;
3. record time-to-first-token and total latency;
4. distinguish provider-generation delay from memory/routing/UI delay;
5. fix only the measured remaining bottleneck.
