# JARVIS REPOSITORY FOUNDATION TRACKER

> This tracker covers repository-only foundations that the owner explicitly authorized while target-PC/Codex execution is unavailable.
>
> It does not replace real target-PC release gates or `docs/ASTRA_MAX.md`.

## Recovery rule

On every new session:

1. inspect current `main`, open PRs and CI;
2. read `docs/CURRENT_EXECUTION_POINTER.md`;
3. read this tracker;
4. resume the first active/unmerged slice;
5. never recreate a merged slice from chat memory.

## Phase 24 — Event Engine

- [x] event/subscription contracts
- [x] severity floors
- [x] debounce/deduplication
- [x] quiet hours
- [x] rate limiting
- [x] acknowledgement
- [x] private bounded persistence
- [x] loopback management/publish API
- [x] regression tests
- [x] PR #164 CI green
- [x] PR #164 merged → `1327ee985c13c6486bcd9212cbfbc28b3d3187a0`
- [x] Event Inbox / subscription UI — PR #175 merged → `56059728be8ef60b1badb58a8ef13bade2ba569b`; PR CI #486 green

Real adapters still required:
- [ ] GitHub Actions event source adapter — PR #176 active on `feature/github-actions-event-adapter` (mark complete only after green merge)
- [ ] real target-runtime GitHub sync evidence
- [ ] second real event source
- [ ] third real event source
- [ ] target-runtime proactive notification evidence

## Phase 25 — Durable Background Task Manager

Repository foundation:
- [x] durable task contracts
- [x] dependency DAG + cycle rejection
- [x] bounded concurrency planning
- [x] resource-lock serialization
- [x] Level 0/1 unattended ceiling
- [x] Level 2/3 approval waiting state
- [x] private bounded task persistence
- [x] pause/resume/cancel lifecycle
- [x] active-task abort registry
- [x] retry/backoff
- [x] checkpoints
- [x] restart recovery
- [x] bounded parallel runner
- [x] global STOP propagation
- [x] loopback task management API
- [x] regression tests
- [x] PR #165 CI green
- [x] merged to `main` → `2169d260ae4e52577053af442e10edc7ca1b6abf`

Real integration later:
- [ ] production task executors connected
- [x] UI/runtime task presence — PR #174 merged → `293216e9f94868d00b2636b125922ff09ec593db`; PR CI #483 green
- [ ] restart evidence on target PC
- [ ] approved Level 2/3 task-resume flow
- [ ] long-running scenario J4 evidence

## Phase 28 — Diagnostics / Audit / Offline foundation

Repository foundation:
- [x] health registry
- [x] degraded/offline state model
- [x] bounded audit journal
- [x] safe recovery-plan contract
- [x] provider/service aggregation from real local stores/services
- [x] action-history query contract
- [x] read-only diagnostics API
- [x] secret/path redaction in audit records
- [x] symlink-safe private audit persistence
- [x] tests
- [x] PR #166 CI green
- [x] merged → `a01d40ff8e378b1b1881269f0568bb65793d2e17`

Real integration later:
- [ ] explicit real internet/connectivity probe
- [ ] Ollama/Codex/Sonor/NVIDIA health adapters from real runtime
- [ ] safe recovery execution wired through Tool Runtime
- [ ] offline degradation scenario J8 evidence
- [x] action-history UI / user-facing diagnostics panel — PR #174 merged → `293216e9f94868d00b2636b125922ff09ec593db`; PR CI #483 green

## Phase 22 — Identity / Trust / Secret boundary

Repository foundation:
- [x] trusted session/device contracts
- [x] capability scopes
- [x] lock/unlock state
- [x] secret-provider abstraction
- [x] environment-backed explicit secret provider
- [x] secret/memory separation invariants
- [x] private hashed trusted-device metadata store
- [x] revoked-device fail-closed semantics
- [x] tests
- [x] PR #167 CI green
- [x] merged → `a2b289d9118c8883608379320784b7bc047f980c`

Real integration later:
- [ ] target-PC trusted OS/session identity adapter
- [ ] owner/device pairing UX
- [ ] Windows credential/secret provider where appropriate
- [ ] speaker-recognition adapter only as convenience signal, never sole authorization
- [ ] target-PC lock/unlock and secret-use evidence

## Phase 27 — Multi-device foundation

Repository foundation:
- [x] private paired-device registry
- [x] single-use secure pairing challenge contract
- [x] token hashing / timing-safe verification
- [x] capability advertisement with expiry
- [x] per-device permission ceiling (Level 0-3 only)
- [x] linked Phase-22 trusted-device requirement before pairing
- [x] terminal revoke semantics
- [x] deterministic task-routing contract
- [x] Level 2/3 routing preserves approval requirement
- [x] no public/unauthenticated transport surface
- [x] symlink-safe bounded persistence
- [x] tests
- [x] PR #168 CI green (PR run #450; main run #451)
- [x] merged → `aa91850f68dc5bc677cb14a11cd54ab5da9fa36a`

Real integration later:
- [ ] real second-device transport selected (LAN/SSH/authenticated relay)
- [ ] encrypted/authenticated channel validated
- [ ] target-PC/PC2/mobile pairing UX
- [ ] task dispatch + result return wired to real transport
- [ ] immediate revoke observed end to end
- [ ] scenario J6 evidence

## Phase 29 — Generic Skill / Device Registry

Repository foundation:
- [x] generic skill manifest
- [x] provider/tool mapping through existing Tool Registry
- [x] permission/network/secret-name requirements
- [x] explicit untrusted → reviewed trust state
- [x] install/enable/disable/version/health lifecycle
- [x] verified update/rollback metadata and state transitions
- [x] private bounded generic skill persistence
- [x] explicitly registered device/environment contract
- [x] device disabled-by-default behavior
- [x] write operations require Level 3+ and preserve approval
- [x] camera/sensor sensitive privacy classification + per-operation consent
- [x] no automatic trust for downloaded skills
- [x] no public unauthenticated environment endpoint
- [x] tests
- [x] PR #169 final CI run #457 green
- [x] merged → `390a5c35e50a5020ccf34f317edcc25f4837dcb1`; main CI #458 green

Real integration later:
- [ ] one real provider-backed generic skill installed/disabled/rolled back with evidence
- [ ] one real safe environment/device provider connected
- [ ] Tool Runtime invocation + real telemetry/verification
- [ ] scenario J9 evidence

## Deferred because real environment is required

- Phase 21 real always-on voice transport;
- Phase 23 real pixels/screen/camera transport;
- Phase 26 real Sonor-backed episodic context fusion;
- Phase 30 final JARVIS integration/soak/evidence.

Do not fake these with repository-only mocks and call them READY.


## Cross-session reconciliation status

The repository-only JARVIS foundation tracker was cross-checked against all 206 branches on 2026-09-22.

Result:
- Phase 24/25/28/22/27/29 foundations remain canonical and merged;
- no alternate historical branch contains a missing replacement foundation;
- PR #171 recovered the separate Phase 16 main-UI evidence omission and merged at `cc8432edcf9e854bba9d0d78c14c7731fd279dbd`;
- real environment items in this tracker remain intentionally unchecked until actual target/provider evidence exists.

Do not convert unchecked real-integration items into repository-only mocks.
