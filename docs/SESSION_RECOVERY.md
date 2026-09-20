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
- Phase 19B safe update/reinstall tooling: merged/CI verified;
- current implementable repository work: **Phase 18A repository RC gate automation**.
