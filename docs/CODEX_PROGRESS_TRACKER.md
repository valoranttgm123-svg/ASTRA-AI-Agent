# CODEX PROGRESS TRACKER — Phase 15 → Phase 20

> Update this checklist only from real merged/verified work.

24 September browser refinement: PR #223 production is verified (446 tests;
CI #605/#606). Graphics denial still caused repeated async initialization errors.
The follow-up availability fallback preserves artwork and blocks false 3D
measurement; see `WEBGL_FALLBACK_2026-09-24.md`. Full HIGH/physical gates remain open.

24 September refinement: reproduced runtime HTTP 500 and stopped Ollama after
PR #222. See `RUNTIME_RECOVERY_2026-09-24.md`. The development repair and harmless
local Owner Mode probe pass; these do not complete physical/multi-PC/core gates.
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

- [x] MEM-X — audit real existing Sonor (PR #188/#189, dated target-PC refinement note)
- [x] preserve/back up real Sonor source safely (local source-only backup and Git baseline; private GitHub remote still blocked)
- [x] verify minimal Sonor search API (live loopback recheck 2026-09-23)
- [x] ASTRA project retrieval test (6 scoped records)
- [x] ALURKA project-scoping test (6 scoped records)
- [x] Obsidian provenance test (live source type/reference preserved)
- [x] Graphify provenance/relationship test (live source type/reference preserved)
- [ ] Sonor unavailable degradation test
- [ ] Sonor cancellation test

Memory integration result: **LIVE RETRIEVAL VERIFIED / PRIVATE REMOTE AND REMAINING RELEASE GATES OPEN**.
Connection-refusal/pre-abort and HTTP-fixture in-flight cancellation passed;
the stricter production-outage/active-query cancellation check remains unchecked.

## Phase 16 — Performance

23 September target refinement: PR #213 was measured live; warm Ollama SSE
first token 267–336 ms. An uncached system prefix, not model load, took 6.8 s in
the direct trace. See `OLLAMA_PREFILL_REFINEMENT_2026-09-23.md` for the compact
lightweight-prompt fix. Full browser/physical release gates remain open.

- [x] P16A — repository runtime measurement harness implemented — PR #105
- [ ] P16B — target-PC runtime measurements captured
- [x] P16C-tooling — private browser/Humanoid HIGH evidence capture implemented — PR #124
- [x] P16C-main-ui-tooling — Command Center / Automation-panel evidence recovery — PR #171, merge `cc8432edcf9e854bba9d0d78c14c7731fd279dbd`, CI #466 green
- [ ] P16C — browser/Humanoid HIGH measurements captured
- [ ] P16D — evidence-based bottleneck fixes and re-measurement
- [ ] real hardware/browser environment recorded
- [ ] Humanoid HIGH baseline measured
- [ ] runtime/provider/memory latency measured
- [ ] bottlenecks fixed without lowering visual quality first
- [ ] no release-blocking console error
- [ ] `docs/PERFORMANCE_BASELINE.md` filled with real measurements

Phase 16 result: **IN PROGRESS — runtime + browser evidence tooling implemented; no target-PC measurements claimed**

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
- [x] verify no abandoned release-blocking branch is required — stale PR #51 reconciled; historical branches retained as non-blocking snapshots
- [x] reconcile Release Candidate PR #111 — closed as superseded by current-main PR #119
- [x] verify no secret/private runtime file is tracked — current tree scan clean

## Phase 18 — Release Candidate

- [x] P18A — repository RC gate automation merged — PR #119
  - stale/diverged PR #111 closed as superseded;
  - current-main implementation adds `npm run release:repo-gate` plus CI diff checks.
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

Phase 18 result: **REPOSITORY GATE IMPLEMENTED / PROGRAM + LOCAL RELEASE GATES REMAIN**

## Phase 19 — Windows ready-to-use release

Repository tooling merged:

- [x] P19A — read-only readiness self-check — PR #109
- [x] P19B — safe fast-forward update + non-destructive reinstall tooling — PR #110
- [x] P19C — read-only Windows install preflight — PR #115
- [x] P19D — read-only Windows release invariant validator — PR #113
- [x] P19E — Ollama loopback-only startup hardening — PR #114
- [x] P19F — ASTRA loopback runtime identity/binding hardening — PR #116
- [x] P19G — bounded startup health gate — PR #117
- [x] target-PC read-only evidence collector — PR #121
  - orchestrates existing preflight/self-check/release-validator/Automation-status checks;
  - optional performance and chat-preflight remain explicit opt-ins;
  - always records `ReleaseVerdict = NOT_EVALUATED`.

Target-PC evidence still required:

- [ ] target-PC self-check + install/update/reinstall evidence captured
- [ ] install path verified
- [ ] startup tasks verified
- [ ] loopback binding verified
- [ ] Ollama/model verified
- [ ] Codex status verified
- [ ] Automation status verified
- [ ] Sonor status verified
- [ ] private runtime directories verified
- [ ] read-only self-check executed successfully
- [ ] reinstall/update path verified
- [ ] bounded startup health gate executed successfully on the real target PC

Phase 19 result: **REPOSITORY TOOLING ADVANCED THROUGH P19G / TARGET-PC READINESS NOT YET VERIFIED**

## Phase 20 — ASTRA MAX Core Release Gate

Repository/report tooling:

- [x] conservative core report generator — PR #123
- [x] manual/physical gate recorder with real-evidence requirement — PR #125
- [x] final-report context recorder (connected/login/not-implemented/external-config) — PR #126
- [x] browser/Humanoid evidence can be referenced from private `.astra/performance/` artifacts — PR #124
- [x] Phase 20 evidence-shape + private-path hardening — PR #129
  - runtime evidence requires valid timestamp + real samples for all required status endpoints;
  - chat preflight requires completed A–D scenarios with structured evidence;
  - evidence inputs must resolve to regular files inside the real `.astra/` root; symlink escapes/directories fail closed.
- [x] running ASTRA build identity embedded and required by evidence capture — PR #142
- [x] target-PC evidence persists runtime identity and rejects duplicate/non-PASS checks — PR #143
- [x] runtime/performance/preflight evidence verifies the same clean build at capture start + completion — PR #144
- [x] browser/Humanoid HIGH evidence verifies start/end runtime identity and rejects stale browser/server builds — PR #145
- [x] browser release bundle binds every scenario to current runtime commit — PR #147
- [x] optional cloud remote transport requires HTTPS and rejects embedded credentials — PR #148
- [x] GitHub external push validates exact `github.com` remote host — PR #149
- [x] STOP/timeout terminates full owned subprocess trees — PR #150
- [ ] run repository gate and collect real private evidence on target environment
- [ ] generate final core release report from real evidence

Final report content:

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

Phase 20 result: **REPOSITORY-SIDE RELEASE/SECURITY AUDIT COMPLETE THROUGH PR #150 / FINAL VERDICT BLOCKED UNTIL REAL TARGET-PC EVIDENCE EXISTS**

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

---

## NVIDIA MAX integration track

Canonical plan: `docs/NVIDIA_MAX_INTEGRATION.md`.

### NVA-0 — governance/framework foundation

- [x] canonical NVIDIA subsystem registry added;
- [x] on-demand NVIDIA Skill Hub core manifest added;
- [x] skill recommendation is bounded and advisory-only;
- [x] NVIDIA integrations cannot claim direct execution authority;
- [x] regression tests added;
- [x] NVIDIA framework included in lint gate;
- [x] roadmap/recovery/handoff update prepared in feature branch;
- [x] PR #159 CI green and merge commit `e155c75f98da4e07ca3c07b7f15d46ceb655f417` on `main`.

### NVA-1 — Skill Hub discovery/install-state

Repository contract:
- [x] provider-neutral catalog discovery/cache contract;
- [x] private installed-skill registry under `.astra/`;
- [x] available/installed/disabled/incompatible truth states;
- [x] provenance/version/checksum fields when available;
- [x] dry-run install/update/remove planning;
- [x] local mutation plans require Permission Level 2;
- [x] bounded/symlink-safe private catalog + state persistence;
- [x] NVA-1 PR #160 CI green and merge commit `af7e05e1252b1b80e94b32cfbfedff6f2c7e006b` on `main`.

Target-PC completion:
- [ ] real NVIDIA catalog provider/mechanism selected from supported NVIDIA tooling;
- [ ] target-PC Codex skill mechanism verified against actual Codex version;
- [ ] approved core skills installed and truth-state recorded;
- [ ] rollback/update/remove tested without leaking secrets.

### NVA-2 through NVA-9

Repository contracts are complete and merged through PR #161. Real integration remains pending:

- [ ] NVA-2 real AI-Q backend connected/validated;
- [ ] NVA-3 real NeMo Retriever/RAG connected under audited Sonor;
- [ ] NVA-4 real Document Intelligence backend connected;
- [ ] NVA-5 real Nemotron Voice/Speech connected and measured;
- [ ] NVA-6 real DeepStream/VSS vision connected with actual pixels;
- [ ] NVA-7 real NemoClaw/Hermes learned workflow capture/replay validated;
- [ ] NVA-8 real NeMo Guardrails/Content Safety deployment validated;
- [ ] NVA-9 real evaluation suites executed against exact target runtime/build.

These tasks do not replace target-PC core release evidence. When real PC access exists, Phase 14 → MEM-X → 16 → 17 → 19 → 20 remains the immediate release-gate sequence.

## NVIDIA MAX repository contract saturation — NVA-2 through NVA-9

Repository contracts implemented on `feature/nvidia-max-subsystem-contracts`:

- [x] NVA-2 AI-Q bounded/cancellable research provider contract + safe fallback;
- [x] NVA-3 Retriever project/namespace isolation contract;
- [x] NVA-4 immutable bounded Document Intelligence contract;
- [x] NVA-5 truthful Voice state/STOP contract;
- [x] NVA-6 real-payload/consent Vision contract;
- [x] NVA-7 NemoClaw learned-workflow permission/provenance contract;
- [x] NVA-8 Guardrail no-authorization contract;
- [x] NVA-9 evaluation exact-build evidence/no-self-READY contract;
- [x] regression tests for the above;
- [x] NVA-2…NVA-9 PR #161 CI green and merge commit `84e5eb6aeb20dbdb737dc6d9ace149adfac73dbb` on `main`.

The canonical real-integration checklist is the single NVA-2 through NVA-9 list above; do not count or execute a duplicate second checklist.

Once this PR merges, repository-only NVIDIA architecture should be considered saturated. Do not invent backend schemas to create more repo churn. Continue real target-PC/core release work when access is available.
