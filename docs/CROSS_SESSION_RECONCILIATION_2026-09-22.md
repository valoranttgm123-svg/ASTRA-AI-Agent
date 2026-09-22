# ASTRA Cross-Session Reconciliation — 2026-09-22

Purpose: prevent interrupted ChatGPT/Codex sessions and historical Git branches from becoming competing sources of truth.

## Authority order

Use this order whenever histories disagree:

1. current `main` code;
2. current `main` CI;
3. open PR state;
4. `docs/CURRENT_EXECUTION_POINTER.md`;
5. `docs/JARVIS_PROGRESS_TRACKER.md`;
6. `docs/SESSION_RECOVERY.md`;
7. current handoff/worklog;
8. historical branches and chat transcripts.

A historical branch with unique commits is **not** automatically unfinished work.

## Pasted Phase 21–30 repository plan reconciliation

The repository-only work from the earlier session is accounted for as follows:

| Phase | Repository foundation | Current truth |
| --- | --- | --- |
| 24 Event Engine | event contracts, subscriptions, severity, debounce/dedup, quiet hours, rate limiting, acknowledgement, private persistence, tests | **MERGED** in PR #164 |
| 25 Durable Background Tasks | durable IDs/queue, pause/resume/cancel, retry/backoff, timeout/checkpoints, dependency DAG, bounded concurrency, restart recovery, STOP | **MERGED** in PR #165 |
| 28 Diagnostics/Audit/Offline | health model, offline/degraded state, audit journal, recovery planning, runtime/service aggregation, action history | **MERGED** in PR #166 |
| 22 Identity/Trust/Secrets | trusted sessions/devices, scopes, secret-provider boundary, lock/revoke semantics, private metadata | **MERGED** in PR #167 |
| 27 Multi-device | paired-device registry, pairing challenge, capability advertisement, permission ceiling, revoke, task routing | **MERGED** in PR #168 |
| 29 Generic Skill/Environment | generic skill manifest/lifecycle/health/rollback plus explicit environment device registry and approval/privacy rules | **MERGED** in PR #169 |

PR #170 finalized the durable checkpoint and recovery pointers.

These are repository foundations, not proof of real hardware/provider integration.

## Intentionally not completed by repository-only work

The earlier decision to defer these remains correct:

- Phase 21 real always-on voice transport;
- Phase 23 real screen/camera pixel transport;
- Phase 26 real Sonor-backed episodic/context fusion;
- Phase 30 final JARVIS scenarios and soak.

Real validation also remains required for the already-built core gates:

- Phase 14 target-PC Automation approval/STOP evidence;
- MEM-X real Sonor/Graphify/Obsidian evidence;
- Phase 16 target browser/Humanoid/main-UI measurements;
- Phase 17 real full-system scenarios;
- Phase 19 Windows install/update/reinstall evidence;
- Phase 20 final evidence-backed release report.

## Historical divergent branches reviewed

### Superseded: old Phase 28 prototype

`feature/phase28-diagnostics-audit` has unique commits, but the later merged `feature/phase28-diagnostics-audit-offline` implementation on `main` provides the current diagnostics/audit/offline model, runtime aggregation, recovery planning and tests. Do not merge the old prototype.

### Superseded: old Phase 29 extensions prototype

`feature/phase29-extension-environment-registry` has unique `lib/extensions/*` commits. The merged Phase 29 implementation uses canonical `lib/skills/*` and `lib/environment/*`, with verified lifecycle state, Tool Registry health checks, private persistence and regression tests. Do not revive the parallel extension subsystem.

Ideas present only in the prototype, such as environment-device terminal revoke or device-level network/secret metadata, are optional future enhancements unless a real provider requires them; they are not missing from the earlier Phase 29 checklist.

### Superseded: Windows private-evidence prototype

`windows/private-evidence-reparse-hardening` is divergent, but current `main` has `scripts/windows/private-evidence-output.ps1`, reparse-point rejection, guarded collector/validator integration and regression tests. Do not merge the old helper.

### Superseded: old V15 telemetry branch

`astra/v15-brain-streaming-telemetry` is divergent, but current `main` already has the guarded SSE `/api/agent/stream`, live runtime event handling in `AstraRuntime`, and a much later Brain implementation. Do not revive it.

### Documentation-only historical branch

`docs/sync-phase20-codex-handoff` contains stale handoff/document commits. Current `main` pointers and trackers are newer and authoritative.

## Genuine omission recovered

`astra/main-ui-performance-evidence` contained useful intent for measuring the two Phase 16 UI scenarios that current documentation still marks as needing real evidence:

- Command Center active;
- Automation panel open.

The old branch itself was incomplete: its probe was not mounted in `app/page.tsx`, and its asynchronous capture read React runtime state through a stale closure.

The recovery implementation is being rebuilt on current `main` in:

`fix/cross-session-ui-performance-reconciliation`

It must be merged only after current-head CI is green. Real target-browser measurements remain pending after merge.

## Branch hygiene rule

Do not delete historical branches merely to make the repository look clean; they are useful forensic history. Do not treat them as work queues either.

A future branch is actionable only when one of these is true:

- it has an open PR;
- the current execution pointer names it;
- a fresh comparison identifies a concrete capability missing from `main`;
- the owner explicitly requests revival.

This document is the reconciliation map for interrupted-session history.
