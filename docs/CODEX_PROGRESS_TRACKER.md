# CODEX PROGRESS TRACKER — Phase 15 → Phase 20

> Update this checklist only from real merged/verified work.
>
> Detailed implementation instructions live in `docs/CODEX_NEXT_MISSION.md`.

## Current baseline

- [x] Phase 14 Automation implementation merged
- [x] Phase 14 CI verified
- [ ] Phase 14 target-PC validation
- [ ] Phase 14 physical/local STOP + approval validation

Current truthful status:

`PHASE 14 IMPLEMENTATION COMPLETE / CI VERIFIED / TARGET-PC VALIDATION REQUIRED`

## Phase 15 — Security / failure hardening

- [x] P15A — project path / filesystem hardening
- [ ] P15B — untrusted retrieved-context / prompt-injection boundary
- [ ] P15C — provider + MCP failure isolation
- [ ] P15D — cancellation / timeout / network failure matrix
- [ ] P15E — secret / error / telemetry leakage hardening
- [ ] P15F — security regression matrix + report

Phase 15 result: **IN PROGRESS — P15A complete; next P15B**

## Memory integration gate

- [ ] MEM-X — audit real existing Sonor
- [ ] preserve/back up real Sonor source safely
- [ ] verify minimal Sonor search API
- [ ] ASTRA project retrieval test
- [ ] ALURKA project-scoping test
- [ ] Obsidian provenance test
- [ ] Graphify provenance/relationship test
- [ ] Sonor unavailable degradation test
- [ ] Sonor cancellation test

Memory integration result: **PENDING / REAL LOCAL ACCESS REQUIRED**

## Phase 16 — Performance

- [ ] real hardware/browser environment recorded
- [ ] Humanoid HIGH baseline measured
- [ ] runtime/provider/memory latency measured
- [ ] bottlenecks fixed without lowering visual quality first
- [ ] no release-blocking console error
- [ ] `docs/PERFORMANCE_BASELINE.md` filled with real measurements

Phase 16 result: **PENDING**

## Phase 17 — Full-system validation

- [ ] Scenario A — project continuation
- [ ] Scenario B — engineering PR workflow
- [ ] Scenario C — ALURKA campaign
- [ ] Scenario D — Calendar / Email
- [ ] Scenario E — emergency STOP
- [ ] failure variants recorded
- [ ] `docs/FULL_SYSTEM_VALIDATION.md` filled with evidence

Phase 17 result: **PENDING**

## Repository cleanup before RC

- [ ] Compare stale PR #51 to current main
- [ ] Port only genuinely unique unsuperseded behavior/tests
- [ ] Close PR #51 as superseded if nothing useful remains
- [ ] verify no abandoned release-blocking branch is required
- [ ] verify no secret/private runtime file is tracked

## Phase 18 — Release Candidate

- [ ] npm test
- [ ] npm run typecheck
- [ ] npm run lint
- [ ] npm run build
- [ ] npm audit --audit-level=high
- [ ] git diff --check
- [ ] security matrix complete
- [ ] performance baseline complete
- [ ] full-system validation complete
- [ ] target-PC Automation result known
- [ ] Sonor result known truthfully

Phase 18 result: **PENDING**

## Phase 19 — Windows ready-to-use release

- [ ] install path verified
- [ ] startup tasks verified
- [ ] loopback binding verified
- [ ] Ollama/model verified
- [ ] Codex status verified
- [ ] Automation status verified
- [ ] Sonor status verified
- [ ] private runtime directories verified
- [ ] read-only self-check available
- [ ] reinstall/update path verified

Phase 19 result: **PENDING**

## Phase 20 — ASTRA MAX Core Release Gate

- [ ] COMPLETED section filled
- [ ] VERIFIED section filled
- [ ] CONNECTED section filled
- [ ] REQUIRES USER LOGIN section filled
- [ ] REQUIRES PHYSICAL TEST section filled
- [ ] NOT IMPLEMENTED section filled
- [ ] SECURITY STATUS filled
- [ ] PERFORMANCE STATUS filled
- [ ] TEST STATUS filled
- [ ] RELEASE STATUS selected from allowed values

Allowed release status:

- `READY`
- `READY WITH EXTERNAL CONFIGURATION REQUIRED`
- `BLOCKED`

Phase 20 result: **PENDING**

---

## Codex update rule

After each merged subphase:

1. check only boxes supported by real evidence;
2. add PR/commit reference beside the completed item when useful;
3. update `docs/CODEX_HANDOFF.md`;
4. update `docs/SECURITY_VALIDATION.md` when Phase 15 evidence changes;
5. continue the next implementable unchecked task;
6. do not wait idle on an external/local-only blocker if independent repository work remains.

After Phase 20 stabilizes, continue Phase 21–30 from `docs/ASTRA_MAX.md`.
