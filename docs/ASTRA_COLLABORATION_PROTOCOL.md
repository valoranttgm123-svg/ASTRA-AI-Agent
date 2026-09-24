# ASTRA ChatGPT ↔ Codex Collaboration Protocol

Status: **MANDATORY**
Effective: **2026-09-24**

This document is the durable cross-session collaboration rule for the ASTRA project.

The owner explicitly requires ChatGPT and Codex to work as one continuous team. A disconnected/new chat session must continue from repository truth and must not restart completed work.

## 1. Source of truth

For ASTRA, GitHub is the durable project memory across ChatGPT/Codex sessions.

Before either ChatGPT or Codex changes anything, it must inspect:

1. current `main`;
2. newest CI;
3. all open PRs;
4. `AGENTS.md`;
5. this file;
6. `docs/CURRENT_EXECUTION_POINTER.md`;
7. `docs/JARVIS_PROGRESS_TRACKER.md`;
8. `docs/CODEX_NEXT_MISSION.md`;
9. the latest relevant handoff/worklog entry.

Conversation history is supporting context only. It must never override current repository truth.

## 2. No-repeat rule

Do not rebuild, restart, or duplicate work that is already:

- merged into `main`;
- marked repository-complete in the tracker;
- present in an open PR/active branch;
- explicitly recorded as blocked pending target-PC/provider/user evidence.

A new session must first inspect the existing implementation/branch/PR.

Repeat work only when there is concrete evidence of one of these:

- current implementation is missing from `main`;
- a reproducible regression exists;
- CI or target evidence proves the implementation is broken;
- the owner explicitly changes the requirement.

"Chat disconnected", "new session", "I do not remember", or an old stale roadmap is **not** evidence that work must be recreated.

## 3. Mandatory roadmap update after every meaningful change

Whenever ChatGPT or Codex changes ASTRA, the same work slice must also update the project state.

At minimum update all relevant files:

- `docs/CURRENT_EXECUTION_POINTER.md` — exact active state and next task;
- `docs/JARVIS_PROGRESS_TRACKER.md` — checkbox/status truth;
- `docs/ASTRA_WORKLOG.md` — chronological change record;
- task-specific handoff/validation document when one exists.

If the change affects Codex execution order, also update:

- `docs/CODEX_NEXT_MISSION.md`;
- `docs/CODEX_HANDOFF.md` or the active task-specific Codex handoff.

A meaningful code/runtime/provider change is not considered properly handed off until these state documents are synchronized.

## 4. Required task states

Every active ASTRA task must be treated as one of:

- `DONE` — repository work merged and, where required, real evidence completed;
- `REPO_DONE_TARGET_PENDING` — code/CI complete, physical/provider/runtime evidence still required;
- `ACTIVE` — currently being implemented/tested;
- `BLOCKED` — cannot continue because of a named external/local blocker;
- `NOT_STARTED` — no implementation has begun;
- `SUPERSEDED` — replaced by a newer merged implementation/decision.

Do not convert `BLOCKED` into `NOT_STARTED`.
Do not convert `REPO_DONE_TARGET_PENDING` into "needs implementation".
Do not mark `DONE` from code inspection when real target evidence is part of the completion gate.

## 5. Interrupted-session rule

If a ChatGPT or Codex session stops before completion:

1. preserve the active branch/PR;
2. do not create a replacement branch in the next session until the existing work is inspected;
3. record:
   - active branch/PR;
   - latest commit;
   - what passed;
   - what failed or remains;
   - exact blocker;
   - exact next command/edit/test;
4. mark the task `ACTIVE` or `BLOCKED`, never `DONE`;
5. update the current pointer before stopping whenever technically possible.

The next session resumes from that exact point.

## 6. ChatGPT responsibilities

ChatGPT should:

- inspect repository truth before implementation;
- perform safe repository work it can verify;
- create focused branches/PRs;
- run/inspect CI before merging;
- update roadmap/pointer/worklog/handoff whenever it changes project state;
- leave target-PC/provider-only work clearly marked for Codex;
- never create duplicate architecture merely because a previous chat ended;
- never assume an old memory/checkpoint is newer than live GitHub.

When ChatGPT fixes a problem, Codex must be able to discover that fix from the repository without reading the old chat.

## 7. Codex responsibilities

Codex should:

- read ChatGPT's latest merged changes and handoff before touching the same subsystem;
- refine/complete existing foundations rather than recreate them;
- perform target-PC/provider/runtime work that GitHub-only ChatGPT cannot prove;
- update the same roadmap/pointer/worklog/handoff after local/runtime changes;
- record real evidence and blockers truthfully;
- tell the repository what changed so the next ChatGPT session does not guess.

When Codex changes runtime behavior locally, the durable project state must be updated before another agent continues.

## 7A. Work division and no-competition rule

ChatGPT and Codex must not compete for the same ASTRA task or create parallel implementations of the same requirement by default.

The required division of work is:

1. **ChatGPT first completes every safe repository-side task it can actually perform and verify.**
   - inspect current code and docs;
   - implement/refactor repository code;
   - add tests and documentation;
   - create/fix PRs;
   - inspect CI;
   - merge only after the required gates pass;
   - keep the roadmap/pointer/worklog/handoff synchronized.

2. **Anything ChatGPT cannot truthfully complete must be handed to Codex with an explicit trail.**
   Typical Codex-owned remainder includes:
   - real target-PC execution;
   - local runtime diagnosis that requires the user's machine;
   - provider/account/runtime integration unavailable to ChatGPT;
   - physical microphone/camera/GPU/device checks;
   - UAC/admin/interactive OS validation;
   - real latency/performance/evidence capture;
   - finishing or polishing a ChatGPT implementation when target evidence shows it is incomplete.

3. **If ChatGPT's work is incomplete or imperfect, Codex must refine and finish that same work rather than discard it and start a competing implementation.**
   Codex should preserve valid architecture, tests, contracts and merged behavior, then make the minimum evidence-backed changes required to make it correct and ready-to-use.

4. **If Codex already owns an ACTIVE target/runtime task, ChatGPT must not independently rebuild that same task.**
   ChatGPT may safely work on a non-conflicting repository slice, regression coverage, documentation, or another independent task.

5. **If ChatGPT is actively changing a repository slice, Codex should consume that branch/PR/handoff before touching the same subsystem.**
   When possible, continue/fix the existing branch or continue from its merged result.

6. Parallel work is allowed only when the slices are clearly independent and cannot overwrite or invalidate each other.

The goal is a relay, not a race:

```text
ChatGPT: implement what can be done from repository access
        ↓ leave exact trail
Codex: refine / validate / finish what requires the real environment
        ↓ leave exact trail
ChatGPT: read Codex changes and continue the next safe repository slice
```

No agent should redo work merely to claim ownership of it.

### Mandatory transfer trail

Whenever work moves from ChatGPT to Codex or from Codex back to ChatGPT, record:

- what is already complete;
- what is intentionally not complete;
- why the remaining part cannot be finished by the current agent;
- exact branch/PR/commit;
- tests/CI already passed;
- real evidence already collected;
- exact next action;
- files/subsystems that must not be rebuilt;
- task state: `REPO_DONE_TARGET_PENDING`, `ACTIVE`, or `BLOCKED` as appropriate.

A handoff without this trail is incomplete.

## 8. Mutual handoff format

After a meaningful work slice, record a concise handoff with:

```text
ACTOR: ChatGPT | Codex
DATE:
AREA:
STATE: DONE | REPO_DONE_TARGET_PENDING | ACTIVE | BLOCKED | SUPERSEDED
BRANCH/PR:
MERGE/COMMIT:
CHANGED:
VALIDATED:
BLOCKER:
NEXT:
DO NOT REPEAT:
```

Use only facts that are actually verified.

## 9. Merge rule

For repository changes, repository completion requires:

- implementation/doc changes committed;
- relevant tests updated;
- build/tests/typecheck/lint/audit/diff checks as required;
- newest-head CI green;
- PR merged;
- project state documents updated.

If CI fails, the task remains `ACTIVE`.
If physical/provider evidence is still missing, use `REPO_DONE_TARGET_PENDING`.

## 10. Blocking and continuation rule

A blocker in one area must not cause duplicate work in that same area.

Example:

- SSH aliases fail name resolution;
- Multi-PC transport code is already merged;
- correct state: `REPO_DONE_TARGET_PENDING` / target connectivity blocker;
- incorrect action: create a second SSH transport implementation.

When one task is blocked, continue another independent unfinished task only if doing so does not bypass the current owner's priority.

## 11. ASTRA-specific anti-repeat baseline

As of this protocol's creation:

- PC1 Computer Agent read-only work is complete;
- PC1 Owner Mode and direct no-model execution are complete and target-validated;
- trusted multi-PC SSH repository transport is merged;
- safe SSH bootstrap/diagnostic tooling is merged;
- current remaining multi-PC work is physical PC2-PC4 connectivity/identity/admin/STOP-KILL/multi-step evidence;
- older instructions that say to rebuild PC1 or select a new PC transport are superseded.

Always re-check live `main` before relying on this historical baseline.

## 12. Owner shorthand

If the owner says:

- `lanjutkan`;
- `lanjutkan yang belum selesai`;
- `cek progres`;
- `lanjut progres`;

that is sufficient instruction.

The agent must recover the state from GitHub and continue the first valid unfinished task. Do not ask the owner to reconstruct previous chats.

## 13. Cross-session memory rule

The owner wants "ingatan Proyek ASTRA di semua sesi chat".

The durable implementation of that requirement is:

- project truth must be written to GitHub;
- session recovery must read this protocol and the canonical pointer first;
- agent-specific conversational memory may assist, but must never be the only copy of project state.

This prevents a lost/truncated/new chat session from erasing project progress.
