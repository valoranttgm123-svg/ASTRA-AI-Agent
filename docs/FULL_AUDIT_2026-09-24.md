# ASTRA Full Repository / Runtime Readiness Audit — 2026-09-24

Status: **AUDIT COMPLETE / FOLLOW-UP REQUIRED**

Actor: ChatGPT
Repository: `valoranttgm123-svg/ASTRA-AI-Agent`
Audited main at start: `ffc6b7209498cd72dd970a27c56c03c453b39490`

This audit is a durable handoff. It does not claim target-PC readiness. It separates:
- repository defects ChatGPT can fix;
- documentation/state drift;
- target-PC/provider work Codex must validate;
- historical work that must not be repeated.

## 1. Repository truth verified

At audit start:
- open pull requests: **0**;
- open GitHub issues: **0**;
- PR #217 through PR #231: **all merged**;
- every checked PR-head ASTRA CI run for #217–#231: **SUCCESS**;
- latest verified PR-head CI (#231):
  - build: success;
  - tests: 457 total, 455 pass, 0 fail, 2 skipped;
  - typecheck: success;
  - lint command: success with warning(s);
  - dependency audit: 0 vulnerabilities;
  - diff check: success.

The two skipped CI tests are Windows-specific:
- Windows STOP terminates owned Codex descendant without killing unrelated Node;
- Windows repository gate launches bundled npm without a command shell.

These skips are expected on Linux CI but mean those Windows behaviors still require real Windows evidence where relevant.

## 2. Recent Computer Agent / runtime sequence verified

Merged and CI-green:
- #217 bounded read-only computer execution;
- #218 direct no-model read-only path;
- #219 multi-PC SSH handoff;
- #220 trusted-node Owner Mode handoff;
- #221 local Owner Mode executor;
- #222 direct local Owner Mode path;
- #223 target startup / false Ollama readiness repair;
- #224 WebGL-denied fallback;
- #225 trusted multi-PC SSH transport;
- #226 SSH trust-bootstrap diagnostics;
- #227–#231 continuity/collaboration/documentation rules.

Do not recreate these PRs.

## 3. HIGH — remote natural-language read-only targeting can silently execute local

Current `lib/brain/adapter.ts` fast path detects prompts such as Windows version/process-list and directly calls the read-only Computer tool.

However the fast path currently calls:

```ts
toolRuntime.execute(directComputerTool, {}, ...)
```

`MultiNodeWindowsComputerTransport` treats an absent `nodeId` as:

```ts
return "local";
```

Therefore a prompt such as:
- "cek versi Windows PC3"
- "lihat proses di PC2"

can be intercepted by the direct read-only fast path but executed against LOCAL because the target is discarded.

This conflicts with the documented intended routing in the multi-PC handoff.

State: **REPO DEFECT — CHATGPT-OWNED FIX**

Required fix:
- preserve an explicit remote node target on the direct read path, or
- bypass the local fast path when the prompt contains an unresolved remote target and let the bounded planner/tool path resolve it;
- never guess an alias/IP;
- add regression tests proving remote target is not silently converted to LOCAL;
- preserve fail-closed behavior for unknown/untrusted nodes.

Do not ask Codex to rebuild multi-PC transport to solve this defect.

## 4. HIGH/MEDIUM — remote system-info timeout is shorter than SSH connection timeout

`computer.system.info` has:

```text
timeoutMs = 5000
```

The SSH transport has:

```text
ConnectTimeout=8
ConnectionAttempts=1
```

Tool Runtime aborts the tool when the 5-second timeout expires.

Result: remote `computer.system.info` may be cancelled by ASTRA before OpenSSH reaches its own connection timeout.

State: **REPO DEFECT — CHATGPT-OWNED FIX**

Required fix:
- make the system-info tool timeout compatible with remote SSH, without making local reads unnecessarily slow;
- preferred implementation should distinguish local/remote timing or choose a bound safely above the SSH connection limit;
- add timeout regression coverage.

## 5. HIGH — current target-PC installed build is not proven equal to current main

The latest explicitly documented production baseline in the WebGL/runtime notes is PR #223 production head `1d3fd72` / merge `bc0d2d4`.

Repository work after that includes:
- #224 WebGL fallback;
- #225 multi-PC transport;
- #226 SSH bootstrap;
- #227–#231 documentation/collaboration synchronization.

There is no current release evidence proving that the physical target PC is running the exact latest repository build.

State: **REPO_DONE_TARGET_PENDING**

Before collecting final multi-PC/release evidence:
1. update target checkout to the intended clean main;
2. create/install a clean production build;
3. verify runtime build identity;
4. only then capture PC2-PC4 / performance / release evidence.

Codex owns the real target installation/evidence. ChatGPT owns repository defects found before that validation.

## 6. HIGH — canonical documentation still contains stale MEM-X/Sonor status

Live evidence already established:
- real Sonor loopback retrieval;
- project-scoped records;
- Graphify provenance;
- Obsidian provenance;
- existing Sonor preserved.

Remaining Sonor/MEM-X work is narrower:
- production outage/degradation evidence;
- active-query cancellation evidence;
- diagnostics health/search integration where separately required;
- release evidence.

But several authoritative/current documents still contain older broad statements:

### `AGENTS.md`
Still says:
- MEM-X still requires real local Sonor access.

This is stale.

### `docs/ASTRA_MAX.md`
Still contains statements that:
- the real Sonor endpoint/schema requires initial inspection;
- production Sonor remains NOT_CONFIGURED until that first check;
- next Codex sequence includes a broad MEM-X Sonor/Graphify/Obsidian audit;
- older Phase-15/Phase-19 text still treats all real Sonor validation as pending.

This file is labelled an approved continuation roadmap, so these stale statements are high-risk.

### `docs/CODEX_NEXT_MISSION.md`
M2 still reads like the full initial MEM-X audit is pending. It should explicitly mark retrieval/provenance as completed and narrow the remaining gate.

### `docs/TARGET_PC_EVIDENCE.md`
Still says real Sonor/Graphify/Obsidian provenance and cancellation are both required. Provenance is already evidenced; cancellation/degradation remain.

State: **DOC DRIFT — CHATGPT-OWNED FIX**

Do not repeat the broad Sonor audit.

## 7. MEDIUM — SESSION_RECOVERY historical checkpoints still use active/current wording

`docs/SESSION_RECOVERY.md` correctly says older sections are chronological history and must not override live main/pointer.

However older sections still contain phrases such as:
- "current implementable repository work: Phase 19B";
- "Active branch: feature/phase28...";
- "Active branch: feature/phase22...";
- "Active branch: feature/phase27...";
- "Active branch: feature/phase29...".

This is historical, but the word "active/current" remains a continuity hazard.

State: **DOC CLEANUP — CHATGPT-OWNED**

Recommended:
- relabel historical headings/entries explicitly as SUPERSEDED/HISTORICAL;
- keep chronology, remove ambiguity.

## 8. MEDIUM — CODEX_PROGRESS_TRACKER duplicates NVIDIA integration gates

`docs/CODEX_PROGRESS_TRACKER.md` lists NVA-2 through NVA-9 real integration work twice:
- first as "NVA-2 real AI-Q..." through NVA-9;
- later again as "actual AI-Q..." through evaluation suites.

This inflates the unchecked-task count and can cause duplicate execution.

State: **TRACKER DUPLICATION — CHATGPT-OWNED**

Required:
- keep one canonical NVA-2…NVA-9 real-integration checklist;
- preserve completed NVA repository-contract history separately.

## 9. MEDIUM — JARVIS tracker contains non-task / overlapping unchecked boxes

`docs/JARVIS_PROGRESS_TRACKER.md` currently has 31 unchecked boxes, but not all are unique executable tasks.

Examples:
- "Ongoing rule: every future meaningful change..." is a standing rule, not a completable task;
- "Do not mark multi-PC Owner Mode fully complete..." is a policy, not a task;
- "Provider health integration:" is a parent summary plus nested pending item;
- PC2-PC4 SSH validation appears both in Computer Agent/Multi-PC and again inside the broader Phase-27 device item.

State: **TRACKER NORMALIZATION REQUIRED**

Required:
- convert permanent rules to prose/invariants;
- avoid double-counting parent + child;
- let the Computer Agent section own PC2-PC4 SSH target validation;
- leave Phase 27 to broader paired-device/mobile authenticated dispatch/revoke work.

## 10. MEDIUM — reliable remote STOP/KILL is not yet proven

Current process cancellation kills the local owned `ssh.exe` process tree.

There is no repository evidence of a remote job token/PID/control channel that independently proves the remote descendant has terminated after an SSH disconnect.

This is already tracked as pending and should not be misclassified as a regression.

State: **REPO_DONE_TARGET/FEATURE_PENDING**

Before multi-PC Owner Mode is complete:
- prove long-running remote execution can be stopped;
- prove the remote work itself stops, not only the local SSH client;
- record truthful timeout/STOP result.

If real testing proves SSH disconnect is insufficient, Codex should provide target evidence and ChatGPT/Codex can refine the design per the collaboration protocol.

## 11. MEDIUM — SSH bootstrap "atomic write" wording is stronger than implementation

The bootstrap verifies all targets before writing, which is good fail-all-before-write behavior.

But the final registry is written directly using:

```powershell
Set-Content -LiteralPath $OutputPath ...
```

There is no temporary-file + replace/rename transaction.

An interruption during final write could leave a truncated/corrupt registry.

State: **ROBUSTNESS / DOC CLAIM MISMATCH — CHATGPT-OWNED**

Recommended:
- write to a sibling temp file;
- validate/read it;
- replace destination;
- clean temp on failure;
- update docs to use "all-target verification before write" unless true atomic replacement is implemented.

## 12. MEDIUM/LOW — node config secret rejection is only top-level

`parseComputerNodesConfig` rejects forbidden top-level keys such as password/token/private-key paths.

Unknown nested structures are ignored, so an object such as a nested custom credentials container is not recursively rejected.

The real file is private/gitignored, so this is not an exposed Git secret today, but it weakens the contract "config must not contain credentials".

State: **HARDENING OPPORTUNITY — CHATGPT-OWNED**

Recommended:
- allowlist accepted node keys, or recursively reject secret-like keys;
- add nested-secret regression tests.

## 13. MEDIUM/LOW — build/lint technical debt

Latest #231 CI build succeeded but emitted warnings:

- `components/AstraReferenceEntity.tsx`: unused `roundRectPath`;
- `components/lab/AstraGpuParticles.tsx`: unused `ASSEMBLY_WINDOW`;
- `components/lab/HumanoidImageStage.tsx`: unused `useMemo`;
- `components/lab/HumanoidImageStage.tsx`: raw `<img>` performance warning;
- `components/lab/HumanoidLabV8.tsx`: unused `ORANGE`;
- `components/lab/HumanoidLabV9.tsx`: missing `runtime` hook dependency warning;
- `components/lab/HumanoidLabV9.tsx`: raw `<img>` performance warning;
- `lib/brain/adapter.ts`: unused catch variable `error`.

Most are cleanup. The HumanoidLabV9 hook warning deserves review because hook dependency mistakes can cause stale runtime behavior.

State: **TECHNICAL DEBT — CHATGPT-OWNED**

Do not change approved humanoid visuals merely to remove `<img>` warnings; preserve image fidelity unless a verified equivalent optimization exists.

## 14. LOW/MEDIUM — CI maintenance warning

Workflow currently uses:
- `actions/checkout@v4`;
- `actions/setup-node@v4`;
- project Node 20.

GitHub Actions reports the actions' Node 20 runtime is deprecated and is being forced to Node 24.

The job itself still passes.

Also a `punycode` deprecation warning appears during tooling.

State: **MAINTENANCE — NOT RELEASE-BLOCKING TODAY**

Upgrade only after compatibility verification. Do not change the application Node baseline casually without target-Windows validation.

## 15. BRANCH HYGIENE — many merged/historical branches remain

The repository still contains a very large number of historical branches:
- many `docs/*`;
- many `feature/*`;
- more than one page of `astra/*`;
- intentional `backup/*` branches.

Open PRs are zero, so these branches are not active work.

The 2026-09-22 cross-session branch reconciliation remains authoritative: a divergent historical branch is not evidence of missing capability.

State: **HYGIENE / CONTINUITY RISK**

Do not delete backup branches automatically.
Do not reactivate old feature branches by name alone.
A future cleanup can delete confirmed merged non-backup branches, but only as a separate owner-approved housekeeping operation.

## 16. Security controls verified positively

Verified repository properties:
- `.astra/` is gitignored;
- `secrets/` is gitignored;
- real secret values are not present in `.env.example`;
- node registry parser rejects obvious password/token/private-key-path fields;
- SSH aliases are syntactically bounded;
- expected COMPUTERNAME is validated;
- SSH uses BatchMode and normal host verification; there is no host-key bypass in the audited transport/bootstrap;
- remote identity mismatch fails closed;
- unknown/untrusted nodes fail closed;
- no silent fallback to a different node in the multi-node transport;
- direct Owner Mode is explicit, Level-2, shell-policy gated and bounded;
- release evidence is bound to private `.astra/` paths and clean runtime/build identity;
- latest dependency audit found **0 vulnerabilities**.

## 17. Current real work state

### Repository complete / do not repeat
- Phase 14 implementation foundation;
- Phase 15 security hardening;
- Phase 16 measurement tooling;
- Phase 17 preflight tooling;
- Phase 18 repository RC gate;
- Phase 19 Windows tooling;
- Phase 20 release/evidence tooling;
- NVIDIA repository architecture/contracts;
- Phase 24/25/28/22/27/29 repository foundations;
- PC1 Computer Agent;
- PC1 Owner Mode;
- direct no-model Owner Mode;
- multi-PC SSH transport;
- SSH trust bootstrap code;
- Sonor retrieval/project scope/Graphify/Obsidian provenance;
- WebGL-denied fallback repository implementation.

### Repository defects ChatGPT should fix before fresh target evidence
1. remote read-only target preservation;
2. remote system-info timeout mismatch;
3. stale Sonor/MEM-X canonical docs;
4. duplicated/ambiguous trackers;
5. bootstrap true atomicity / wording;
6. nested-secret config hardening;
7. low-risk warning cleanup where it does not change approved UX.

### Target/runtime work for Codex after repository follow-up
- update/install exact latest clean build;
- resolve real SSH alias/name-resolution problem;
- bootstrap verified PC2-PC4 registry;
- PC2-PC4 Owner Mode validation;
- remote admin/file/service evidence;
- remote STOP/KILL evidence;
- one pinned-target multi-step task;
- Phase 14 actual approval/STOP validation;
- Sonor outage/degradation + active cancellation;
- Phase 16 real performance/Humanoid HIGH;
- Phase 17 scenarios;
- Phase 19 install/update/reinstall exact-build evidence;
- Phase 20 final evidence-backed report;
- remaining Phase 21/23/24/25/26/27/28/29/30 real integrations;
- real NVIDIA backend/skill/provider integrations where desired/configured.

## 18. Audit conclusion

Repository architecture is substantially advanced and recent PRs are cleanly merged/CI-green, but ASTRA is **not yet release-ready**.

The highest-priority repository defect is the direct read-only multi-PC target-loss bug because it can answer a remote-PC request using the local machine.

The highest-priority continuity defect is stale Sonor/MEM-X status in authoritative documents.

The highest-priority target gate is to run a clean build matching the post-fix main before collecting new physical evidence.

Do not run PC2-PC4 final validation on an older installed build.

## 19. Exact next ownership

ChatGPT:
- fix repository defects and documentation drift above on focused PR(s);
- add regression tests;
- keep pointer/tracker/worklog/handoff synchronized.

Codex:
- do not duplicate those repo fixes while ChatGPT owns them;
- after merged fixes, update/install the exact clean build;
- perform real target/runtime/provider validation;
- refine ChatGPT work when real evidence proves a better approach is needed;
- leave exact handoff evidence back in GitHub.

## 20. DO NOT REPEAT

Do not:
- recreate PR #217–#231;
- redo PC1 Owner Mode validation without a regression;
- rebuild Sonor/Graphify/Obsidian;
- repeat already-proven Sonor retrieval/provenance;
- select another PC transport merely because SSH aliases currently fail;
- treat historical branch names as active work;
- claim READY from CI alone.

## 21. Follow-up remediation — PR #233

ChatGPT started the focused repository remediation on `fix/audit-followups-20260924` / PR #233.

Addressed in the active PR:
- direct read-only remote node preservation and ambiguity rejection;
- system-info timeout compatibility with SSH;
- nested-secret and unknown node-config rejection;
- true temp-validate-replace registry write semantics;
- canonical Sonor/MEM-X status drift;
- duplicate/overlapping tracker entries;
- safe non-visual warning cleanup and Humanoid V9 hook dependency tracking.

Still intentionally target-only after merge:
- exact clean target build install/attestation;
- SSH alias/name-resolution repair;
- PC2-PC4 Owner Mode/admin/file/service evidence;
- reliable remote STOP/KILL evidence;
- remaining release/provider/device gates.

PR #233 newest-head CI passed and merged as `52135e16f4113460807ff9005a72ba7efc53d911`; the repository remediation items above are DONE. Remaining items are target/runtime/provider evidence.
