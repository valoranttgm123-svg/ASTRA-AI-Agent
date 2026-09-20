# SECURITY VALIDATION MATRIX — Phase 15

> Living Phase 15 checklist. Codex should convert every implementable row into an automated regression test before Phase 15 is closed.

| Scenario | Expected fail-safe state | Automated test | Local test | Result |
| --- | --- | --- | --- | --- |
| Remote/non-loopback API request | Request rejected; no Brain/tool execution | Existing guard coverage; re-verify | Optional curl from non-loopback context | PENDING REVIEW |
| Cross-site request | Request rejected | Existing guard coverage; re-verify | Browser devtools optional | PENDING REVIEW |
| Oversized request body | HTTP 413 / bounded rejection | Existing parser coverage; re-verify | Not required | PENDING REVIEW |
| Malformed JSON | Bounded validation error; no execution | Existing parser coverage; expand if needed | Not required | PENDING REVIEW |
| Invalid project traversal `../` | No path returned/read/written | `tests/security-paths.test.ts` | Not required | PASS — AUTOMATED |
| Absolute path outside workspace | No path returned/read/written | `tests/security-paths.test.ts` | Not required | PASS — AUTOMATED |
| Symlink escape from workspace | No path returned/read/written | `tests/security-paths.test.ts` | Platform-specific symlink support | PASS — AUTOMATED |
| Sensitive file path | Refused | `tests/security-paths.test.ts` | Not required | PASS — AUTOMATED |
| Retrieved prompt injection | Treated as untrusted evidence; no privilege increase | `tests/context-safety.test.ts` + independent permission/tool-policy tests | Optional live provider test | PASS — AUTOMATED |
| Ollama unavailable | Truthful OFFLINE/failure; no fake response | `tests/provider-hardening.test.ts` + existing Brain tests | Target PC outage proof | PASS — AUTOMATED / LOCAL OPTIONAL |
| Ollama malformed response | Fail safely | `tests/provider-hardening.test.ts` | Not required | PASS — AUTOMATED |
| Hermes unavailable/malformed | Fail safely; no fake tool success | `tests/provider-hardening.test.ts` | Only if Hermes configured | PASS — AUTOMATED |
| Explicit Codex unavailable | No silent Ollama fallback | existing Brain test + `tests/provider-hardening.test.ts` | Target PC Codex status | PASS — AUTOMATED / LOCAL REQUIRED FOR REAL CLI |
| Codex malformed/failed child | Failed/blocked; child cleaned | malformed JSONL parser covered in `tests/provider-hardening.test.ts`; process cleanup continues in P15D | Optional target PC | PARTIAL — P15D PROCESS/CANCEL TEST REMAINS |
| Optional cloud disabled | No cloud call | Existing policy coverage | Not required | PENDING REVIEW |
| Cloud network/malformed response | Fail safely; no secret leakage | `tests/provider-hardening.test.ts`; leakage review continues P15E | Optional only if configured | PASS — FAILURE HANDLING / P15E REDACTION REMAINS |
| MCP discovery outage | Native runtime remains usable where possible; MCP not READY | `tests/mcp-hardening.test.ts` | Only if MCP configured | PASS — AUTOMATED |
| MCP malformed descriptor | Reject/skip malformed tool; no crash/fake READY | `tests/mcp-hardening.test.ts` | Not required | PASS — AUTOMATED |
| MCP tool call failure | Failed + unverified | `tests/mcp-hardening.test.ts` + existing Tool Runtime tests | Optional | PASS — AUTOMATED |
| Planner malformed output | No execution without valid bounded plan | Existing + re-verify | Not required | PENDING REVIEW |
| Permission Level 2 denied | No local write/shell action | Existing | UI proof optional | PENDING REVIEW |
| Permission Level 3 denied | No external action | Existing | UI proof required before release | PENDING REVIEW |
| Permission Level 4 | Blocked | Existing | Not required | PENDING REVIEW |
| Provider cancellation | Abort propagates; no later success | `tests/cancellation-matrix.test.ts` + existing Ollama test | Optional target PC | PASS — AUTOMATED FOR OLLAMA/HERMES/CLOUD |
| Planner cancellation | Abort propagates | `tests/cancellation-matrix.test.ts` | Not required | PASS — AUTOMATED |
| Memory/Sonor cancellation | Abort propagates | in-flight Memory source covered in `tests/cancellation-matrix.test.ts`; real Sonor Test F remains | Real Sonor required | PASS — MEMORY / LOCAL SONOR REQUIRED |
| Browser/network cancellation | Abort propagates | pre-network STOP in `tests/cancellation-matrix.test.ts`; live external fetch remains optional | Not required | PASS — AUTOMATED BASIC |
| Tool timeout | Failed timeout; no later success | authoritative timeout + no late completed event in `tests/cancellation-matrix.test.ts` | Not required | PASS — AUTOMATED |
| Computer action STOP | Abort propagates | Existing | Target PC optional | PENDING REVIEW |
| Automation duplicate occurrence | At-most-once claim | Existing Phase 14 tests | Target PC validator | CI VERIFIED |
| Automation background STOP | Server tick aborted | Existing Phase 14 tests | Target PC validator | CI VERIFIED / LOCAL REQUIRED |
| Automation Level 2/3 unattended | Never runs unattended | Existing Phase 14 E2E | Target PC validator | CI VERIFIED / LOCAL REQUIRED |
| Secret in provider error | Redacted/bounded before UI/telemetry | REQUIRED Phase 15E | Not required | TODO |
| Approval token leakage | Token absent from ordinary timeline/status | REQUIRED Phase 15E | UI inspection optional | TODO |
| API key/status leakage | Secret never returned | REQUIRED Phase 15E | Not required | TODO |
| Sonor unavailable | ASTRA degrades to local/project memory | Existing architecture + MEM-X Test E | Real Sonor required | TODO |
| Wrong-project memory contamination | Filtered/scoped to selected project | Existing manager logic + Phase 17A | Real ALURKA/Sonor validation | TODO |

## Phase 15 completion rule

Replace every `TODO` with one of:

- `PASS — AUTOMATED`
- `PASS — LOCAL VERIFIED`
- `PASS — AUTOMATED + LOCAL VERIFIED`
- `NOT CONFIGURED`
- `BLOCKED — <specific reason>`

Do not use `PASS` from inspection alone when the row requires execution.

Phase 15 is complete only when:

- all implementable safety rows have regression coverage;
- local-only rows have an exact reproducible command/procedure;
- CI is green;
- remaining NOT CONFIGURED/BLOCKED rows are reported truthfully;
- no known fail-open path remains.
