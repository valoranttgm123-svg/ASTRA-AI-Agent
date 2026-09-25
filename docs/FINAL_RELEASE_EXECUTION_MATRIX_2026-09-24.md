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
- deterministic M3-0…M3-8 sequence from `docs/PERFORMANCE_BASELINE.md`;
- real browser/GPU;
- runtime/status + bounded Ollama latency evidence;
- six required HIGH scenarios/bundle;
- Command Center active;
- Automation panel open;
- console/renderer review;
- evidence-backed optimization only when a concrete bottleneck is measured;
- truthful measured values.

### Gate M4 — full-system approved actions
Canonical: `docs/FULL_SYSTEM_VALIDATION.md`

Need deterministic M4-0…M4-8 real scenarios and failure variants:
- project continuation;
- engineering workflow respecting the active release freeze;
- ALURKA campaign;
- configured Calendar/Email actions or truthful external-configuration BLOCKED;
- Emergency STOP;
- same-build evidence reconciliation and re-run after any build-changing remediation.

### Gate M5 — Windows install/update/reinstall
Canonical:
- `docs/TARGET_PC_EVIDENCE.md`
- `docs/WINDOWS_RELEASE.md`
- `docs/READY_TO_USE_DELIVERY.md`

Need:
- deterministic M5-0…M5-8 sequence from `docs/WINDOWS_RELEASE.md`;
- production install/start;
- loopback binding and startup-task invariants;
- truthful provider/subsystem status;
- private `.astra/` state preservation;
- a real fast-forward update transition or truthful BLOCKED if not exercised;
- reinstall/repair with preservation checks;
- bounded startup health;
- final target evidence reconciliation on the pinned candidate.

### Gate M6 — Phase 20 final core report
Canonical:
- `docs/CORE_RELEASE_REPORT.md`
- `docs/MANUAL_RELEASE_EVIDENCE.md`
- `docs/CORE_RELEASE_CHECKLIST.md`

Use deterministic M6-0…M6-7 sequence from `docs/CORE_RELEASE_REPORT.md`.

Allowed verdicts only:
- READY;
- READY WITH EXTERNAL CONFIGURATION REQUIRED;
- BLOCKED.

Missing/stale/mismatched evidence must remain BLOCKED. Any build-changing fix invalidates affected official evidence and requires a new frozen candidate/re-capture.

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

### Extended dependency order — execute only after core M1–M6 is stable

Do not start broad implementation from this section while the core release evidence still has an active reproducible blocker.

Use this dependency-aware order:

#### E21 — Phase 21 voice transport
Prerequisites:
- stable shared ASTRA runtime;
- permission/STOP foundation;
- real microphone consent path.

Prove first:
- push-to-talk fallback;
- real LISTENING → THINKING → SPEAKING lifecycle;
- interruption/barge-in;
- STOP;
- truthful OFFLINE/NOT_CONFIGURED.

Do not make wake-word/always-on behavior the first proof if the simpler real microphone path is not yet verified.

#### E22 — Phase 22 target identity/trust completion
Prerequisites:
- current trusted-session/device contracts;
- existing secret abstraction.

Prove:
- real OS/session identity;
- owner/device pairing UX;
- lock/unlock;
- secret-use evidence;
- no speaker/face signal used as sole Level-3/4 authorization.

E22 should be completed before broader non-SSH paired-device work.

#### E23 — Phase 23 screen/vision
Prerequisites:
- explicit consent controls;
- shared runtime/event path;
- provider-neutral real-payload contract.

Prove incrementally:
1. active-window metadata;
2. one user-approved screenshot/selected-region path;
3. SCREEN OFF truly stops capture;
4. only then camera/video vision;
5. no retained raw visual payload unless explicitly required.

Do not infer vision from MediaPipe gesture tracking.

#### E24 — Phase 24 proactive Event Engine target proof
Repository sources already exist. Prove real delivery in this order:
1. GitHub Actions event;
2. local service-health event;
3. Automation lifecycle event;
4. notification failure/STOP/restart;
5. dedupe/rate-limit/quiet-hours behavior.

Do not add more event-source abstractions before these real sources are proven.

#### E25 — Phase 25 durable task execution
Prerequisites:
- production executor connection;
- STOP/cancellation behavior;
- permission preservation.

Prove:
1. one long-running disposable task;
2. checkpoint;
3. UI refresh survival;
4. pause/resume/cancel;
5. restart recovery;
6. two independent read-only tasks in bounded parallel;
7. Chief synthesis of real results.

This produces Scenario J4 evidence.

#### E26 — Phase 26 episodic/context fusion
Prerequisites:
- Sonor/MEM-X healthy;
- real project/memory provenance;
- active task state.

Prove with one bounded project timeline first:
- event/decision/reason/result/verification/follow-up;
- provenance;
- user correction;
- source disable;
- no cross-project contamination.

Do not bulk-import unrelated history.

#### E27 — Phase 27 broader multi-device
SSH PC transport is already selected and must not be rebuilt.

After the active Multi-PC evidence passes, add only the missing broader paired-device/mobile layer:
1. secure pairing;
2. authenticated capability advertisement;
3. permitted dispatch/result return;
4. synchronized high-level task state;
5. immediate revoke;
6. Scenario J6.

Do not expose the loopback API publicly to achieve pairing.

#### E28 — Phase 28 recovery/offline
Prerequisites:
- truthful Diagnostics health;
- recovery-specific Tool Runtime capability, not generic command pretending to be recovery.

Prove:
1. explicit connectivity probe;
2. Sonor Diagnostics health/search;
3. one ASTRA-owned service recovery;
4. audit log of attempt/result/verification;
5. offline/degraded mode;
6. J8.

Do not perform privileged system repair automatically.

#### E29 — Phase 29 real skill/device
Repository registries are complete.

Prove:
1. one real provider-backed skill lifecycle: register → review → install → enable → health → update/rollback/disable;
2. one real explicitly registered environment/device capability;
3. read path first;
4. any write only with the required approval/privacy consent;
5. Tool Runtime telemetry + verification;
6. J9.

#### E30 — Phase 30 integration / soak
Begin only after required E21–E29 capabilities intended for the release are real or truthfully external-configured.

Execute J1–J10 against one release candidate, then soak:
- repeated voice cycles;
- provider outage;
- network loss;
- worker restart;
- cancellation;
- memory stress;
- event flood/dedupe;
- device reconnect;
- tool timeout;
- malformed output;
- permission denial;
- audit-log verification;
- Humanoid performance.

Any build-changing fix during Phase 30 invalidates affected evidence and requires re-capture.

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
