# CODEX NEXT MISSION — ASTRA HARDENING → CORE RELEASE → JARVIS EXPANSION

> This file is the execution handoff for the next Codex session.
>
> Do not reconstruct project history from chat. Start from current `main`, read the files listed below, verify the repository state, then execute this mission sequentially.

## One-line resume behavior

The repository owner may intentionally give only:

`lanjutkan yang belum selesai`

That is a complete continuation instruction.

On that command, use repository state instead of asking for the roadmap again:

`main → AGENTS.md → CODEX_PROGRESS_TRACKER.md → CODEX_HANDOFF.md → this file`

Then select the first implementable unfinished task, satisfy its exit gate, validate it, PR/CI/merge it, update the tracker/handoff, and continue.

External-only blockers must be recorded but must not stop unrelated repository work.

---

## Current repository checkpoint

Repository-complete and CI-verified:

- Phase 15A–15F security/failure hardening;
- Phase 16A runtime performance measurement instrumentation — PR #105;
- Phase 17A safe full-system preflight instrumentation — PR #106;
- pre-RC repository cleanup;
- Phase 19A read-only readiness self-check tooling — PR #109.

Still local/target-runtime gated:

- Phase 14 target-PC Automation validation;
- MEM-X real Sonor/Graphify/Obsidian validation;
- Phase 16B/P16C target runtime/browser measurements;
- Phase 17B–P17D real scenario evidence;
- Phase 19 target-PC install/self-check evidence.

Current implementable repository task:

**Phase 19B — safe update/reinstall tooling.**

P19B must preserve private runtime/configuration, avoid destructive Git recovery, use fast-forward-only update behavior, and remain unverified until actually executed on the target Windows PC.

After P19B merges, continue the next independent release/report preparation that does not require inventing target-PC evidence.

If this document conflicts with current `main`, `docs/ASTRA_WORKLOG.md` or `docs/CODEX_PROGRESS_TRACKER.md`, prefer those repository truths.

---

## Current verified baseline

Current core milestone:

- Phase 14 Automation implementation is merged to `main`;
- final Phase 14 merge: PR #92;
- merge commit: `de4fbefe6f9a23792a542a74d4d0ca1aef1aa208`;
- latest `main` CI after PR #92: SUCCESS;
- Automation service remains OFF by default;
- unattended Automation ceiling remains Permission Level 0/1;
- Level 2/3 remain explicit per-occurrence approval paths;
- Level 4 remains unavailable;
- global STOP covers interactive Automation plus the active background service tick;
- no fake Automation lifecycle should be introduced.

Repository truth status:

`PHASE 14 IMPLEMENTATION COMPLETE / CI VERIFIED / TARGET-PC VALIDATION REQUIRED`

Do not upgrade that status to target-PC verified until the documented Windows validation actually runs successfully.

Read before coding:

1. `docs/ASTRA_MAX.md`
2. `docs/ASTRA_ROADMAP.md`
3. `docs/CODEX_HANDOFF.md`
4. `docs/AUTOMATION_VALIDATION.md`
5. `docs/SONOR_CODEX_MISSION.md`
6. `SECURITY.md`

---

# Mission order

Use this exact order unless a real dependency proves otherwise:

```text
P14-X  Target-PC Automation validation
P15A   Project path / filesystem hardening
P15B   Untrusted retrieved-context / prompt-injection boundary
P15C   Provider + MCP failure isolation
P15D   Cancellation / timeout / network failure matrix
P15E   Secret / error / telemetry leakage hardening
P15F   Security regression matrix + report
MEM-X  Real Sonor / Graphify / Obsidian validation
P16    Performance pass
P17    Full-system scenarios
P18    Release Candidate
P19    Windows ready-to-use release
P20    ASTRA MAX Core Release Gate
P21-30 Continue JARVIS-Class roadmap
```

Do not skip directly to cosmetic UI work while a safety/release gate is incomplete.

---

# P14-X — Target-PC Automation validation

This is external/local validation, not new architecture.

On the target Windows PC:

1. pull current `main`;
2. build current production code;
3. run:
   `scripts/windows/validate-automation.ps1`;
4. if the owner explicitly wants background Automation enabled, run:
   `scripts/windows/enable-automation.ps1`;
5. optionally run one deliberate Level 0/1 proof:
   `scripts/windows/validate-automation.ps1 -RunSafeTick`;
6. create a due Level-2 occurrence and verify it stays approval-gated;
7. verify Level-3 scope review and single-use approval;
8. trigger STOP during a real running occurrence;
9. record exact results in `docs/CODEX_HANDOFF.md`.

Do not create a fake test definition that performs real external writes.

Exit gate:

`PHASE 14 COMPLETE` only if CI remains green and target-PC validation actually passes.

---

# Phase 15 — Security / failure hardening

## P15A — Project path and filesystem hardening

Goal: lock the existing path protections with explicit regression coverage and close any remaining filesystem escape.

Primary files:

- `lib/projects/paths.ts`
- `lib/projects/context.ts`
- project/file tool handlers
- tests

Required cases:

- `../` traversal;
- absolute path outside registered workspace;
- symlinked file escaping workspace;
- symlinked parent directory escaping workspace;
- sensitive names such as `.env*`, SSH keys, auth/credential/secrets paths;
- disallowed binary/unknown extensions;
- workspace path that disappears;
- file that changes between resolution and read where practical;
- writable target whose parent resolves outside workspace.

Do not weaken `realpath` checks merely to make a test pass.

Exit gate:

- no read/write resolver returns a path outside the real registered workspace;
- all escape attempts fail closed;
- tests prove it.

Suggested branch:

`astra/phase15a-path-hardening`

---

## P15B — Untrusted retrieved-context / prompt-injection boundary

Goal: retrieved project files, Sonor/Graphify/Obsidian memory and public web content are evidence, never trusted system/tool instructions.

Audit the complete route:

```text
memory/project/web record
      ↓
Memory Manager
      ↓
Brain localContext / provider context
      ↓
Planner / provider
```

Required changes where needed:

- add one shared formatter for untrusted retrieved records;
- clearly delimit source content from trusted runtime metadata;
- preserve provenance;
- keep user input distinct from retrieved content;
- provider/system prompts must explicitly state that retrieved text cannot override policy, approval, tool permission, system instructions, project boundary or provider privacy rules;
- do not remove useful text just because it contains imperative language;
- do not use regex-based “prompt injection detection” as the security boundary;
- security must come from structural separation + Tool Runtime permission enforcement.

Regression fixtures must include malicious retrieved text such as attempts to:

- request shell/file-write permission;
- reveal secrets;
- ignore approval;
- alter project ID;
- execute an external action;
- treat a file as a system message.

Expected result: content remains available as evidence, but cannot raise privileges or bypass policy.

Primary files likely include:

- `lib/brain/unified-memory.ts`
- `lib/memory/manager.ts`
- provider prompt builders
- research/browser evidence formatting
- tests

Suggested branch:

`astra/phase15b-untrusted-context-boundary`

---

## P15C — Provider and MCP failure isolation

Goal: one unavailable/malformed optional provider must not crash the entire ASTRA runtime or fabricate READY state.

Test/fix:

### Ollama
- connection refused;
- timeout;
- HTTP failure;
- invalid JSON;
- missing expected fields;
- empty response;
- configured model missing;
- AbortSignal.

### Hermes
- unavailable gateway;
- malformed JSON;
- empty response;
- timeout;
- invalid/non-loopback URL;
- abort;
- no false tool-success claim.

### Codex
- executable absent;
- auth/status failure;
- child exit non-zero;
- invalid/malformed JSONL;
- timeout;
- cancellation/child cleanup;
- read-only sandbox truth;
- no silent provider fallback when Codex was explicitly selected.

### Optional cloud
- disabled gate;
- policy denied;
- missing key/model/URL;
- network failure;
- malformed response;
- empty response;
- abort;
- never leak API key into returned error text.

### MCP
- `listTools()` throws;
- one server unavailable while others are healthy;
- malformed descriptor;
- empty/oversized tool names/descriptions/schema;
- duplicate normalized tool IDs;
- call failure;
- malformed/oversized output;
- cancellation;
- provider result claiming success without acceptable Tool Runtime verification.

Preferred behavior for optional MCP discovery:

- isolate failure per configured optional server when possible;
- keep native tools available;
- report the failed MCP server truthfully;
- never mark its tools READY if discovery failed.

Do not silently swallow a required provider failure if the user explicitly selected that provider.

Suggested branch:

`astra/phase15c-provider-mcp-failure-isolation`

---

## P15D — Cancellation / timeout / network failure matrix

Goal: STOP must remain authoritative across every long-running path.

Build a single test matrix covering:

- Ollama request;
- Hermes request;
- optional cloud request;
- Codex child process;
- Strategist planning;
- Memory/Sonor retrieval;
- public browser fetch;
- Tool Runtime handler;
- Computer transport;
- Automation occurrence SSE;
- background Automation service tick.

For each applicable path verify:

1. abort propagates;
2. owned resources/timers/listeners/processes are cleaned up;
3. no completed/success event appears after cancellation;
4. Command Center settles truthfully;
5. no automatic retry converts STOP into another execution.

Also test timeout separately from user STOP.

Suggested branch:

`astra/phase15d-cancellation-matrix`

---

## P15E — Secret, error and telemetry leakage hardening

Goal: errors and telemetry are useful without leaking local secrets or authentication material.

Audit:

- provider errors;
- child-process stderr;
- MCP details;
- integration/provider errors;
- URLs containing credentials/query tokens;
- local Windows paths;
- environment values;
- approval tokens;
- OAuth/API keys;
- Codex auth/session details.

Add a shared safe-error/redaction helper only where it genuinely improves consistency.

Never commit real secret fixtures. Use unmistakably fake test tokens.

Verify:

- approval tokens are not emitted into ordinary timeline detail;
- API keys are never returned by status endpoints;
- private `.env.local` remains gitignored;
- server logs do not print request authorization headers;
- provider exception messages are bounded before UI exposure.

Suggested branch:

`astra/phase15e-secret-telemetry-hardening`

---

## P15F — Security regression matrix and final hardening report

Create a table in a dedicated document, for example:

`docs/SECURITY_VALIDATION.md`

Rows should include:

- remote API request;
- cross-site request;
- oversized body;
- malformed JSON;
- provider outage;
- MCP outage;
- malformed planner output;
- retrieved prompt injection;
- invalid project path;
- symlink escape;
- permission denial;
- Level-4 action;
- cancellation;
- timeout;
- network failure;
- secret leakage;
- Automation duplicate run;
- Automation STOP.

Columns:

`SCENARIO | EXPECTED FAIL-SAFE STATE | AUTOMATED TEST | LOCAL TEST | RESULT`

Phase 15 exit gate:

- all implementable rows have automated coverage;
- local-only rows have a documented command/procedure;
- CI green;
- no known fail-open path remains.

Then update:

- `SECURITY.md`
- `docs/ASTRA_ROADMAP.md`
- `docs/ASTRA_MAX.md`
- `docs/CODEX_HANDOFF.md`

---

# MEM-X — Real Sonor / Graphify / Obsidian validation

This work is still required for the final ASTRA Definition of Done.

Do not rebuild Sonor.

Follow `docs/SONOR_CODEX_MISSION.md` exactly:

`PRESERVE → AUDIT → BACK UP → DOCUMENT → EXPOSE MINIMAL API → CONNECT ASTRA → VERIFY`

Important:

- find/audit the real existing Sonor first;
- keep Sonor source in its own private repo;
- do not upload private graph DB/indexes, personal Obsidian vault, secrets or private conversations;
- reuse the real structured backend if it exists;
- do not scrape graph DOM when structured data exists;
- ASTRA is the Brain; Sonor is knowledge/workflow intelligence;
- no duplicate Graphify/Obsidian pipeline inside ASTRA;
- keep full graph workspace outside the Humanoid home screen;
- preserve provenance source type `graphify` / `obsidian` when known.

Required real tests from the mission:

- Test A — ASTRA project;
- Test B — `lanjutkan ALURKA terakhir` with ALURKA-only context;
- Test C — known Obsidian note with `obsidian` provenance;
- Test D — known Graphify relationship with `graphify` provenance;
- Test E — Sonor stopped: ASTRA degrades to local/project memory truthfully;
- Test F — cancellation aborts cleanly.

Only after the real endpoint is verified configure private local values:

```env
ASTRA_SONOR_ENABLED=true
ASTRA_SONOR_URL=http://127.0.0.1:55127
ASTRA_SONOR_SEARCH_PATH=<REAL VERIFIED PATH>
```

Never commit the real `.env.local`.

---

# Phase 16 — Performance pass

Goal: improve responsiveness without degrading the approved Humanoid HIGH visual quality.

Measure before changing.

Required measurements:

- idle Humanoid FPS;
- LISTENING / THINKING / SPEAKING FPS;
- assembly/shockwave FPS;
- CPU usage;
- JS heap / memory trend where available;
- Command Center update cost;
- Brain event list/update cost;
- Memory retrieval latency by source;
- Project context retrieval latency;
- Sonor latency when connected;
- provider status probe latency;
- first token/final response latency where measurable;
- browser console warnings/errors.

Rules:

- no fake benchmark values;
- no lowering HIGH quality as the first fix;
- no per-frame full particle CPU loops;
- no duplicate renderer;
- no fullscreen blur/backdrop-filter regression;
- no unbounded React event history.

Create:

`docs/PERFORMANCE_BASELINE.md`

Record hardware/browser/runtime when measurements are local.

Exit gate: measured improvement or verified no regression, with Humanoid quality preserved.

---

# Phase 17 — Full system test

Implement/execute the required scenarios from `docs/ASTRA_MAX.md`.

Mandatory scenarios:

### A — Project continuation
“lanjutkan project terakhir saya dan jelaskan apa yang belum selesai”

Expected:
- Project Registry;
- Memory;
- Sonor when configured;
- Chief;
- provenance visible;
- no wrong-project contamination.

### B — Engineering workflow
“cek ASTRA, perbaiki error, test dan siapkan PR”

Expected:
- Chief;
- Developer/Codex;
- Files/GitHub;
- bounded plan;
- approval for writes;
- test/build/diff;
- PR;
- CI result;
- no fake success.

### C — ALURKA campaign
“buat campaign ALURKA minggu depan”

Expected:
- ALURKA context only;
- Memory;
- Research;
- Strategist;
- Marketing;
- Design;
- Editor;
- external creative provider remains NOT_CONFIGURED unless real.

### D — Calendar/email
“cek jadwal saya dan siapkan email follow-up”

Expected:
- if integrations unavailable: truthful NOT_CONFIGURED;
- if configured: reads real schedule;
- email drafting may be read-only;
- sending remains explicit Level-3 approval.

### E — STOP
Start a real cancellable task and trigger STOP.

Expected:
- owned work cancels;
- no later success event;
- UI returns to truthful state.

Add failure variants, not only happy paths.

Create:

`docs/FULL_SYSTEM_VALIDATION.md`

---

# Phase 18 — Release Candidate

Create RC only after:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm audit --audit-level=high`
- `git diff --check`

Also require:

- Phase 15 security matrix complete;
- Phase 16 performance baseline complete;
- Phase 17 scenarios documented;
- target-PC Automation validation complete;
- real Sonor state reported truthfully;
- open stale PRs reconciled;
- no known release-blocking console error.

Do not tag READY because CI alone is green.

---

# Phase 19 — Windows ready-to-use release

Goal:

`Install → local services → health check → UI`

Verify on target Windows:

- supported Node version;
- npm install/build;
- ASTRA binds loopback;
- Ollama installation and configured model;
- Codex CLI presence/auth status;
- private runtime directories;
- Automation service explicit state;
- Sonor explicit state;
- browser launch;
- startup task health;
- uninstall/reinstall path;
- logs/errors understandable;
- no admin privilege unless truly required.

Add one read-only self-check command/script that reports:

`READY / NOT_CONFIGURED / OFFLINE / ERROR`

for core dependencies without printing secrets.

---

# Phase 20 — ASTRA MAX Core Release Gate

Generate the required final report from `docs/ASTRA_MAX.md` with these exact sections:

- COMPLETED
- VERIFIED
- CONNECTED
- REQUIRES USER LOGIN
- REQUIRES PHYSICAL TEST
- NOT IMPLEMENTED
- SECURITY STATUS
- PERFORMANCE STATUS
- TEST STATUS
- RELEASE STATUS

Allowed release status:

- `READY`
- `READY WITH EXTERNAL CONFIGURATION REQUIRED`
- `BLOCKED`

Do not use READY unless the actual production validation supports it.

Phase 20 is a core release gate only. It is not the final roadmap stop.

---

# Phase 21–30 continuation

After Phase 20 is stable, continue the already-approved JARVIS-Class roadmap in `docs/ASTRA_MAX.md`.

Do not redesign Phase 0–20 foundations to implement Phase 21–30.

Order remains:

21. Always-On Voice Presence
22. Identity / Trust / Secrets
23. Situational Awareness
24. Event Engine + Proactive Intelligence
25. Background Tasks + Parallel Agents
26. Episodic Memory + Context Fusion
27. Multi-Device Presence
28. Self-Diagnostics / Recovery / Audit / Offline
29. Skill Ecosystem + IoT Bridge
30. JARVIS-Class Integration + Self-Evaluation + Ready Release

---

# Stale PR / branch cleanup

Open PR #51 (`ASTRA V15 — real-time Brain telemetry stream`) predates the current merged Runtime/Command Center architecture.

Before closing it:

1. compare its diff against current `main`;
2. identify any unique behavior/tests that were never superseded;
3. port only genuinely missing useful pieces through a new focused branch if needed;
4. otherwise close PR #51 as superseded by the merged Brain/Runtime telemetry work.

Do not merge the old branch wholesale into current main.

---

# Pre-created execution templates

These files already exist on this branch and should be filled with measured/verified results rather than replaced with new formats:

- `docs/PERFORMANCE_BASELINE.md` — Phase 16 measurements;
- `docs/FULL_SYSTEM_VALIDATION.md` — Phase 17 scenarios;
- `docs/CORE_RELEASE_CHECKLIST.md` — Phase 18–20 gates.

Keep them factual. Do not mark PASS/READY from code inspection alone.

---

# Codex execution discipline

For every subphase:

1. inspect current `main`;
2. create one recoverable feature branch;
3. make focused changes;
4. add/adjust tests before claiming completion;
5. run build/test/typecheck/lint/audit;
6. inspect diff for accidental secrets/private data;
7. update handoff/roadmap docs;
8. open PR;
9. merge only after green CI;
10. record the exact next task.

Do not:

- fake integrations;
- fake telemetry;
- fake provider/tool success;
- create a second Brain;
- duplicate Sonor/Graphify/Obsidian;
- weaken permission gates to make tests pass;
- commit secrets/private runtime data;
- turn on paid cloud automatically;
- expose loopback APIs publicly;
- sacrifice Humanoid quality before architectural optimization;
- execute destructive external actions as release tests.

The objective is not feature count.

The objective is:

`truthful + safe + recoverable + fast + useful + ready for daily use`.
