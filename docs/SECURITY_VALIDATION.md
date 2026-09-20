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
| Retrieved prompt injection | Treated as untrusted evidence; no privilege increase | REQUIRED Phase 15B | Optional live provider test | TODO |
| Ollama unavailable | Truthful OFFLINE/failure; no fake response | Existing + expand Phase 15C | Target PC outage proof | TODO |
| Ollama malformed response | Fail safely | REQUIRED Phase 15C | Not required | TODO |
| Hermes unavailable/malformed | Fail safely; no fake tool success | REQUIRED Phase 15C | Only if Hermes configured | TODO |
| Explicit Codex unavailable | No silent Ollama fallback | Existing + expand Phase 15C | Target PC Codex status | TODO |
| Codex malformed/failed child | Failed/blocked; child cleaned | REQUIRED Phase 15C | Optional target PC | TODO |
| Optional cloud disabled | No cloud call | Existing policy coverage | Not required | PENDING REVIEW |
| Cloud network/malformed response | Fail safely; no secret leakage | REQUIRED Phase 15C/E | Optional only if configured | TODO |
| MCP discovery outage | Native runtime remains usable where possible; MCP not READY | REQUIRED Phase 15C | Only if MCP configured | TODO |
| MCP malformed descriptor | Reject/skip malformed tool; no crash/fake READY | REQUIRED Phase 15C | Not required | TODO |
| MCP tool call failure | Failed + unverified | REQUIRED Phase 15C | Optional | TODO |
| Planner malformed output | No execution without valid bounded plan | Existing + re-verify | Not required | PENDING REVIEW |
| Permission Level 2 denied | No local write/shell action | Existing | UI proof optional | PENDING REVIEW |
| Permission Level 3 denied | No external action | Existing | UI proof required before release | PENDING REVIEW |
| Permission Level 4 | Blocked | Existing | Not required | PENDING REVIEW |
| Provider cancellation | Abort propagates; no later success | Existing partial + Phase 15D matrix | Optional target PC | TODO |
| Planner cancellation | Abort propagates | REQUIRED Phase 15D | Not required | TODO |
| Memory/Sonor cancellation | Abort propagates | Existing partial + MEM-X Test F | Real Sonor required | TODO |
| Browser/network cancellation | Abort propagates | REQUIRED Phase 15D | Not required | TODO |
| Tool timeout | Failed timeout; no later success | Existing partial + re-verify | Not required | TODO |
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
