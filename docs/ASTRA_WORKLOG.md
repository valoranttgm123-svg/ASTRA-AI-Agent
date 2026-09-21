# ASTRA DURABLE WORKLOG

> Repository-owned chronological execution history.
>
> This file exists so Codex, ChatGPT, or a new local session can recover the project without relying on conversation history.
>
> Update this file after every merged implementation slice, security finding, release gate, or meaningful external validation.

## Recovery truth

Current `main` checkpoint:

- Phase 15 repository hardening: **merged / CI verified**;
- Phase 16A performance instrumentation: **merged / CI verified**;
- Phase 17A safe validation preflight: **merged / CI verified**;
- repository cleanup before RC: **complete**;
- Phase 19A–19G Windows repository tooling/hardening: **merged through PR #117**;
- target-PC read-only evidence collector: **merged as PR #121**;
- Phase 18A repository RC gate: **merged as PR #119**; stale PR #111 closed as superseded;
- Phase 20 evidence/report preparation tooling: **merged through PR #126**;
- current merged checkpoint after PR #126: `b687fd0588e96f7fa3e0a60d6e45811797be4fff`;
- Phase 16/17 target-runtime evidence remains pending;
- Phase 14 target-PC validation: **still required**;
- real Sonor/Graphify/Obsidian validation: **still requires target-PC/local access**;
- Phase 19 target-PC install/update/reinstall/startup evidence: **still required**.

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


## 2026-09-21 — Phase 20 evidence/report tooling checkpoint

Merged repository slices:

- PR #123 — conservative Phase 20 core release report tooling;
  - merge commit: `536acdf4c74c6d98fbae75faee6f2d9a85aa8996`;
  - generates private JSON/Markdown reports from real evidence;
  - missing/incomplete evidence remains `BLOCKED`.
- PR #124 — browser/Humanoid HIGH performance evidence capture;
  - merge commit: `16dc1836cffca8116c92338a10d4c4cb16d6709c`;
  - records structured frame/GPU/heap/diagnostic evidence under `.astra/performance/`;
  - does not store chat or console message content;
  - does not mark performance PASS automatically.
- PR #125 — safe Phase 20 manual gate recorder;
  - merge commit: `73bc822e2bdbdae9126412c9bf1a07369a6b0098`;
  - PASS requires an existing private evidence file under `.astra/`;
  - final release status remains owned by the core report generator.
- PR #126 — Phase 20 release context recorder;
  - merge commit: `b687fd0588e96f7fa3e0a60d6e45811797be4fff`;
  - records bounded CONNECTED / REQUIRES USER LOGIN / NOT IMPLEMENTED labels and external-configuration state;
  - final release status remains `NOT_EVALUATED` until generated from evidence.

Truth boundary:

- repository tooling is now prepared to collect and summarize the remaining release evidence;
- Phase 14 approval/STOP, MEM-X Sonor/Graphify/Obsidian, Phase 16 real measurements, Phase 17 real scenarios, and Phase 19 install/update/reinstall/startup remain target-PC/local gates;
- no READY claim may be made from PR #123–#126 alone.

Continuation note:

`docs/CODEX_CONTINUATION_NOTE_2026-09-21.md`

Exact next work:

1. on the real target PC, collect the read-only baseline;
2. execute/record the six real manual gates without fabricating evidence;
3. capture Humanoid HIGH evidence and review browser console state;
4. run the real Phase 17 scenarios and emergency STOP;
5. generate `npm run release:core-report`;
6. fix any concrete failures and repeat evidence collection;
7. only after the core release gate stabilizes continue Phase 21–30.
