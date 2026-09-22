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

Repository-complete / merged on current `main`:

- Phase 15A–15F security/failure hardening;
- Phase 16A runtime performance measurement instrumentation — PR #105;
- Phase 16 browser/Humanoid private evidence capture tooling — PR #124;
- Phase 17A safe full-system preflight instrumentation — PR #106;
- repository cleanup before RC;
- Phase 18A repository RC gate automation — PR #119;
- Phase 19A–19G Windows repository tooling/hardening — PRs #109, #110, #115, #113, #114, #116, #117;
- target-PC read-only evidence collector — PR #121;
- Phase 20 conservative core report generator — PR #123;
- Phase 20 manual gate recorder — PR #125;
- Phase 20 report context recorder — PR #126;
- Phase 20 evidence-shape/private-path hardening — PR #129;
- running-build identity embedded and required for release evidence — PR #142;
- target-PC evidence persists structured runtime identity and rejects duplicate/non-PASS checks — PR #143;
- target-PC/runtime/preflight capture verifies the same clean running build at start and completion — PR #144;
- browser/Humanoid HIGH capture verifies start/end runtime identity, server checkout/runtime agreement, and release-bundle provenance — PR #145.

Latest implementation checkpoint before the final docs-only handoff:

`03073fe8a95b7064b059aadcd4b9ff933c8c73e8`

Stale/diverged PR #111 is closed as superseded by PR #119.

Still local/target-runtime gated:

- Phase 14 target-PC Automation approval/STOP validation;
- MEM-X real Sonor/Graphify/Obsidian validation;
- Phase 16 real target runtime + browser/Humanoid measurements;
- Phase 17 real scenarios including approved actions and emergency STOP;
- Phase 19 real install/update/reinstall/startup verification;
- Phase 20 final evidence-backed verdict.

Current execution rule:

- if target-PC/local access is available, run `npm run release:repo-gate`, then `scripts/windows/collect-target-pc-evidence.ps1`, then capture the remaining browser/manual/integration evidence;
- use `release:record-gate` only after a real evidence file exists for a manual PASS;
- use `release:record-context` for bounded final-report context labels;
- run `release:core-report` repeatedly; any `BLOCKED` result identifies evidence still missing;
- if target-PC/local access is unavailable, read `docs/CODEX_CONTINUATION_NOTE_2026-09-21.md`, then continue only concrete repository audits, regression coverage, hardening, documentation synchronization or real defect fixes;
- do not invent benchmark values, Sonor state, physical STOP results, external-action success, Windows install proof or READY status;
- do not reimplement PR #123–#126, #129, or #142–#145 release/evidence hardening unless a new concrete defect is demonstrated;
- do not begin Phase 21–30 as a substitute for unfinished Phase 18–20 core evidence.

If this document conflicts with current `main`, `docs/ASTRA_WORKLOG.md` or `docs/CODEX_PROGRESS_TRACKER.md`, prefer the newest merged repository truth.

Repository saturation note (2026-09-21): after PR #145, the latest audit found no additional concrete repository-only release-evidence defect to implement. Until a new defect is demonstrated, the next meaningful work is the real target-PC/Sonor/browser/approval evidence below; do not create speculative hardening merely to avoid those gates.

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
6. `docs/CODEX_CONTINUATION_NOTE_2026-09-21.md`
7. `docs/CORE_RELEASE_REPORT.md`
8. `docs/MANUAL_RELEASE_EVIDENCE.md`
9. `docs/BROWSER_PERFORMANCE_EVIDENCE.md`
10. `SECURITY.md`

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


---

## 2026-09-21 — final repository audit through PR #150

A fresh audit after the earlier PR #145 saturation checkpoint found four additional concrete repository defects. They are now fixed and CI-verified:

- PR #147 / `5338f3f184ab84102f635dfb89255e090b43dba9` — every browser bundle scenario is bound to the expected clean runtime commit;
- PR #148 / `95b2d6e8d82dae4da85650609650e72a5a14c8ef` — optional remote cloud endpoints require HTTPS and embedded-credential URLs are rejected;
- PR #149 / `542e5f7494c23b525eccf38a503adf330b7a7cfc` — GitHub remote verification requires the exact `github.com` host;
- PR #150 / `32f3f8f340a6bfc4004c5b4eeedd116682dae854` — STOP/timeout termination covers the full owned subprocess tree, including Windows descendants.

Read `docs/FINAL_REPOSITORY_AUDIT_2026-09-21.md` before starting new repository hardening.

Current repository audit conclusion:

`REPOSITORY AUDIT COMPLETE THROUGH PR #150 / CI VERIFIED / REAL TARGET-PC GATES REQUIRED`

Do not reimplement PRs #147–#150 without a new reproducible defect. The next meaningful execution is the real target-PC sequence already documented below. Do not start Phase 21–30 as a substitute for unfinished Phase 14/MEM-X/16/17/19/20 gates.

Repository governance note: `main` was not protected and no repository ruleset existed at audit time. Enabling PR-required branch protection + ASTRA CI is recommended as a manual GitHub administrator setting; it is not a runtime release PASS and the available connector cannot configure it.


---

## 2026-09-21 — optional NVIDIA provider added after final repository audit

PR #152 / merge commit:

`c151d9d044829e14f66be84a70d56aaf163ea09c`

ASTRA now includes an optional NVIDIA NIM reasoning provider with default model:

`nvidia/nemotron-3-ultra-550b-a55b`

This does **not** change the target-PC release gate order.

Important:
- NVIDIA is OFF by default;
- AUTO remains local-first unless `ASTRA_NVIDIA_AUTO_FALLBACK=true`;
- memory is not sent unless `ASTRA_NVIDIA_INCLUDE_MEMORY=true`;
- NVIDIA is chat/reasoning only and cannot replace Codex/Tool Runtime for real execution;
- the real hosted provider is not READY until a valid `NVIDIA_API_KEY` is configured privately on the target PC and status verification passes.

Provider runbook: `docs/NVIDIA_NIM.md`.

Continue Phase 14 / MEM-X / 16 / 17 / 19 / 20 target-PC evidence as previously documented.

## NVIDIA mesh constraint after PR #154

ASTRA now has an adaptive NVIDIA JARVIS model mesh at merge commit `ce5a5623867f443ffc931c6b4687b19e38412882`.

Before touching provider routing, read `docs/NVIDIA_NIM.md`.

Treat the mesh as a completed repo-side enhancement. Do not spend target-gate time on speculative model churn unless a concrete test or NVIDIA deprecation forces a change. Real API-key validation belongs to the target PC and must never commit secrets.

Existing target-runtime evidence remains the priority.

## Target-PC NVIDIA key handling — owner preference

When the target-PC phase begins, Codex should handle NVIDIA configuration locally.

Required workflow:
1. verify the correct ASTRA checkout and current `main`;
2. create or update `.env.local` on the target PC;
3. ask the owner to enter the NVIDIA API key only in the local PC session;
4. write the key to `NVIDIA_API_KEY` in `.env.local` without printing it back;
5. preserve the JARVIS mesh configuration from `.env.example`;
6. verify only that the key is present, never display the secret value;
7. confirm `.env.local` is gitignored and absent from `git status --short`;
8. run live NVIDIA mesh health/runtime validation;
9. never commit, upload, log, paste into GitHub, or store the API key in docs/issues/PRs.

The owner does not want to manually edit the NVIDIA secret into the project. Codex should perform the local file/configuration step when the PC checkout exists, while the owner supplies the secret only through the local target-PC session.

## Owner delivery preference — zero-touch technical completion

Read and follow `docs/READY_TO_USE_DELIVERY.md`.

The owner wants Codex to perform 100% of the technically executable work and deliver ASTRA ready to use. Do not turn target-PC validation into a list of commands for the owner.

When PC access is available, Codex must execute the repository sync, installation, dependency repair, local configuration, provider setup, Sonor integration, Windows startup/launcher work, target-runtime validation, defect repair, evidence collection, and final readiness checks itself.

The owner should only be interrupted for unavoidable credential entry, account consent/MFA, UAC/security prompts, camera/microphone consent, physical-human-only observations, or a genuine high-impact approval.

After each unavoidable owner input, continue automatically. Do not make the owner resume the technical workflow manually.

The final target is not "code complete"; it is a truthfully validated, ready-to-use ASTRA installation on the target PC.

## Autonomous credential rule

For provider credentials, do not default to asking the owner to paste a key.

First inspect the target PC for an already-authorized ASTRA credential source or an already-authenticated provider session that Codex can legitimately reuse. If a valid NVIDIA credential already exists, configure and validate it without exposing the secret.

If the provider account/session permits Codex to create or retrieve the needed credential through an already-authenticated flow, do so and store it only in the local secret location.

Never bypass login/MFA/CAPTCHA/account consent or fabricate credentials. If authentication truly requires the account owner and no authorized session exists, keep working on all independent tasks and record that one provider as an external blocker rather than turning the blocker into a setup checklist for the owner.

## Additional mission — NVIDIA MAX integration

Canonical plan: `docs/NVIDIA_MAX_INTEGRATION.md`.

The owner approved the full NVIDIA architecture: JARVIS Model Mesh, NVIDIA Skill Hub, AI-Q Research, NeMo Retriever/RAG under Sonor, Document Intelligence, Nemotron Voice Agent, DeepStream/VSS, NemoClaw for Hermes, NeMo Guardrails/Content Safety, and NeMo evaluation.

### Resume order

When real target-PC access exists, first finish the existing release gates:

`Phase 14 validation → MEM-X → Phase 16 → Phase 17 → Phase 19 → Phase 20`.

Do not postpone those gates by adding speculative NVIDIA features.

When repository work can proceed independently of PC access, continue the NVIDIA track:

`NVA-0 → NVA-1 → NVA-2 ... NVA-9`

NVA-0 is the repository framework slice in branch `feature/nvidia-max-framework`.

After it merges, the exact next repo-side task is **NVA-1 Skill Hub discovery/install-state**.

### NVA-1 Codex instructions

Implement a safe, provider-neutral catalog/install-state layer. Requirements:

- do not inject the whole NVIDIA catalog into every prompt;
- no runtime HTML scraping on normal ASTRA requests;
- keep a bounded cached/private catalog snapshot or use a supported NVIDIA mechanism;
- installed-skill state lives under private `.astra/`;
- truth states: `available / installed / disabled / incompatible`;
- record provenance/version/checksum when the provider exposes them;
- selection remains bounded;
- install/update/remove mutations require the existing ASTRA permission model;
- provide dry-run planning before mutations;
- a skill never becomes execution authority;
- validate the actual Codex skill installation mechanism/version on the target PC before claiming READY.

Then continue NVA-2 onward only after NVA-1 exit gate is green.

For all NVIDIA work, preserve zero-touch owner delivery: Codex performs technical setup/repair/validation itself and asks for owner involvement only when a genuine external authorization boundary cannot be satisfied from an already-authorized local session.

## NVIDIA NVA-1 continuation checkpoint

PR #159/NVA-0 is merged. Repository-side NVA-1 now has a private catalog/state contract on `feature/nvidia-skill-hub-state`.

Do not implement skill installation by guessing shell commands or folder conventions.

For target-PC NVA-1:
1. inspect the actual installed Codex version and NVIDIA-supported skill workflow;
2. use an official/supported mechanism;
3. install only the approved core set first;
4. record real installed/disabled/incompatible state in the private registry;
5. test update/remove/rollback;
6. never expose provider credentials.

After NVA-1 repository merge, proceed with **NVA-2 AI-Q provider-neutral adapter contract** when target-PC gates are not available.

## NVIDIA repository-saturation checkpoint

After the NVA-2…NVA-9 subsystem-contract PR merges, stop designing additional NVIDIA abstractions unless a concrete integration test exposes a missing contract.

When target-PC/backend access exists, Codex should execute the integration track using the contracts already in `lib/nvidia/`:

1. finish the core release sequence first when possible:
   `Phase 14 → MEM-X → Phase 16 → Phase 17 → Phase 19 → Phase 20`;
2. validate real NVIDIA/Codex Skill Hub installation mechanism from NVA-1;
3. inspect the real AI-Q supported deployment/API and write only the necessary transport;
4. audit real Sonor before connecting NeMo Retriever/RAG;
5. select and validate real OCR/parser backend;
6. connect real speech/voice transport and microphone evidence;
7. connect actual visual payload transport before DeepStream/VSS;
8. validate real Hermes/NemoClaw version before workflow learning;
9. deploy/configure Guardrails as defense in depth only;
10. run evaluation suites tied to exact target runtime/build.

For every backend: health → happy path → cancellation → malformed response → outage/degradation → STOP/permission behavior → evidence.

Do not claim READY from repository contracts alone.

## Current NVIDIA execution status after PR #161

NVIDIA repo-only design work is complete and CI-verified through PR #161.

Do not ask the owner for another NVIDIA architecture decision. Do not create more provider-neutral wrappers until an actual backend integration proves one is missing.

When target access exists, Codex must autonomously move from contracts to working services, fix concrete failures, collect evidence, and continue until the ready-to-use acceptance gates are met.

If a provider/backend is unavailable, continue every independent core-release task rather than stopping.

## AUTHORITATIVE CURRENT OVERRIDE — after NVIDIA repository saturation

Read `docs/CURRENT_EXECUTION_POINTER.md` first.

This section supersedes older NVIDIA continuation text above that still says "next NVA-1" or "next NVA-2".

Repository truth:
- NVA-0 merged in PR #159;
- NVA-1 merged in PR #160;
- NVA-2…NVA-9 contracts merged in PR #161;
- saturation checkpoint merged in PR #162;
- post-merge main CI run #435 succeeded.

Do not repeat those repository slices.

The next meaningful work is real execution:
1. target-PC Phase 14 → MEM-X → 16 → 17 → 19 → 20;
2. real NVIDIA backend integration against the existing contracts;
3. concrete defect/provider-change repair only.

If target access is unavailable, do not invent another NVIDIA wrapper merely to stay busy.


## 2026-09-22 — Phase 29 continuation override

Before doing any older mission text in this file, inspect current `main`, open PRs, and `docs/CURRENT_EXECUTION_POINTER.md`.

If PR #169 (`feature/phase29-skill-environment-registry`) is still open:
1. inspect its newest CI;
2. fix only concrete failures;
3. keep the generic skill/environment architecture in `docs/SKILL_ENVIRONMENT_BRIDGE.md`;
4. do not build a duplicate registry;
5. merge only after newest-head CI is green.

Once PR #169 is merged, do **not** start speculative repository-only Phase 30 replacements. Resume real execution:
`Phase 14 → MEM-X → Phase 16 → Phase 17 → Phase 19 → Phase 20`,
then provider-backed JARVIS scenarios (including Phase 29/J9 real skill/device evidence) as the target environment allows.
