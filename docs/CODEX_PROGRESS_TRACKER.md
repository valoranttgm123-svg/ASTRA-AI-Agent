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
- [x] P15B — untrusted retrieved-context / prompt-injection boundary
- [x] P15C — provider + MCP failure isolation
  - [x] P15C1 — MCP discovery/descriptor/call isolation — PR #99
  - [x] P15C2 — Ollama/Hermes/Codex/Cloud outage + malformed-response matrix — PR #100
- [x] P15D — cancellation / timeout / network failure matrix
  - [x] P15D1 — provider/Strategist/Memory/browser/Tool Runtime cancellation+timeout — PR #101
  - [x] P15D2 — Codex child process + Automation/Command Center STOP settlement — PR #102
- [x] P15E — secret / error / telemetry leakage hardening — PR #103
- [x] P15F — security regression matrix + report — PR #104

Phase 15 result: **REPOSITORY COMPLETE ON GREEN MERGE / LOCAL RELEASE GATES REMAIN**

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

- [x] P16A — repository runtime measurement harness implemented — PR #105
- [ ] P16B — target-PC runtime measurements captured
- [ ] P16C — browser/Humanoid HIGH measurements captured
- [ ] P16D — evidence-based bottleneck fixes and re-measurement
- [ ] real hardware/browser environment recorded
- [ ] Humanoid HIGH baseline measured
- [ ] runtime/provider/memory latency measured
- [ ] bottlenecks fixed without lowering visual quality first
- [ ] no release-blocking console error
- [ ] `docs/PERFORMANCE_BASELINE.md` filled with real measurements

Phase 16 result: **IN PROGRESS — instrumentation only; no target-PC measurements claimed**

## Phase 17 — Full-system validation

- [x] P17A — safe chat-mode preflight evidence runner implemented — PR #106
- [ ] P17B — target-runtime A–D preflight evidence captured
- [ ] P17C — approved real execution for scenarios requiring writes/integrations
- [ ] P17D — real emergency STOP scenario
- [ ] Scenario A — project continuation
- [ ] Scenario B — engineering PR workflow
- [ ] Scenario C — ALURKA campaign
- [ ] Scenario D — Calendar / Email
- [ ] Scenario E — emergency STOP
- [ ] failure variants recorded
- [ ] `docs/FULL_SYSTEM_VALIDATION.md` filled with evidence

Phase 17 result: **PREPARATION IN PROGRESS — no scenario PASS claimed yet**

## Repository cleanup before RC

- [x] Compare stale PR #51 to current main — `docs/PR51_TELEMETRY_AUDIT.md`
- [x] Port only genuinely unique unsuperseded behavior/tests — none identified; no port required
- [x] Close PR #51 as superseded if nothing useful remains — closed after audit
- [x] verify no abandoned release-blocking branch is required — no open PRs; historical branches retained as non-blocking snapshots
- [x] verify no secret/private runtime file is tracked — current tree scan clean

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

- [x] P19A — read-only readiness self-check implemented — current PR
- [ ] P19B — target-PC self-check evidence captured
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

Phase 19 result: **IN PROGRESS — self-check tooling only; target-PC readiness not claimed**

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
