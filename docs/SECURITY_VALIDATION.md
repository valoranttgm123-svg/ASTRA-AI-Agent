# SECURITY VALIDATION MATRIX — Phase 15

> Living Phase 15 checklist. Codex should convert every implementable row into an automated regression test before Phase 15 is closed.

| Scenario | Expected fail-safe state | Automated test | Local test | Result |
| --- | --- | --- | --- | --- |
| Remote/non-loopback API request | Request rejected; no Brain/tool execution | `tests/brain.test.ts` — HTTP guard rejects remote and cross-site requests | Optional curl from non-loopback context | PASS — AUTOMATED |
| Cross-site request | Request rejected | `tests/brain.test.ts` — HTTP guard rejects remote and cross-site requests | Browser devtools optional | PASS — AUTOMATED |
| Oversized request body | HTTP 413 / bounded rejection | `tests/brain.test.ts` — request parser validates size, shape, mode, and provider | Not required | PASS — AUTOMATED |
| Malformed JSON | Bounded validation error; no execution | `tests/brain.test.ts` — request parser validates size, shape, mode, and provider | Not required | PASS — AUTOMATED |
| Invalid project traversal `../` | No path returned/read/written | `tests/security-paths.test.ts` | Not required | PASS — AUTOMATED |
| Absolute path outside workspace | No path returned/read/written | `tests/security-paths.test.ts` | Not required | PASS — AUTOMATED |
| Symlink escape from workspace | No path returned/read/written | `tests/security-paths.test.ts` | Platform-specific symlink support | PASS — AUTOMATED |
| Sensitive file path | Refused | `tests/security-paths.test.ts` | Not required | PASS — AUTOMATED |
| Retrieved prompt injection | Treated as untrusted evidence; no privilege increase | `tests/context-safety.test.ts` + independent permission/tool-policy tests | Optional live provider test | PASS — AUTOMATED |
| Ollama unavailable | Truthful OFFLINE/failure; no fake response | `tests/provider-hardening.test.ts` + existing Brain tests | Target PC outage proof | PASS — AUTOMATED / LOCAL OPTIONAL |
| Ollama malformed response | Fail safely | `tests/provider-hardening.test.ts` | Not required | PASS — AUTOMATED |
| Hermes unavailable/malformed | Fail safely; no fake tool success | `tests/provider-hardening.test.ts` | Only if Hermes configured | PASS — AUTOMATED |
| Explicit Codex unavailable | No silent Ollama fallback | existing Brain test + `tests/provider-hardening.test.ts` | Target PC Codex status | PASS — AUTOMATED / LOCAL REQUIRED FOR REAL CLI |
| Codex malformed/failed child | Failed/blocked; child cleaned | `tests/codex-process.test.ts` exercises real spawn/JSONL/non-zero/timeout/STOP cleanup | Optional target PC | PASS — AUTOMATED / LOCAL REAL CLI OPTIONAL |
| Optional cloud disabled | No cloud call | `tests/brain.test.ts` — permission policy defaults to approval and denies side effects; `tests/provider-hardening.test.ts` — Cloud remains policy-gated | Not required | PASS — AUTOMATED |
| Cloud network/malformed response | Fail safely; no secret leakage | `tests/provider-hardening.test.ts` + `tests/security-redaction.test.ts` | Optional only if configured | PASS — AUTOMATED |
| MCP discovery outage | Native runtime remains usable where possible; MCP not READY | `tests/mcp-hardening.test.ts` | Only if MCP configured | PASS — AUTOMATED |
| MCP malformed descriptor | Reject/skip malformed tool; no crash/fake READY | `tests/mcp-hardening.test.ts` | Not required | PASS — AUTOMATED |
| MCP tool call failure | Failed + unverified | `tests/mcp-hardening.test.ts` + existing Tool Runtime tests | Optional | PASS — AUTOMATED |
| Planner malformed output | No execution without valid bounded plan | `tests/brain.test.ts` — Phase 15F planner parser fails closed on malformed JSON + planner rejects invalid plans | Not required | PASS — AUTOMATED |
| Permission Level 2 denied | No local write/shell action | `tests/brain.test.ts` — executable Tool Runtime blocks before handler when permission or policy is insufficient | UI proof optional | PASS — AUTOMATED |
| Permission Level 3 denied | No external action | `tests/brain.test.ts` — approval preflight policy denial + one scoped Level-3 approval cannot authorize a second step | UI proof required before release | PASS — AUTOMATED / LOCAL UI REQUIRED BEFORE RELEASE |
| Permission Level 4 | Blocked | `tests/brain.test.ts` — approval preflight rejects Level-4 + scoped step approval never bypasses Level-4 | Not required | PASS — AUTOMATED |
| Provider cancellation | Abort propagates; no later success | `tests/cancellation-matrix.test.ts` + existing Ollama test | Optional target PC | PASS — AUTOMATED FOR OLLAMA/HERMES/CLOUD |
| Planner cancellation | Abort propagates | `tests/cancellation-matrix.test.ts` | Not required | PASS — AUTOMATED |
| Memory/Sonor cancellation | Abort propagates | in-flight Memory source covered in `tests/cancellation-matrix.test.ts`; real Sonor Test F remains | Real Sonor required | PASS — MEMORY / LOCAL SONOR REQUIRED |
| Browser/network cancellation | Abort propagates | pre-network STOP in `tests/cancellation-matrix.test.ts`; live external fetch remains optional | Not required | PASS — AUTOMATED BASIC |
| Tool timeout | Failed timeout; no later success | authoritative timeout + no late completed event in `tests/cancellation-matrix.test.ts` | Not required | PASS — AUTOMATED |
| Computer action STOP | Abort propagates | existing Computer test + shared Tool Runtime cancellation matrix | Target PC optional | PASS — AUTOMATED / LOCAL OPTIONAL |
| Automation duplicate occurrence | At-most-once claim | Existing Phase 14 tests | Target PC validator | CI VERIFIED |
| Automation background STOP | Server tick aborted | Existing Phase 14 tests | Target PC validator | CI VERIFIED / LOCAL REQUIRED |
| Automation Level 2/3 unattended | Never runs unattended | Existing Phase 14 E2E | Target PC validator | CI VERIFIED / LOCAL REQUIRED |
| Secret in provider error | Redacted/bounded before UI/telemetry | `tests/security-redaction.test.ts` + `tests/codex-process.test.ts` | Not required | PASS — AUTOMATED |
| Approval token leakage | Token absent/redacted from ordinary timeline/status; scoped approval payload remains intentional | shared live-event redaction + `tests/security-redaction.test.ts` | UI inspection optional | PASS — AUTOMATED |
| API key/status leakage | Secret never returned | provider status URL redaction + `tests/security-redaction.test.ts` | Not required | PASS — AUTOMATED |
| Sonor unavailable | ASTRA degrades to local/project memory | `tests/brain.test.ts` — multi-source memory manager degrades around failed sources; Sonor source configuration tests | MEM-X Test E with real Sonor | PASS — AUTOMATED DEGRADATION / LOCAL REAL SONOR REQUIRED |
| Wrong-project memory contamination | Filtered/scoped to selected project | `tests/brain.test.ts` — multi-source memory manager enforces project isolation, dedupe, ranking, and bounds | Real ALURKA/Sonor validation | PASS — AUTOMATED / LOCAL REAL SONOR REQUIRED |

## Phase 15 completion rule

Replace every `TODO` with one of:

- `PASS — AUTOMATED`
- `PASS — LOCAL VERIFIED`
- `PASS — AUTOMATED + LOCAL VERIFIED`
- `NOT CONFIGURED`
- `BLOCKED — <specific reason>`

Do not use `PASS` from inspection alone when the row requires execution.

Phase 15 repository hardening exit state:

- all implementable safety rows have automated regression coverage;
- local-only rows retain exact reproducible procedures in `docs/AUTOMATION_VALIDATION.md` and `docs/SONOR_CODEX_MISSION.md`;
- Phase 15 is repository-complete only after the P15F PR is green and merged;
- local target-PC Automation and real Sonor validation remain separate release gates;
- no known fail-open path remains in the repository-tested Phase 15 scope.
