# ASTRA Release Freeze Checklist — 2026-09-24

Status: **DRAFT / USE WHEN FINAL COMMIT-BOUND RELEASE CAPTURE STARTS**

## Before freeze

- [ ] No known release-blocking runtime defect remains.
- [ ] Current Codex target checkpoint is complete.
- [ ] All queued repository/draft work has been reviewed.
- [ ] Only relevant CI-green work has been merged.
- [ ] Open PRs intended for the release are merged or explicitly deferred.
- [ ] Final release candidate commit is selected.
- [ ] PC1 checkout is on that exact commit.
- [ ] PC1 working tree is clean.
- [ ] Production build is rebuilt from that clean commit.
- [ ] Running ASTRA attests the same full commit.
- [ ] Private configuration remains outside Git.
- [ ] Loopback-only binding is verified.

## Freeze starts

Record privately:

```text
FREEZE_COMMIT:
FREEZE_STARTED_AT:
PC1_RUNTIME_COMMIT:
WORKING_TREE_CLEAN:
```

While frozen:

- [ ] Do not merge any PR into `main`.
- [ ] Do not change PC1 HEAD.
- [ ] Do not rebuild from another commit.
- [ ] Do not hand-edit PASS manifests.
- [ ] Do not reuse stale evidence from another commit.
- [ ] Do not change private evidence after its hash is recorded.
- [ ] If a required code fix is merged, invalidate the active capture and restart from the new final commit.

## Core evidence sequence

- [ ] repository gate evidence
- [ ] target-PC read-only evidence collector
- [ ] M1 Automation approval/STOP observation + gate record
- [ ] M2 Sonor degradation/cancellation evidence
- [ ] M3 six-scenario Humanoid HIGH browser bundle
- [ ] M4 full-system approved-action observation
- [ ] M5 Windows install/update/reinstall observation
- [ ] emergency STOP observation
- [ ] release context labels
- [ ] final core report

## Before unfreeze

- [ ] Every required evidence artifact matches FREEZE_COMMIT.
- [ ] Runtime attestation still matches FREEZE_COMMIT.
- [ ] Repository working tree is still clean.
- [ ] No required gate is stale or missing.
- [ ] Final report generated truthfully.
- [ ] READY-class verdict only if all required evidence supports it.

## Unfreeze

Only after the evidence checkpoint is complete:

```text
FREEZE_ENDED_AT:
FINAL_REPORT_STATUS:
NEXT_ALLOWED_REPOSITORY_WORK:
```
