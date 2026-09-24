# ASTRA Post-Codex Reconciliation Checklist — 2026-09-24

Status: **DRAFT / RUN AFTER EACH TARGET EVIDENCE CHECKPOINT**

Purpose: prevent target evidence from living only in chat or PR comments.

After Codex finishes a meaningful target slice:

1. inspect live `main`, CI, open PRs and the newest Codex branch/PR;
2. identify exactly which target gates are now PASS/FAIL/BLOCKED;
3. copy only public-safe conclusions into:
   - `docs/CURRENT_EXECUTION_POINTER.md`;
   - `docs/JARVIS_PROGRESS_TRACKER.md`;
   - `docs/ASTRA_WORKLOG.md`;
   - `docs/CODEX_HANDOFF.md`;
4. never commit private aliases, IPs, usernames, key paths, credentials, raw private logs or private graph/vault data;
5. if Codex found a repository defect:
   - record reproduction/evidence;
   - create or continue one focused fix branch;
   - preserve the target evidence trail;
   - add regression coverage;
   - merge only after CI passes;
6. if the target gate passed:
   - mark only that exact gate complete;
   - do not infer neighboring gates;
7. if blocked:
   - name the blocker;
   - keep the task BLOCKED or REPO_DONE_TARGET_PENDING;
   - do not convert it to NOT_STARTED;
8. refresh DO NOT REPEAT scope;
9. refresh the exact next action;
10. if official release capture is active, do not merge documentation just to synchronize prose; queue the update in the draft branch until freeze ends.

## Minimum handoff record

```text
ACTOR:
DATE:
AREA:
STATE:
BRANCH/PR:
MERGE/COMMIT:
TARGET_BUILD_COMMIT:
VALIDATED:
FAILED:
BLOCKED:
PRIVATE_EVIDENCE_LOCATION: private / not committed
NEXT:
DO NOT REPEAT:
```

## Reconciliation completion test

A new ChatGPT/Codex session must be able to answer, from GitHub alone:
- what was completed;
- what failed;
- what remains;
- which commit/build was tested;
- whether the result is functional evidence or final release evidence;
- what must not be repeated;
- exactly what to do next.
