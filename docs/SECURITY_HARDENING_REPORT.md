# PHASE 15 SECURITY HARDENING REPORT

> Repository security/failure-hardening summary for ASTRA.
>
> This report covers repository-implementable Phase 15 work. It does **not** replace target-PC Automation validation or real Sonor/Graphify/Obsidian validation.

## Executive status

Repository result after the Phase 15F PR is green and merged:

`PHASE 15 REPOSITORY HARDENING COMPLETE / CI VERIFIED / LOCAL RELEASE GATES REMAIN`

Local/external gates that remain:

- Phase 14 target-PC Automation validation;
- real Sonor/Graphify/Obsidian MEM-X validation;
- Level-3 UI proof on the target runtime before release;
- target-hardware/browser performance measurements in Phase 16.

## Completed hardening slices

| Slice | PR | Core result |
| --- | ---: | --- |
| P15A — filesystem/path hardening | #96 | traversal, sensitive path, symlink-parent and dangling writable symlink escapes fail closed |
| P15B — untrusted retrieved context | #97 | retrieved memory/project/Sonor/tool text is evidence, not policy or authorization |
| Recovery/worklog durability | #98 | interrupted sessions recover from repository truth instead of chat history |
| P15C1 — MCP failure isolation | #99 | bad optional MCP server/descriptor/call cannot take down native/healthy runtime |
| P15C2 — provider failure matrix | #100 | Ollama/Hermes/Cloud malformed/outage responses fail closed; Codex availability/JSONL is truthful |
| P15D1 — cancellation/timeout matrix | #101 | STOP and timeout boundaries are authoritative across provider/Planner/Memory/browser/Tool Runtime |
| P15D2 — Codex/Automation STOP settlement | #102 | owned Codex child is terminated; Automation cancellation cannot become fake success |
| P15E — secret/error/telemetry redaction | #103 | public errors/status/telemetry redact tokens, credentials, sensitive URL data and user-home paths |
| P15F — final regression/report | current | closes implementable matrix rows and records remaining local gates |

## Material security findings fixed

### Writable dangling symlink fail-open

Before P15A, a dangling writable symlink could reach the "new file" fallback after `realpath()` failed.

Fix:
- `lstat()` distinguishes an actually missing target from an existing symlink;
- writable symlinks fail closed;
- non-`ENOENT` resolution failures fail closed.

Regression:
- `tests/security-paths.test.ts`.

### Retrieved-content authority confusion

Before P15B, retrieved local/project/Sonor text was inserted as ordinary provider context without one shared explicit authority boundary.

Fix:
- shared untrusted-context formatter;
- provenance-preserving JSON data records;
- provider/planner instructions explicitly deny retrieved data policy/tool authority;
- prior step/tool output is also untrusted evidence.

Regression:
- `tests/context-safety.test.ts`.

### Optional MCP failure fan-out

Before P15C1, one failed MCP `listTools()` could fail Tool Runtime construction.

Fix:
- per-server optional MCP discovery isolation;
- descriptor shape/size validation;
- stable normalized IDs;
- side-effect permission floors;
- malformed call-result rejection;
- AbortSignal remains authoritative.

Regression:
- `tests/mcp-hardening.test.ts`.

### Provider false-health / malformed response handling

P15C2 added bounded/structured provider response checks so HTTP 200 is not enough to claim health.

Regression:
- `tests/provider-hardening.test.ts`;
- `tests/codex-process.test.ts`.

### Timeout that depended on handler cooperation

Before P15D1, Tool Runtime timeout aborted the signal but still awaited a handler that could ignore cancellation.

Fix:
- authoritative timeout/cancellation race;
- late completion cannot win after timeout/STOP.

Regression:
- `tests/cancellation-matrix.test.ts`.

### Secret-bearing errors and telemetry

Before P15E, several provider/tool/Automation/Codex paths could surface raw `error.message` or stderr.

Fix:
- shared `lib/security/redaction.ts`;
- provider status, Tool Runtime, Codex stderr, Automation API/SSE/service and live Brain telemetry use bounded redaction;
- public endpoint labels redact URL credentials and sensitive query parameters.

Regression:
- `tests/security-redaction.test.ts`;
- secret-bearing Codex stderr fixture in `tests/codex-process.test.ts`.

## Final automated coverage

The authoritative row-by-row table is:

- `docs/SECURITY_VALIDATION.md`

Important automated coverage includes:

- remote/non-loopback and cross-site API rejection;
- malformed/oversized request rejection;
- project traversal/symlink/sensitive-path containment;
- prompt-injection authority boundary;
- Ollama/Hermes/Cloud/Codex failure behavior;
- MCP outage and malformed descriptors/results;
- malformed planner output;
- Level-2 and Level-3 denial;
- Level-4 blocking;
- cancellation and timeout behavior;
- Automation duplicate claim and STOP;
- provider/approval/API-key leakage redaction;
- project-scoped memory filtering.

## Remaining local-only release gates

### Automation target-PC validation

Use:

`scripts/windows/validate-automation.ps1`

Optional deliberate Level-0/1 execution proof:

`scripts/windows/validate-automation.ps1 -RunSafeTick`

Required real checks remain documented in:

- `docs/AUTOMATION_VALIDATION.md`.

### Real Sonor / Graphify / Obsidian

Follow:

- `docs/SONOR_CODEX_MISSION.md`

Required real tests remain MEM-X A–F, including real project scoping, provenance, outage degradation and cancellation.

Do not rebuild Sonor and do not guess its endpoint.

## Security conclusion

Within the repository-tested Phase 15 scope:

- no known fail-open path remains;
- provider/tool success requires verifiable bounded behavior;
- retrieved text has no authority to raise permissions;
- approval/tool permission floors remain server-side;
- scheduled Level-4 remains unavailable;
- unattended Automation remains Level 0/1;
- paid cloud remains explicit opt-in;
- public error/status/telemetry has a shared redaction boundary.

This conclusion does not claim physical/local validation that has not run.

## Next milestone

When this report's PR is green and merged:

1. run MEM-X whenever real local Sonor access is available;
2. if MEM-X is externally blocked, continue **Phase 16 — Performance** work that can be implemented without inventing benchmark values;
3. collect target-hardware measurements before marking Phase 16 complete.
