# ASTRA DURABLE WORKLOG

> Repository-owned chronological execution history.
>
> This file exists so Codex, ChatGPT, or a new local session can recover the project without relying on conversation history.
>
> Update this file after every merged implementation slice, security finding, release gate, or meaningful external validation.

## Recovery truth

Current `main` checkpoint:

- latest completed implementation: **Phase 15B — untrusted retrieved-context boundary**;
- latest implementation PR: **#97**;
- latest merge commit: `972dd2feb2659eb8dde9eccfcdb928c9acbccef4`;
- PR #97 CI: **SUCCESS**;
- post-merge `main` CI: **SUCCESS**;
- next implementable repository task: **Phase 15C — Provider + MCP failure isolation**;
- Phase 14 target-PC validation: **still required**;
- real Sonor/Graphify/Obsidian validation: **still requires target-PC/local access**.

## Durable milestone log

| Phase / Slice | PR | Merge commit | CI / Verification | Result / next |
| --- | ---: | --- | --- | --- |
| 14A Automation foundation | #81 | `e6d8b7a...` | CI verified | Scheduler/contracts safety foundation |
| 14B private automation store | #82 | `76d7d8d...` | CI verified | Durable private store |
| 14C1 bounded queue | #83 | `8eea45b...` | CI verified | Ready vs approval queue |
| 14C2 runner | #84 | `0fdddbd...` | CI verified | Cancellable at-most-once runner |
| 14D1 API + telemetry | #85 | `4fe5691334f2cf7ec830ad5849be05ba416af421` | CI verified | Loopback management + events |
| 14D2 approval-resume | #86 | `c282456173ca5a249463ce24ab6fe296fd3c1785` | CI verified | Exact occurrence Level 2/3 approval |
| 14D3A SSE | #87 | `8f768ce3e51c6caa36d27e1ae08abeba8fe2157f` | CI verified | Automation stream |
| 14D3B1 Runtime integration | #88 | `2dad2930b6f119dca1fa2d6427f0c5a8c955fa55` | CI verified | Shared Runtime/event bus |
| 14D3B2 panel | #89 | `8ece8be0bb548ba388b4b95f9605dd3f8964068a` | CI verified | Safe Automation UI |
| 14E1 read-only Brain ceiling | #90 | `fc166876ce113c388f06a89fb1ea263f62cbdd93` | CI verified | Hard internal Level 0/1 ceiling |
| 14E2 opt-in service | #91 | `feb442e2ee754279768531ea760a8ab8079e4bdc` | CI verified | Default-OFF local service |
| 14E3 final Automation integration | #92 | `de4fbefe6f9a23792a542a74d4d0ca1aef1aa208` | PR CI success; main CI success | Phase 14 implementation complete; target-PC validation remains |
| Codex mission handoff | #93 | `0f16be59b4268aa5c00fa3b0685b4b58f7b4262e` | CI verified | Phase 15–30 execution plan stored |
| Codex entrypoint | #94 | `1ad2831159e5d658158516e688d17618e6c53299` | CI verified | `AGENTS.md` points to current mission |
| One-line resume | #95 | `4e97211030a1259730b2c339a7aecad05b93005c` | CI verified | `lanjutkan yang belum selesai` is sufficient |
| 15A path/filesystem hardening | #96 | `125821b8edaa8dfc4d1137f26109ad24a9e394db` | CI verified | Dangling writable symlink fail-open closed |
| 15B untrusted retrieval boundary | #97 | `972dd2feb2659eb8dde9eccfcdb928c9acbccef4` | CI + post-merge main CI success | Retrieval/tool outputs are evidence, not authority; next P15C |

## Important security findings already fixed

### Phase 15A — dangling writable symlink

Previous behavior:
- `realpath()` failed for a dangling symlink;
- write resolver catch path could treat it like a safe new file.

Fix:
- `lstat()` distinguishes a real missing path from an existing symlink;
- existing writable symlinks fail closed;
- non-`ENOENT` failures fail closed;
- regression coverage lives in `tests/security-paths.test.ts`.

### Phase 15B — retrieved-content authority confusion

Previous behavior:
- local/project/Sonor memory was blended into provider context as ordinary text;
- provenance existed, but retrieved instruction-like text did not have one shared explicit authority boundary.

Fix:
- `lib/brain/context-safety.ts`;
- memory/project/Sonor/Graphify/Obsidian records become provenance-preserving JSON data;
- provider prompts state retrieved data cannot override ASTRA policy, approvals, project scope, privacy or tool authorization;
- prior plan/tool outputs are also marked UNTRUSTED DATA;
- regression coverage lives in `tests/context-safety.test.ts`.

## External/local gates that must not be faked

### Phase 14 target-PC validation

Still required:
- `scripts/windows/validate-automation.ps1`;
- optional explicit `-RunSafeTick`;
- Level-2 due occurrence remains approval-gated;
- Level-3 exact scope/single-use approval;
- STOP during real running occurrence;
- UI/service truth.

Until that occurs, report:

`PHASE 14 IMPLEMENTATION COMPLETE / CI VERIFIED / TARGET-PC VALIDATION REQUIRED`

### Sonor / Graphify / Obsidian

Still requires inspection of the real local system.

Do not:
- rebuild Sonor;
- guess endpoint paths;
- upload private graph DB/indexes;
- upload private Obsidian vault data;
- fake `graphify`/`obsidian` provenance.

Follow `docs/SONOR_CODEX_MISSION.md`.

## Next exact repository work

1. **P15C — Provider + MCP failure isolation**
2. P15D — Cancellation / timeout / network matrix
3. P15E — Secret / error / telemetry leakage
4. P15F — Security regression report
5. MEM-X real Sonor validation when local access exists
6. Phase 16 performance
7. Phase 17 full-system validation
8. Phase 18 Release Candidate
9. Phase 19 Windows ready-to-use
10. Phase 20 ASTRA MAX Core Release Gate
11. Phase 21–30 JARVIS-Class continuation

## Worklog update rule

Every merged feature/security slice must append:

- date;
- phase/slice;
- PR number;
- merge commit;
- CI status;
- files/components materially changed;
- important bug/security finding fixed;
- external validation still missing;
- exact next task.

Never mark local/physical verification PASS from repository inspection alone.

## Phase 15C1 — MCP failure isolation

- PR: **#99**
- merge commit: `6551a9b8537986251382495d6e39832e5bcf96e2`
- CI: **SUCCESS**
- result: optional MCP server failure no longer destroys native/healthy runtime; descriptor/call data is validated; permission floors and AbortSignal behavior are covered.
- next: **P15C2 provider outage/malformed-response matrix**.

