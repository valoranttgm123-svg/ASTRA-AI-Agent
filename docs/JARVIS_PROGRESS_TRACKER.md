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

Real adapters still required:
- [ ] GitHub event source
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
- [ ] PR CI green
- [ ] merged to `main`

Real integration later:
- [ ] production task executors connected
- [ ] UI/runtime task presence
- [ ] restart evidence on target PC
- [ ] approved Level 2/3 task-resume flow
- [ ] long-running scenario J4 evidence

## Phase 28 — Diagnostics / Audit / Offline foundation

- [ ] health registry
- [ ] degraded/offline state model
- [ ] bounded audit journal
- [ ] safe recovery-plan contract
- [ ] provider/service aggregation
- [ ] action-history query contract
- [ ] tests
- [ ] merged

## Phase 22 — Identity / Trust / Secret boundary

- [ ] trusted session/device contracts
- [ ] capability scopes
- [ ] lock/unlock state
- [ ] secret-provider abstraction
- [ ] secret/memory separation invariants
- [ ] tests
- [ ] merged

## Phase 27 — Multi-device foundation

- [ ] device registry
- [ ] secure pairing contract
- [ ] capability advertisement
- [ ] per-device permissions
- [ ] revoke semantics
- [ ] task-routing contract
- [ ] tests
- [ ] merged

## Phase 29 — Generic Skill / Device Registry

- [ ] generic skill manifest
- [ ] provider/tool mapping
- [ ] permission/network/secret requirements
- [ ] enable/disable/version/health
- [ ] update/rollback metadata
- [ ] explicitly registered device/environment contract
- [ ] no automatic trust for downloaded skills
- [ ] tests
- [ ] merged

## Deferred because real environment is required

- Phase 21 real always-on voice transport;
- Phase 23 real pixels/screen/camera transport;
- Phase 26 real Sonor-backed episodic context fusion;
- Phase 30 final JARVIS integration/soak/evidence.

Do not fake these with repository-only mocks and call them READY.
