# ASTRA Branch Hygiene Plan — 2026-09-24

Status: **ANALYSIS ONLY / NO DELETION AUTHORIZED**

Purpose: reduce future continuity confusion after release without deleting backup/history during active target validation.

Observed branch families at preparation time:
- `docs/*`: 49 visible matches;
- `feature/*`: 23 visible matches;
- `fix/*`: 32 visible matches;
- `astra/*`: at least 100 visible matches with additional pagination;
- `backup/*`: 32 visible matches.

These counts are inventory hints, not proof that every branch is merged or deletable.

## Rules

Never delete automatically:
- `backup/*`;
- the current open/draft PR branch;
- a branch with unmerged commits;
- a branch referenced by active target/runtime evidence;
- a branch needed for rollback/reproduction.

Candidate cleanup after the release checkpoint:
1. merged `docs/*` branches whose content is already in `main`;
2. merged `fix/*` branches with no unique commits;
3. merged `feature/*` branches with no unique commits;
4. historical `astra/*` implementation branches only after compare-to-main verification.

## Required verification per candidate

Before deletion:
- confirm no open PR uses the branch;
- compare branch to current `main`;
- confirm `ahead_by = 0` or otherwise account for every unique commit;
- confirm branch is not a backup;
- confirm branch is not named in current execution pointer/handoff as ACTIVE;
- record the cleanup batch in worklog.

## Recommended cleanup batching

Do not delete hundreds at once.

Use small batches:
- Batch A: obviously merged recent documentation branches;
- Batch B: recent merged fix branches;
- Batch C: older feature branches;
- Batch D: historical `astra/*` branches only after a second reconciliation.

Stop immediately if a branch has unique commits or ambiguous ownership.

## Current decision

During Codex target evidence:
- **do not delete branches**;
- keep this as a post-checkpoint housekeeping plan only.
