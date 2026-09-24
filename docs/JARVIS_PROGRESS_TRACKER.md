# JARVIS REPOSITORY FOUNDATION TRACKER

## Codex target refinement — PR #239 merged

- [x] Native read-only Windows startup-task probe fixed and merged in PR #239.
- [x] PR #239 exact head CI passed; clean production source installed on PC1.
- [x] Default self-check and Windows release validator passed on PC1.
- [x] Private registry contains only three individually reverified remote Windows targets; PC1 remains LOCAL.
- [x] Direct ASTRA marker checks passed on all three registered remotes.
- [x] Unknown-node fail-closed check passed.
- [ ] Remote administrator/file/service-control evidence on each selected trusted node.
- [ ] Unreachable/wrong-node fail-closed evidence plus long-running remote STOP/KILL.
- [ ] One pinned-target multi-step project task end-to-end.

## Draft preparation while Codex owns target evidence

- [x] Prepare multi-PC target evidence runbook with bounded rollback and fail-closed criteria.
- [x] Prepare final release execution matrix covering core M1-M6 and extended JARVIS/NVIDIA gates.
- [x] Prepare non-destructive branch hygiene plan; no branch deletion authorized during target evidence.
- [x] Prepare public-safe multi-PC evidence result template; private topology/results stay under `.astra/`.
- [x] Prepare final release freeze checklist.
- [x] Prepare post-Codex reconciliation checklist.
- [x] Verify 12 recent merged branch candidates have `ahead_by = 0` against current main; re-check before any future deletion.
- [x] Audit PR #241 + SSH/config core files for private alias/IP/key-path/credential leakage: PASS across 20 directly inspected files.
- [x] Audit authoritative draft docs for stale multi-PC/PR #239 status and mark current instructions/snapshots correctly as post-bootstrap or historical/superseded.
- [x] Prepare exact-build evidence-freeze protocol in draft PR #241.
- [ ] Merge draft preparation only after the current commit-bound target checkpoint is complete.

## Recovery

Inspect current `main`, newest CI and open PRs first. Resume an existing open PR before starting new work. Treat historical branches as superseded unless a concrete missing capability is demonstrated. The 206-branch reconciliation is documented in `docs/CROSS_SESSION_RECONCILIATION_2026-09-22.md`.

## 2026-09-24 full-audit follow-up

- [x] Full repository/runtime-readiness audit recorded in `docs/FULL_AUDIT_2026-09-24.md`.
- [x] Fix direct read-only Computer fast path so explicit remote target is never silently converted to LOCAL.
- [x] Fix remote `computer.system.info` timeout mismatch with SSH connect timeout and add regression coverage.
- [x] Synchronize stale MEM-X/Sonor status in AGENTS / ASTRA_MAX / CODEX_NEXT_MISSION / TARGET_PC_EVIDENCE.
- [x] Normalize duplicate/non-task tracker entries, including duplicate NVIDIA NVA-2…NVA-9 real-integration gates.
- [x] Harden SSH bootstrap with temp-validate-replace semantics and reject nested secret/unknown node-config fields.
- [x] Review CI warnings: removed safe unused code/imports and fixed the HumanoidLabV9 gesture-hook dependency path without changing approved visuals. Raw `<img>` optimization warnings remain intentionally visible until an equivalent fidelity-preserving migration is proven.

## 2026-09-24 post-remediation hardening

- [x] Fail closed on an explicitly targeted remote read when the requested remote tool/node is unavailable or fails; do not fall through to planner/local reinterpretation.
- [x] Reject secret-like and unsupported fields at the root of the private computer-node registry, not only inside node entries.

## Project continuity / ChatGPT ↔ Codex collaboration

- [x] Durable cross-session collaboration protocol added: `docs/ASTRA_COLLABORATION_PROTOCOL.md`.
- [x] New-session recovery requires live `main`/CI/open-PR inspection before implementation.
- [x] Every meaningful ChatGPT/Codex change must update pointer + tracker + worklog + relevant handoff/validation docs.
- [x] Explicit no-repeat rule for merged, active, blocked and repo-complete/target-pending work.
- [x] No-competition division: ChatGPT handles safe repository work; Codex refines/completes target/runtime/provider remainder. Better evidence-backed Codex proposals are accepted; only unjustified competing replacements are prohibited.
- [x] Mandatory transfer trail records what is complete, what remains, why, branch/PR/commit, validation, exact next action and DO NOT REPEAT scope.
Ongoing invariant: every future meaningful change must preserve these synchronization and work-ownership requirements.

## Computer Agent / Multi-PC — 2026-09-24

- [x] Local Windows `computer.system.info` Level-1 execution — PR #217.
- [x] Direct no-model read-only Computer fast path — PR #218.
- [x] Trusted local Owner Mode executor — PR #221.
- [x] Explicit direct local Owner Mode path + target validator — PR #222.
- [x] Trusted multi-PC SSH Computer Agent transport, private node registry, per-node identity verification, fail-closed routing and explicit remote Owner Mode syntax — PR #225, merge `6b3859a70f8c46ab80204b56c788e06cb8c09e60`.
- [x] Safe SSH trust-bootstrap/diagnostic helper that writes the private registry only after all requested targets verify — PR #226, merge `6cdfe8089dfb2e0273e984ca4ad9a2952d157b8e`.
- [x] Verify the owner-reported connected targets: PC1 is LOCAL and three remote Windows targets were individually reverified; exact aliases remain private.
- [x] Identify the ASTRA hub/local machine: owner confirms PC1 is LOCAL/current hub; PC1 must not be duplicated into the SSH remote registry.
- [x] Bootstrap only the three verified remote targets into the private registry and pass direct ASTRA marker validation on each.
- [ ] Real remote administrator/file/service control evidence on each selected trusted node.
- [ ] Unknown-node fail-closed is proven; still capture unreachable/wrong-node evidence plus long-running remote STOP/KILL.
- [ ] One pinned-target multi-step project task end-to-end.
Completion invariant: do not mark multi-PC Owner Mode fully complete until all target-only evidence above passes.

## Phase 24 — Event Engine

- [x] Contracts, severity floors, debounce/deduplication, quiet hours, rate limits and ACK.
- [x] Bounded private persistence, loopback management/publish API and regression tests.
- [x] Foundation PR #164 merged: `1327ee985c13c6486bcd9212cbfbc28b3d3187a0`.
- [x] Event Inbox and subscription enable/disable/ACK UI: PR #175 merged `56059728be8ef60b1badb58a8ef13bade2ba569b`, CI #486 SUCCESS, main CI #487 SUCCESS.
- [x] First real-source adapter code: read-only opt-in GitHub Actions workflow runs, exact GitHub API host, bounded fetch/timeout, local sync, mapped provenance and repeat-state dedupe. PR #176 merged `059241751f7b70ac5e4ad6b044f8e8cceeab5787`, PR CI #494 SUCCESS. This marks adapter code, NOT a completed target-PC live test.
- [ ] GitHub adapter real target-runtime sync and notification evidence.
- [x] Second real event source adapter — local Diagnostics/service-health transitions, PR #180 merged `3047ea30c060211c2c3c8aabc7b4920e0f7166d1`; PR CI #506 SUCCESS, main CI #507 SUCCESS. Repository adapter code is complete; this is not target-runtime delivery evidence.
- [ ] Service-health source real target-runtime sync and notification evidence.
- [x] Third real event source adapter — Automation lifecycle → Event Engine, PR #182 merged `d04876391483500dda4f0755c4f1c120a25eae07`; PR CI #512 SUCCESS. Post-merge CI #513 exposed only a nondeterministic async integration-test wait; PR #183 merged `0f1cff3723aeb30a56270b86d5b8dcfef713ca2a`, CI #516 SUCCESS, main CI #517 SUCCESS. Runtime bridge behavior was unchanged by the hotfix.
- [ ] Automation lifecycle source real target-runtime notification/STOP/restart evidence.
- [ ] Proactive notification delivery, failure/STOP and restart evidence on target PC.

## Phase 25 — Durable Background Task Manager

- [x] Contracts, dependency DAG/cycle rejection, bounded concurrency and locks.
- [x] Level 0/1 unattended ceiling, Level 2/3 approval waiting and global STOP.
- [x] Bounded private store, pause/resume/cancel, active abort, retries/backoff, checkpoints, restart recovery and bounded runner.
- [x] Loopback task management API and regression coverage; PR #165 merged `2169d260ae4e52577053af442e10edc7ca1b6abf`.
- [x] Task-presence/queue/checkpoint UI: PR #174 merged `293216e9f94868d00b2636b125922ff09ec593db`, CI #483 SUCCESS, main CI #484 SUCCESS.
- [ ] Production executors connected and validated.
- [ ] Real target-PC restart evidence and approved Level 2/3 resume flow.
- [ ] Long-running scenario J4 evidence.

## Phase 28 — Diagnostics / Audit / Offline

- [x] Health registry, degraded/offline state model, bounded audit journal, safe recovery-plan contract.
- [x] Local-store/service aggregation, action-history query, read-only API, secret/path redaction and symlink-safe persistence.
- [x] Regression tests; PR #166 merged `a01d40ff8e378b1b1881269f0568bb65793d2e17`.
- [x] User-facing read-only health and action-history UI: PR #174 merged `293216e9f94868d00b2636b125922ff09ec593db`, CI #483 SUCCESS.
- [ ] Explicit real connectivity probe.
Provider health integration:
  - [x] Ollama/Codex/NVIDIA/Hermes/Cloud real status-probe wiring — PR #178 merged `dfc7d93fb02e8e32375dd7c3d8ebc7370232c078`; PR CI #500 SUCCESS, main CI #501 SUCCESS.
  - [ ] Sonor real health/search evidence on the target runtime; repository Diagnostics remains UNKNOWN rather than fabricating readiness.
- [ ] Safe recovery execution through existing Tool Runtime — blocked until a real recovery-specific tool exists; current generic tools do not truthfully implement provider reconnect/service restart/cache-clear.
- [ ] Offline/degradation scenario J8 evidence.

## Phase 22 — Identity / Trust / Secrets

- [x] Trusted-session/device contracts, capability scopes and lock/unlock state.
- [x] Secret abstraction, opt-in environment provider, strict secret/memory separation, hashed private trusted-device metadata and terminal revoke.
- [x] Tests; PR #167 merged `a2b289d9118c8883608379320784b7bc047f980c`.
- [ ] Target-PC OS/session identity, owner/device pairing UX and OS secret store where appropriate.
- [ ] Speaker recognition only as a convenience signal, never sole authorization.
- [ ] Real lock/unlock and secret-use evidence.

## Phase 27 — Multi-device

- [x] Private registry, single-use expiring hashed pairing challenge, capability expiry and per-device Level 0–3 ceilings.
- [x] Phase-22 trust prerequisite, terminal revoke, deterministic routing, approval preservation, no public unauthenticated transport and bounded symlink-safe storage.
- [x] Tests; PR #168 merged `aa91850f68dc5bc677cb14a11cd54ab5da9fa36a`; main CI #451 SUCCESS.
- [x] Select SSH as the real PC-to-PC transport and merge its repository implementation through the Computer Agent — PR #225/#226. This does not prove physical target readiness.
- [ ] Complete the broader Phase-27 paired-device/mobile contract: pairing, authenticated dispatch/result return and immediate revoke evidence. PC2-PC4 SSH target validation is owned only by the Computer Agent / Multi-PC section above.
- [ ] Scenario J6 evidence.

## Phase 29 — Generic Skill / Device Registry

- [x] Generic manifests, Tool Registry mappings, permission/network/secret-name requirements and untrusted-by-default reviews.
- [x] Install/enable/disable/version/health/update/rollback contract and private persistence.
- [x] Explicit environment-device contracts, disabled-by-default devices, Level 3+ writes/approval, camera/sensor privacy and no unauthenticated public control.
- [x] Tests; PR #169 merged `390a5c35e50a5020ccf34f317edcc25f4837dcb1`; main CI #458 SUCCESS.
- [ ] One real provider-backed skill lifecycle with evidence.
- [ ] One real environment/device provider and Tool Runtime invocation/telemetry/verification.
- [ ] Scenario J9 evidence.

## Deferred environment-gated work

- [ ] Phase 21 real always-on voice transport.
- [ ] Phase 23 real screen/camera pixel transport.
- [ ] Phase 26 real Sonor-backed episodic context fusion.
- [ ] Phase 30 final JARVIS integration/soak/evaluation.

Other real release gates retain the execution order `Phase 14 → MEM-X → Phase 16 → Phase 17 → Phase 19 → Phase 20`. See `docs/CODEX_NEXT_MISSION.md` and the canonical execution pointer. No repository CI or mocked response proves production readiness. Paid cloud stays opt-in, approval/STOP remain authoritative, and no new Brain or duplicate Sonor pipeline is allowed.
