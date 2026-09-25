# ASTRA Final Release Execution Matrix — 2026-09-24

Status: **DRAFT / EXECUTION PLAN / NO RUNTIME CHANGE**

This matrix converts the remaining roadmap into one non-duplicated execution order.

## Stage 0 — current parallel work

Codex:
- finish current functional multi-PC target validation.

ChatGPT:
- keep documentation/release preparation on draft PR only;
- do not move `main` during commit-bound evidence capture.

Current multi-PC remaining:
- remote administrator-context evidence;
- bounded remote file mutation/readback/rollback evidence;
- remote process-control evidence;
- safe service-control evidence or truthful BLOCKED;
- unreachable-node fail-closed evidence;
- wrong-identity fail-closed evidence; unknown-node is already PASS;
- remote STOP/KILL proving the remote work itself terminates;
- pinned multi-step task.

## Stage 1 — close functional defects before final evidence freeze

If Codex finds a real defect:
1. record exact target evidence;
2. classify it as runtime/repository vs environment/configuration;
3. hand repository defect to ChatGPT/Codex refinement branch;
4. merge only the evidence-backed fix;
5. rerun affected functional target test.

Do not start final release capture while known release-blocking defects remain.

## Stage 2 — drain queued repository work

When the active target checkpoint is complete:
1. review open draft PRs;
2. merge only relevant, non-conflicting, CI-green work;
3. update pointer/tracker/handoff;
4. confirm no unintended runtime changes remain;
5. choose the intended release candidate commit.

No new architecture pass is allowed at this stage without a reproduced blocker.

## Stage 3 — choose and install one final clean commit

On PC1:
1. clean checkout/worktree;
2. exact intended commit;
3. dependency/install/build steps per Windows release docs;
4. production start on loopback only;
5. runtime build attestation must report the same full commit;
6. working tree must remain clean.

After this point, begin the **evidence freeze**:
- do not merge into `main`;
- do not change HEAD;
- do not rebuild from another commit;
- do not hand-edit PASS evidence.

## Stage 4 — core target evidence

### Gate M1 — Automation approval / STOP
Canonical: `docs/AUTOMATION_VALIDATION.md`

Need real:
- deterministic M1-0…M1-8 target sequence from `docs/AUTOMATION_VALIDATION.md`;
- Level-2/3 approval boundaries;
- exact occurrence/scope;
- denial/cancellation;
- STOP during a real running occurrence;
- restart/persistence behavior where required;
- restoration of the owner's original Automation enable/disable state;
- truthful UI/service status.

### Gate M2 — Sonor degradation / cancellation
Canonical:
- `docs/SONOR_CODEX_MISSION.md`
- `docs/SONOR_BRIDGE.md`

Already done:
- retrieval;
- project scope;
- Graphify provenance;
- Obsidian provenance.

Still need:
- non-destructive/reversible outage/degradation evidence from Test E/E1;
- active-query cancellation from Test F;
- post-restore health/search proof;
- Diagnostics health/search evidence where separately required;
- truthful BLOCKED when active cancellation cannot be observed because the query completes before cancellation can be exercised.

### Gate M3 — browser/Humanoid HIGH performance
Canonical:
- `docs/PERFORMANCE_BASELINE.md`
- `docs/BROWSER_PERFORMANCE_EVIDENCE.md`

Need:
- real browser/GPU;
- six required HIGH scenarios/bundle;
- Command Center active;
- Automation panel open;
- console review;
- truthful measured values.

### Gate M4 — full-system approved actions
Canonical: `docs/FULL_SYSTEM_VALIDATION.md`

Need real scenarios and failure variants:
- project continuation;
- engineering workflow;
- ALURKA campaign;
- configured Calendar/Email actions;
- Emergency STOP.

### Gate M5 — Windows install/update/reinstall
Canonical:
- `docs/TARGET_PC_EVIDENCE.md`
- `docs/WINDOWS_RELEASE.md`
- `docs/READY_TO_USE_DELIVERY.md`

Need:
- production install/start;
- loopback binding;
- startup behavior;
- truthful provider status;
- private `.astra/` paths;
- update/reinstall;
- bounded startup health.

### Gate M6 — Phase 20 final core report
Canonical:
- `docs/CORE_RELEASE_REPORT.md`
- `docs/MANUAL_RELEASE_EVIDENCE.md`
- `docs/CORE_RELEASE_CHECKLIST.md`

Allowed verdicts only:
- READY;
- READY WITH EXTERNAL CONFIGURATION REQUIRED;
- BLOCKED.

Missing/stale/mismatched evidence must remain BLOCKED.

## Stage 5 — extended JARVIS real-integration gates

These are not permission to add more mocks.

Phase 21:
- real always-on voice transport;
- interruption/latency evidence.

Phase 23:
- real screen/camera pixels;
- consent/privacy evidence.

Phase 24:
- GitHub event source target-runtime notification evidence;
- service-health notification evidence;
- Automation lifecycle delivery/STOP/restart evidence;
- proactive notification delivery/failure/restart evidence.

Phase 25:
- production executors;
- target-PC restart/resume;
- J4 long-running scenario.

Phase 26:
- real Sonor-backed episodic context fusion.

Phase 27:
- PC SSH transport is already selected/implemented;
- broader paired-device/mobile authenticated dispatch/result/revoke;
- J6 evidence.

Phase 28:
- real connectivity probe;
- Sonor Diagnostics health/search;
- offline/degradation J8;
- recovery execution only when a truthful recovery-specific Tool Runtime capability exists.

Phase 29:
- real provider-backed skill lifecycle;
- real environment/device provider;
- J9 evidence.

Phase 30:
- final JARVIS integration;
- soak/evaluation;
- STOP/permission;
- diagnostics/recovery;
- exact-runtime release evidence.

## NVIDIA real-backend gates

Repository contracts are already complete.

Remaining work is actual provider integration only where desired/configured:
- AI-Q;
- NeMo Retriever/RAG;
- OCR/document intelligence;
- Voice/Speech;
- DeepStream/VSS;
- workflow capture/replay;
- Guardrails/content safety;
- evaluation suites.

Do not create a second NVIDIA framework.

## Final release invariants

A READY-class report requires:
- one clean release commit;
- runtime attestation matches that commit;
- evidence captured against that commit;
- no dirty tree;
- no stale manual observations;
- no duplicate PASS check names;
- no secret/private topology in Git;
- all required manual gates supported by real structured evidence;
- no known release-blocking defect.
