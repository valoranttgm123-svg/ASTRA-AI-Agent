# CODEX NEXT MISSION — CURRENT EXECUTION PLAN

Status date: **2026-09-24**

This file is the current executable mission. Historical implementation chronology belongs in `docs/ASTRA_WORKLOG.md`, not here.

Before acting:

1. inspect current `main`;
2. inspect newest CI;
3. inspect open PRs;
4. read `docs/CURRENT_EXECUTION_POINTER.md`;
5. read `docs/CROSS_SESSION_RECONCILIATION_2026-09-22.md`;
6. read `docs/CODEX_REFINEMENT_CONTRACT.md`;
7. then use this mission.

If any older branch/chat/document conflicts with current `main` + the pointer, do not reconstruct the old plan.

## Mandatory refinement behavior

Read `docs/CODEX_REFINEMENT_CONTRACT.md`.

Codex is the **refinement/completion layer** for work ChatGPT has already prepared in the repository.

Do not restart merged ChatGPT work from zero. Inspect it, preserve valid tests/contracts, connect it to the real target PC/provider/runtime, repair evidence-backed defects, finish integration, collect real evidence, polish the result, and deliver it ready-to-use.

The purpose of the ChatGPT repository work is explicitly to **save Codex tokens for the parts that require Codex and the real environment**.

## One-line resume

The owner may say only:

`lanjutkan yang belum selesai`

That is a complete instruction.

Resume automatically from repository truth. Do not ask the owner to restate the roadmap.

## Current target checkpoint — PR #239 runtime installed

PR #239 merged as `290164a8787cf895a9c1a32018c700cf8d6ad551`. Codex reported its clean runtime source installed on PC1, self-check and Windows release validator PASS, and a private registry containing three individually reverified remote Windows targets. Direct ASTRA marker checks passed on all three and unknown-node fail-closed passed.

Do not repeat install/bootstrap/marker validation merely because later documentation commits advanced `main`.

Current work:
- remote administrator/file/service-control evidence;
- unreachable/wrong-node evidence;
- long-running remote STOP/KILL proof;
- one pinned-target multi-step task;
- remaining M1-M6 gates.

For official release evidence, obey `docs/ASTRA_COLLABORATION_PROTOCOL.md` section "Exact-build evidence freeze": choose a final clean commit, install/build it on PC1, freeze `main`, and capture all commit-bound evidence without intervening merges.

## Prepared target/release runbooks — draft PR #241

Use these draft files as execution aids while the PR remains unmerged:

- `docs/MULTI_PC_TARGET_EVIDENCE_RUNBOOK_2026-09-24.md`;
- `docs/FINAL_RELEASE_EXECUTION_MATRIX_2026-09-24.md`.

The multi-PC runbook gives PASS/FAIL/rollback boundaries for the remaining remote admin/file/process/service, unreachable/wrong-identity, STOP/KILL and pinned multi-step gates.

Do not merge PR #241 merely to make these instructions visible on `main` while commit-bound evidence is active.

## Shared work ownership rule

Before choosing a mission item, apply `docs/ASTRA_COLLABORATION_PROTOCOL.md`:

- do not take over an ACTIVE ChatGPT branch by starting a competing implementation;
- if ChatGPT left `REPO_DONE_TARGET_PENDING`, finish the target/runtime evidence and repair only proven gaps;
- if ChatGPT's implementation is imperfect, refine the existing work rather than restart it;
- after Codex changes anything meaningful, update the same pointer/tracker/worklog/handoff so ChatGPT can continue later;
- when a task is fully repository-accessible, leave that slice to ChatGPT unless Codex is already actively working it.

## Current completed repository baseline

Do not rebuild these:

- Phase 14 Automation implementation through PR #92 plus later hardening;
- Phase 15 security/failure hardening;
- Phase 16 runtime measurement harness;
- Phase 16 Humanoid/browser evidence tooling;
- Phase 16 Command Center / Automation-panel evidence tooling — PR #171;
- Phase 17 safe preflight tooling;
- Phase 18 repository RC gate;
- Phase 19 Windows install/update/reinstall/readiness tooling;
- Phase 20 evidence/report tooling;
- NVIDIA JARVIS Model Mesh;
- NVIDIA MAX provider-neutral contracts;
- Phase 24 Event Engine — PR #164;
- Phase 25 Durable Background Tasks — PR #165;
- Phase 28 Diagnostics/Audit/Offline — PR #166;
- Phase 22 Identity/Trust/Secrets — PR #167;
- Phase 27 Multi-device foundation — PR #168;
- Phase 29 Generic Skill/Environment foundation — PR #169;
- local Computer Agent read-only + no-model fast path — PR #217/#218;
- local trusted Owner Mode + direct no-model Owner Mode — PR #221/#222;
- trusted multi-PC SSH Computer Agent transport — PR #225;
- safe SSH node trust-bootstrap/diagnostic helper — PR #226.

Do not recreate PR #217-#226 or repeat PC1 validation unless a concrete regression is reproduced.

Cross-session reconciliation:
- PR #171 merge: `cc8432edcf9e854bba9d0d78c14c7731fd279dbd`;
- PR CI #466 SUCCESS;
- main CI #467 SUCCESS;
- all 206 branches audited.

## Mission order

### Active owner-priority override — multi-PC target evidence

The repository implementation and private-node bootstrap are already complete. PC1 is LOCAL; three remote Windows targets are privately registered and direct marker-validated. Finish this real-environment sequence before starting another repository architecture pass:

1. validate administrator/file/service execution independently on each selected remote node;
2. validate unreachable/wrong-node fail-closed behavior;
3. prove long-running remote STOP/KILL terminates the remote work itself;
4. complete one pinned-target multi-step task end-to-end;
5. continue M1-M6 in canonical order;
6. when official release capture begins, freeze `main` and keep runtime/evidence/repository on the same final clean commit.

Do not invent replacement aliases/IPs, expose private SSH topology in Git, or rebuild the Computer Agent.

When the multi-PC target gate is not the active owner thread or is blocked by unavailable physical targets, execute the first actionable task below.


### M1 — Phase 14 target-PC Automation validation

Canonical document:

`docs/AUTOMATION_VALIDATION.md`

Goal:
- validate real target-PC Automation behavior;
- verify Level-2/3 approval boundaries;
- verify exact occurrence/scope behavior;
- verify STOP during a real running occurrence;
- verify UI/service status remains truthful.

Do not mark PASS from code inspection.

Exit:
- real evidence exists;
- failures are repaired and retested;
- tracker/handoff updated.

### M2 — MEM-X remaining Sonor degradation / cancellation evidence

Canonical documents:

- `docs/SONOR_CODEX_MISSION.md`
- `docs/SONOR_BRIDGE.md`
- `docs/SONOR_UI_INTEGRATION.md`

Already validated on the real target:
- existing Sonor graph preserved;
- real loopback search/retrieval works through the ASTRA adapter;
- project scope is enforced;
- Graphify provenance is preserved;
- Obsidian provenance is preserved.

Remaining rules:
- do not rebuild a duplicate memory graph;
- do not repeat the initial endpoint/provenance audit;
- validate Sonor unavailable/degraded behavior;
- validate active-query cancellation;
- capture Diagnostics health/search evidence where the Phase-28 gate requires it;
- never commit private graph/vault/index data.

Exit:
- outage/degradation behavior is evidenced;
- active-query cancellation is evidenced;
- any separately required Diagnostics Sonor health/search gate is evidenced truthfully.

### M3 — Phase 16 real performance evidence

Canonical documents:

- `docs/PERFORMANCE_BASELINE.md`
- `docs/BROWSER_PERFORMANCE_EVIDENCE.md`

Repository tooling already exists for:
- runtime/status latency;
- Humanoid HIGH browser captures;
- Command Center active capture;
- Automation panel open capture.

For main UI capture, use the merged PR #171 opt-in probe:

`http://127.0.0.1:3017/?perf=1`

Required:
- real target PC/browser/GPU context;
- Humanoid HIGH states/effects;
- Command Center active;
- Automation panel open;
- console review;
- real measured values only.

Do not invent FPS, CPU, memory, latency or browser evidence.

Exit:
- `docs/PERFORMANCE_BASELINE.md` reflects real measurements;
- concrete bottlenecks are fixed and re-measured;
- visual quality is not lowered first as a shortcut.

### M4 — Phase 17 full-system validation

Canonical document:

`docs/FULL_SYSTEM_VALIDATION.md`

Run real scenarios:
- project continuation;
- engineering workflow;
- ALURKA campaign;
- Calendar/Email behavior where configured;
- Emergency STOP;
- documented failure variants.

Safe preflight tooling is not the PASS gate.

Exit:
- every required scenario has exact build/commit and real evidence;
- no fake provider/integration success;
- failures repaired/retested where technically executable.

### M5 — Phase 19 Windows ready-to-use validation

Canonical documents:

- `docs/TARGET_PC_EVIDENCE.md`
- `docs/WINDOWS_RELEASE.md`
- `docs/READY_TO_USE_DELIVERY.md`

Validate on the real target PC:
- supported runtime/dependencies;
- production build/start;
- loopback-only binding;
- desktop/startup behavior;
- Ollama/Codex/Automation/Sonor truthful status;
- private `.astra/` paths;
- update/reinstall;
- bounded startup health.

Exit:
- real install/start/update/reinstall evidence exists;
- reproducible release-blocking defects are fixed.

### M6 — Phase 20 evidence-backed core report

Canonical documents:

- `docs/CORE_RELEASE_REPORT.md`
- `docs/MANUAL_RELEASE_EVIDENCE.md`
- `docs/CORE_RELEASE_CHECKLIST.md`

Use only real private artifacts bound to the same clean build.

Allowed final status remains:
- `READY`;
- `READY WITH EXTERNAL CONFIGURATION REQUIRED`;
- `BLOCKED`.

Missing/stale/mismatched evidence must remain BLOCKED.

Exit:
- final report is generated from real evidence;
- status is truthful;
- no manual gate is marked PASS without valid evidence.

## After the core release sequence

Repository-only JARVIS foundations are already saturated.

Continue real integration, not new mocks:

### Phase 21 — real voice

Requires actual microphone/speech transport, interruption and latency evidence.

### Phase 23 — real situational vision

Requires actual screen/camera pixels, consent, privacy controls and evidence. Metadata alone is not vision.

### Phase 26 — real episodic/context memory

Build on the audited real Sonor/Graphify/Obsidian system. Do not create a competing graph.

### Phase 27 — real multi-device transport

PC-to-PC SSH transport is selected and repository-implemented through PR #225/#226. Validate the real PC2-PC4 targets rather than selecting another PC transport. The broader Phase-27 device work still requires actual pairing/authenticated dispatch/result return/revoke evidence, especially for mobile or non-SSH devices. Do not expose the current loopback API directly.

### Phase 29 — real skills/environment devices

Connect actual provider-backed skills/devices through Tool Runtime and existing approval/privacy boundaries.

### Phase 30 — final JARVIS integration

Run final scenarios, soak, evaluation, STOP/permission behavior, diagnostics/recovery and release evidence against the exact target runtime.

## NVIDIA execution rule

NVIDIA repository architecture is already complete.

### NVIDIA Build API-key source

For the hosted NVIDIA mesh already configured at `https://integrate.api.nvidia.com/v1`:

- use an API key generated from **NVIDIA Build** model access at `https://build.nvidia.com/models`;
- store the secret only on the target PC as `NVIDIA_API_KEY` in local/private configuration such as `.env.local`;
- never commit, paste, log, or persist the key in repository evidence;
- do not substitute a different paid NVIDIA/OpenAI-compatible provider merely because the NVIDIA Build key is absent;
- if NVIDIA authentication/account access requires owner login/MFA, stop at that human boundary and request only that action;
- free/prototyping endpoint availability, quotas, and terms are provider-controlled, so validate live availability rather than claiming permanent unlimited access.

The existing NVIDIA provider remains optional. ASTRA must continue to work through local/fallback providers when NVIDIA Build is not configured.


Do not create another NVIDIA roadmap or provider-neutral wrapper.

For a real NVIDIA subsystem:
1. inspect the actual supported service/tooling/version;
2. implement only the transport/backend glue required by existing contracts;
3. preserve ASTRA Tool Runtime and approvals as final authority;
4. validate:
   `health → happy path → cancellation → malformed response → outage/degradation → STOP/permission → evidence`.

Never claim voice/vision/retrieval/guardrail readiness from contracts alone.

## External/local blocker rule

A real blocker is not permission to fabricate completion.

If one task is blocked by:
- unavailable target PC;
- login/MFA/CAPTCHA;
- unavailable secret;
- physical mic/camera interaction;
- UAC/security consent;
- missing real provider/backend;

then:

1. record the blocker truthfully;
2. continue any independent real task that is actionable;
3. do not create a placeholder subsystem merely to create progress;
4. return to the blocked gate when access exists.

If every remaining task is genuinely external-only, preserve the checkpoint rather than generating speculative code.

## Repository-change rule

When a concrete repository defect is found:

1. verify it against current `main`;
2. create one focused branch;
3. fix the concrete defect;
4. add/update regression tests;
5. run CI;
6. merge only after newest-head CI is green;
7. verify post-merge main CI;
8. update:
   - `docs/CURRENT_EXECUTION_POINTER.md`;
   - `docs/ASTRA_WORKLOG.md`;
   - `docs/CODEX_HANDOFF.md`;
   - the relevant tracker/validation document.

Do not reactivate an old branch only because it is ahead/diverged.

## Branch-history rule

The full 206-branch reconciliation is already recorded in:

`docs/CROSS_SESSION_RECONCILIATION_2026-09-22.md`

Historical branches are forensic history.

Revisit one only when:
- a current open PR depends on it;
- current pointer explicitly names it;
- a fresh comparison proves a missing capability;
- the owner explicitly asks to revive it.

## Zero-touch owner delivery

The owner wants a ready-to-use result, not a list of setup steps.

Perform every technically executable task through available repository/local access.

Ask the owner only for a genuine human/external boundary:
- authentication/MFA/CAPTCHA;
- UAC/security prompt;
- physical observation/consent;
- unavailable secret;
- high-impact approval.

After the boundary is satisfied, resume the mission automatically.

## Immediate owner-priority refinement before broad phase work

When Codex resumes on the target PC, prioritize **real product usability** before starting another broad architecture/refoundation pass.

1. **Responsiveness across every active model/provider**
   - measure time-to-first-useful-output and total completion for AUTO, Ollama, Codex, NVIDIA and any enabled Hermes path;
   - identify whether delay is routing, context/memory retrieval, planning, provider generation, non-streaming transport, or UI rendering;
   - make routine chat use the shortest truthful path;
   - stream tokens/progress wherever the provider supports it;
   - do not optimize NVIDIA while leaving the rest of ASTRA sluggish.

2. **Feature-by-feature runtime audit**
   - start from the existing UI and canonical APIs, not from old branches;
   - for each visible feature, record exactly one of: READY / DISABLED / NOT_CONFIGURED / BROKEN / NOT_EVALUATED;
   - test the real happy path rather than presence of UI/contracts alone;
   - fix only concrete broken or incomplete features, one at a time;
   - preserve current Sonor, memory, approval, privacy, STOP and secret boundaries.

3. **User-facing acceptance**
   - no silent/frozen waiting state;
   - no fake success or fabricated telemetry;
   - no feature advertised as working until target-PC evidence exists;
   - after each fix, capture concise before/after evidence and continue to the next blocker.

The owner's explicit correction is that **the problem is not NVIDIA-only**: all model paths feel insufficiently responsive and many features are still not working. Treat this as the current product-refinement priority.

## Current exact next task

No speculative repository foundation remains from the earlier Phase 24/25/28/22/27/29 sequence.

If real target-PC/local access is available:

`M1 Phase 14 → M2 MEM-X → M3 Phase 16 → M4 Phase 17 → M5 Phase 19 → M6 Phase 20`

If it is not available, change repository code only for a newly demonstrated concrete defect or explicit new owner requirement.
