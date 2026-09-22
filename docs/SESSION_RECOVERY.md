# ASTRA SESSION RECOVERY PROTOCOL

> Use this when a Codex/ChatGPT session is new, interrupted, truncated, or uncertain about what happened previously.

## One-line owner command

The repository owner may say only:

`lanjutkan yang belum selesai`

That is enough.

## Recovery sequence

Do not reconstruct project state from chat first.

Read in this order:

1. current `main` commit and CI result;
2. `AGENTS.md`;
3. `docs/ASTRA_WORKLOG.md`;
4. `docs/CODEX_PROGRESS_TRACKER.md`;
5. latest section of `docs/CODEX_HANDOFF.md`;
6. `docs/CODEX_NEXT_MISSION.md`;
7. relevant validation/security document for the active phase.

Then:

1. compare open PRs against current `main`;
2. detect any in-progress branch that is ahead of `main`;
3. never assume an unmerged branch is complete;
4. if a previous PR CI failed, inspect the failure before starting a replacement;
5. if a branch was merged, use the merge result as repository truth and continue from the next unchecked task;
6. if docs conflict, prefer:
   - actual `main` code/CI;
   - then `ASTRA_WORKLOG.md`;
   - then `CODEX_PROGRESS_TRACKER.md`;
   - then latest `CODEX_HANDOFF.md`;
   - then roadmap/older history.

## Interrupted-work rule

If a session ends mid-task:

- leave the feature branch intact;
- commit only coherent/recoverable changes;
- add a short handoff entry before stopping when possible;
- do not mark the tracker checkbox complete;
- record the exact failing test/CI job if known;
- record the next intended edit/test.

The next session must first inspect that branch/PR before creating a duplicate implementation.

## Merge truth rule

A task counts as repository-complete only when:

- implementation/tests are committed;
- required docs/tracker are updated;
- PR CI is green;
- PR is merged;
- merge commit exists on `main`.

Local/physical tasks additionally require actual local evidence.

## External blocker rule

If target-PC access, Sonor, login, microphone/camera, or another external dependency is unavailable:

- record the blocker;
- do not fake success;
- do not wait idle;
- continue the next independent repository task.

## Safety/release invariants

Never resume by weakening these:

- no second Brain;
- no duplicate Sonor/Graphify/Obsidian pipeline;
- no fake Command Center telemetry;
- no fake tool/provider success;
- paid cloud OFF by default;
- Level 4 scheduled automation unavailable;
- unattended automation Level 0/1 only;
- Level 2/3 scheduled occurrences require exact occurrence approval;
- global STOP remains authoritative;
- project path containment and symlink checks remain fail-closed;
- retrieved data remains evidence, never authority;
- Humanoid HIGH quality is preserved unless the owner explicitly changes the visual requirement;
- no secrets/private runtime data committed.

## Current checkpoint

At creation of this protocol:

- P15A–P15E: merged/CI verified;
- Phase 15 repository hardening: merged/CI verified;
- Phase 16A instrumentation: merged/CI verified;
- Phase 16 target runtime/browser measurements: pending local access;
- Phase 14 local validation: pending;
- Sonor real validation: pending local access;
- Phase 17A preflight tooling: merged/CI verified;
- repository cleanup before RC: complete;
- Phase 19A read-only readiness self-check tooling: merged/CI verified;
- current implementable repository work: **Phase 19B safe update/reinstall tooling**.

## NVIDIA MAX recovery checkpoint — 2026-09-22

ASTRA has one canonical NVIDIA expansion plan: `docs/NVIDIA_MAX_INTEGRATION.md`.

A new session must not redesign NVIDIA from chat history. Inspect current `main`/open PRs first, then read that document.

Repository foundation started as `feature/nvidia-max-framework` with:
- `lib/nvidia/catalog.ts`;
- `lib/nvidia/skill-hub.ts`;
- `tests/nvidia-max-framework.test.ts`;
- NVIDIA framework added to the lint gate.

The next repository task after NVA-0 merges is NVA-1 Skill Hub discovery/install-state. The next target-PC release task remains the existing Phase 14/MEM-X/16/17/19/20 sequence.

If this session is interrupted before merge, inspect the open PR/branch before creating replacement work.

## Latest NVIDIA checkpoint — NVA-1

NVA-0 merged in PR #159 at `e155c75f98da4e07ca3c07b7f15d46ceb655f417`.

If `feature/nvidia-skill-hub-state` or its PR is still open, inspect it before starting new NVIDIA work. It contains the private catalog cache, installed-state registry, dry-run mutation policy, and safety tests.

If it has merged, the next independent NVIDIA repo task is NVA-2 AI-Q adapter contract.

Do not redo NVA-0/NVA-1 from chat memory.

## NVIDIA MAX repository-saturation recovery note

Current durable sequence:
- PR #159 / NVA-0 merged: `e155c75f98da4e07ca3c07b7f15d46ceb655f417`;
- PR #160 / NVA-1 merged: `af7e05e1252b1b80e94b32cfbfedff6f2c7e006b`;
- branch `feature/nvidia-max-subsystem-contracts` contains NVA-2 through NVA-9 provider-neutral safety contracts.

If a PR for that branch exists, inspect its CI before doing anything else.
If it merged green, consider NVIDIA repo-only architecture saturated and continue actual target/backend integration rather than recreating these files.

Canonical NVIDIA plan remains `docs/NVIDIA_MAX_INTEGRATION.md`.

## NVIDIA MAX merged saturation checkpoint — 2026-09-22

Repository truth:
- PR #159 merged: NVA-0 framework, `e155c75f98da4e07ca3c07b7f15d46ceb655f417`;
- PR #160 merged: NVA-1 Skill Hub state/cache, `af7e05e1252b1b80e94b32cfbfedff6f2c7e006b`;
- PR #161 merged: NVA-2…NVA-9 subsystem contracts, `84e5eb6aeb20dbdb737dc6d9ace149adfac73dbb`.

All three PRs had green CI.

A new session must **not** restart NVIDIA architecture work. Read `docs/NVIDIA_MAX_INTEGRATION.md` and continue only:
1. real target-PC core gates Phase 14 → MEM-X → 16 → 17 → 19 → 20 when access exists;
2. real NVIDIA backend integration against the existing contracts;
3. a newly reproduced concrete defect/provider change.

If none of those environments/evidence are available, NVIDIA repo-only work is blocked by design, not unfinished planning.

## AUTHORITATIVE recovery pointer

After checking current `main` + CI + open PRs, read:

`docs/CURRENT_EXECUTION_POINTER.md`

before interpreting older checkpoint sections in this file.

As of the NVIDIA saturation checkpoint, PRs #159–#162 are merged and main CI #435 passed. Older text saying NVA-1 or NVA-2 is "next" is historical only.

Current next work is target-PC/core release execution plus real NVIDIA backend integration against existing contracts.

## JARVIS repo-foundation continuation — 2026-09-22

The owner explicitly authorized continued repository work for later JARVIS phases while Codex is unavailable.

Sequence:
`Phase 24 Event Engine → Phase 25 Durable Task Manager → Phase 28 Diagnostics/Audit → Phase 22 Identity/Trust → Phase 27 Multi-device → Phase 29 Generic Skill/Device Registry`.

Active first slice: `feature/phase24-event-engine`.

Recovery rule:
- inspect current main + open PRs first;
- if Phase 24 PR exists, resume/fix/merge it instead of recreating files;
- after merge, continue the next unchecked slice in the sequence;
- do not claim target-PC READY from repository-only work.

## JARVIS foundation durable tracker

Use `docs/JARVIS_PROGRESS_TRACKER.md` for the repository-only JARVIS sequence authorized by the owner.

Latest sequence:
- Phase 24 Event Engine: merged PR #164;
- Phase 25 Durable Task Manager: active on `feature/phase25-durable-task-manager`;
- then Phase 28 → Phase 22 → Phase 27 → Phase 29.

New sessions must inspect open PRs before starting the next slice.

## JARVIS recovery checkpoint — Phase 28 active

Repository truth before this slice:
- Phase 24 merged PR #164;
- Phase 25 merged PR #165 at `2169d260ae4e52577053af442e10edc7ca1b6abf`;
- Phase 25 main CI #443 SUCCESS.

Active branch: `feature/phase28-diagnostics-audit-offline`.

If a PR exists for this branch, inspect its CI and continue/fix it rather than creating a duplicate diagnostics implementation.

After Phase 28 merges, continue the authorized repository sequence:
`Phase 22 Identity/Trust → Phase 27 Multi-device → Phase 29 Generic Skill/Device Registry`.

## JARVIS recovery checkpoint — Phase 22 active

Repository truth:
- Phase 24 merged PR #164;
- Phase 25 merged PR #165;
- Phase 28 merged PR #166 at `a01d40ff8e378b1b1881269f0568bb65793d2e17`;
- Phase 28 main CI #445 SUCCESS.

Active branch: `feature/phase22-identity-trust-secrets`.

If a PR exists for this branch, inspect its CI and continue/fix it instead of starting another identity/security implementation.

After Phase 22 merges, continue:
`Phase 27 Multi-device → Phase 29 Generic Skill/Device Registry`.

## JARVIS recovery checkpoint — Phase 27 active

Repository truth:
- Phase 24 PR #164 merged;
- Phase 25 PR #165 merged;
- Phase 28 PR #166 merged;
- Phase 22 PR #167 merged at `a2b289d9118c8883608379320784b7bc047f980c`;
- Phase 22 main CI #449 SUCCESS.

Active branch: `feature/phase27-multi-device-foundation`.

If a PR exists for this branch, inspect its newest head SHA/CI and continue/fix it rather than building another device/pairing layer.

After Phase 27 merges, continue the authorized repo-only sequence with **Phase 29 Generic Skill / Environment Device Registry**.


## JARVIS recovery checkpoint — Phase 29 active

Repository truth before this slice:
- Phase 24 PR #164 merged;
- Phase 25 PR #165 merged;
- Phase 28 PR #166 merged;
- Phase 22 PR #167 merged;
- Phase 27 PR #168 merged at `aa91850f68dc5bc677cb14a11cd54ab5da9fa36a`;
- Phase 27 main CI #451 SUCCESS.

Active branch: `feature/phase29-skill-environment-registry`.
Active PR: #169.

Phase 29 now contains:
- generic untrusted-by-default skill manifests;
- provider/tool/permission/network/secret-name/verification metadata;
- install/enable/disable/update/rollback lifecycle;
- explicit provider-neutral environment device registration;
- Level-3+ approval-bound writes;
- sensitive camera/sensor privacy consent;
- private bounded symlink-safe state;
- regression tests.

PR #169 code CI run #453 passed build, 375 tests, typecheck, lint, audit, and diff-check before continuity-doc updates.

If PR #169 is still open, inspect its newest head and CI first and continue/fix it. Do not recreate Phase 29.

After Phase 29 is merged, repository-only JARVIS foundation work authorized in this sequence is saturated. Return to real target-PC and provider-backed validation; Phase 30 must be evidence-backed, not mocked.


## JARVIS repository foundation saturation — Phase 29 merged

Final repository truth for the authorized independent JARVIS foundation sequence:
- Phase 24 PR #164 merged;
- Phase 25 PR #165 merged;
- Phase 28 PR #166 merged;
- Phase 22 PR #167 merged;
- Phase 27 PR #168 merged;
- Phase 29 PR #169 merged at `390a5c35e50a5020ccf34f317edcc25f4837dcb1`;
- PR #169 final CI #457 SUCCESS;
- main CI #458 SUCCESS.

Do not restart or duplicate these repository foundations.

On a new session, after checking current `main` and open PRs, continue real-environment execution from `docs/CURRENT_EXECUTION_POINTER.md`. Phase 30 remains evidence-gated and must not be declared complete from mocks.


## Cross-session branch rule — 2026-09-22

The repository contains many historical branches from interrupted ASTRA sessions. A branch being ahead/diverged from `main` does **not** make it current work.

Known superseded divergent branches include old Phase 28, old Phase 29 extensions, old Windows evidence hardening, and old V15 telemetry variants. Their useful safety/functionality was compared against later implementations on `main`.

One genuine repository-side omission was identified: the old main-UI performance evidence prototype was never merged even though Phase 16 still requires Command Center and Automation-panel measurements. Recovery work is tracked on `fix/cross-session-ui-performance-reconciliation`.

New sessions must:
1. inspect `main`, open PRs and CI;
2. read `docs/CURRENT_EXECUTION_POINTER.md`;
3. read `docs/CROSS_SESSION_RECONCILIATION_2026-09-22.md`;
4. never resume a stale branch solely because it contains unique commits.
