# CODEX NEXT MISSION — CURRENT EXECUTION PLAN

Status date: **2026-09-22**

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
- Phase 29 Generic Skill/Environment foundation — PR #169.

Cross-session reconciliation:
- PR #171 merge: `cc8432edcf9e854bba9d0d78c14c7731fd279dbd`;
- PR CI #466 SUCCESS;
- main CI #467 SUCCESS;
- all 206 branches audited.

## Mission order

Execute the first task below that is actionable in the current environment.

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

### M2 — MEM-X real Sonor / Graphify / Obsidian

Canonical documents:

- `docs/SONOR_CODEX_MISSION.md`
- `docs/SONOR_BRIDGE.md`
- `docs/SONOR_UI_INTEGRATION.md`

Rules:
- the real Sonor graph already exists; preserve it;
- do not rebuild a duplicate memory graph;
- inspect the real implementation/API before wiring endpoints;
- do not guess routes;
- keep project scope and provenance;
- validate unavailable/cancellation behavior;
- never commit private graph/vault/index data.

Exit:
- actual local Sonor state is known;
- minimal search/retrieval works through the real adapter;
- Graphify/Obsidian provenance is truthful;
- degradation/cancellation is validated.

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

Use the merged trust/device contracts with authenticated/encrypted transport. Do not expose the current loopback API directly.

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

## Current exact next task

No speculative repository foundation remains from the earlier Phase 24/25/28/22/27/29 sequence.

If real target-PC/local access is available:

`M1 Phase 14 → M2 MEM-X → M3 Phase 16 → M4 Phase 17 → M5 Phase 19 → M6 Phase 20`

If it is not available, change repository code only for a newly demonstrated concrete defect or explicit new owner requirement.
