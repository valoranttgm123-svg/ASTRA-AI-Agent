# ASTRA CURRENT EXECUTION POINTER

## Parallel ChatGPT repository status

State: **BLOCKED**
Substate: **SATURATED_WAITING_FOR_TARGET_EVIDENCE**

Draft PR #241 contains the non-conflicting preparation for the current target phase. Pre-defect-review head `e73afab3dc3d0fe324268013161f28a361555e96` passed ASTRA CI #719 (build/tests/typecheck/lint/dependency audit/PR diff check); the private-evidence audit is revalidated across 22 unique files (18 current PR files + 4 additional baseline files). New Codex target evidence on 2026-09-25 reproduced a real remote STOP defect: cancelling the local SSH client did not prove termination of an ASTRA-owned remote parent/descendant. ChatGPT independently confirmed the current-main design gap and recorded review criteria; Codex owns the focused remote-job/heartbeat/lease fix. Do not create a competing implementation.

## Remote STOP defect checkpoint — 2026-09-25

Real target testing has now advanced the long-running remote STOP/KILL gate from **untested** to **TESTED FAIL**. The local SSH client was cancelled, but an ASTRA-owned remote parent/descendant survived. Current `main` terminates the locally owned `ssh.exe` tree but has no committed remote job-id/heartbeat/lease lifecycle proving remote Windows work terminates.

Codex is validating a focused fix locally. Local Windows regression tests were reported PASS, but one configured Windows SSH shell still exposes a long-command lease/transport issue, so this is **not release-ready**. The fix has not yet been pushed to GitHub. ChatGPT must review the actual diff after push; do not implement a competing remote STOP design in parallel.

## Owner continuity rule — checkpoint every completed task

Every completed ASTRA work slice by ChatGPT or Codex must create a durable GitHub checkpoint **before the next task starts**. During the current evidence freeze, checkpoints belong on the existing draft PR #241 rather than moving `main`.

## Session checkpoint — 2026-09-24 15:42 WIB

Resume from `docs/SESSION_CHECKPOINT_2026-09-24_1542_WIB.md` and open draft PR #241. Do not recreate or merge the draft merely because a new chat/session started.

## Codex PR #239 merged — target validation in progress

STATE: **REPO + PC1 INSTALL DONE / REMOTE ADMIN-FILE-STOP EVIDENCE PENDING**

PR #239 merged as `290164a8787cf895a9c1a32018c700cf8d6ad551`.
Its exact PR head passed ASTRA CI. Codex then reported the clean production
source installed on PC1, default self-check success, Windows release-validator
success, preserved private config/project/automation hashes, and a private
registry containing only three individually reverified remote Windows targets.
PC1 remains LOCAL.

Direct ASTRA remote marker checks passed on all three registered remotes and an
unknown-node request failed closed. Do not rebuild or re-bootstrap the transport
unless a regression is reproduced.

Current multi-PC target work:
1. capture remote administrator-context evidence;
2. capture bounded remote file mutation/readback/rollback evidence;
3. capture remote process-control evidence with an owned disposable process;
4. capture safe service-control evidence, or record truthful BLOCKED if no disposable service exists;
5. capture unreachable-node fail-closed evidence;
6. capture wrong-identity fail-closed evidence; unknown-node fail-closed is already PASS and must not be repeated;
7. re-test long-running remote STOP/KILL after the focused fix; the 2026-09-25 target test is **FAIL** because remote parent/descendant work survived local SSH cancellation;
8. complete one pinned-target multi-step task end-to-end;
9. continue the remaining real release gates.

## PC1 runtime and multi-PC state after PR #239

State: **PC1 RUNTIME VALIDATED / THREE REMOTES REGISTERED / DEEP REMOTE EVIDENCE PENDING**

Completed by Codex after PR #239:
- native Windows startup probe fix merged and CI-green;
- clean PR #239 runtime source installed on PC1;
- default self-check and Windows release validator passed;
- private configuration/project/automation hashes preserved;
- PC1 remains LOCAL;
- three remote Windows targets were individually reverified and written to the private registry;
- direct ASTRA marker checks passed on all three registered remotes;
- unknown-node fail-closed passed.

Do not repeat alias resolution/bootstrap or recreate the startup-probe fix unless a regression is reproduced.

Remaining multi-PC evidence:
1. remote administrator-context evidence;
2. bounded remote file mutation/readback/rollback evidence;
3. remote process-control evidence;
4. safe service-control evidence or truthful BLOCKED;
5. unreachable-node fail-closed evidence;
6. wrong-identity fail-closed evidence;
7. long-running remote STOP/KILL proving the remote work itself terminates;
8. one pinned-target multi-step task end-to-end.

### Prepared draft execution aids

ChatGPT prepared, on draft PR #241 only:

- `docs/MULTI_PC_TARGET_EVIDENCE_RUNBOOK_2026-09-24.md` — admin/file/process/service/fail-closed/STOP-KILL/pinned-task evidence sequence with rollback rules;
- `docs/FINAL_RELEASE_EXECUTION_MATRIX_2026-09-24.md` — non-duplicated M1-M6 + extended JARVIS/NVIDIA release order;
- `docs/BRANCH_HYGIENE_PLAN_2026-09-24.md` — post-checkpoint cleanup plan; no deletion is authorized during target evidence;
- `docs/VERIFIED_BRANCH_CLEANUP_CANDIDATES_2026-09-24.md` — 12 recent branches currently verified with zero unique commits;
- `docs/MULTI_PC_EVIDENCE_RESULT_TEMPLATE_2026-09-24.md` — public-safe schema for recording target results privately;
- `docs/RELEASE_FREEZE_CHECKLIST_2026-09-24.md` — exact-build freeze checklist;
- `docs/POST_CODEX_RECONCILIATION_CHECKLIST_2026-09-24.md` — durable handoff checklist after each Codex target checkpoint.

These files are intentionally not merged while commit-bound target evidence is active.

### Exact-build evidence caution

ASTRA's official release collector requires the running build, repository evidence and current clean `HEAD` to match the same commit from capture start through completion. PR #239 supplied the installed runtime code; later documentation synchronization advanced `main` without changing runtime behavior.

Therefore:
- Codex may continue non-destructive functional multi-PC validation on the installed runtime;
- do not treat those observations as final current-HEAD release evidence after `main` advances;
- while official commit-bound release capture is active, freeze `main`;
- queued ChatGPT documentation/cleanup work should remain on draft branches until the target evidence checkpoint is complete;
- after queued changes merge, select one final clean commit, install/build it once on PC1, then capture the official final evidence without additional merges.

## Post-remediation hardening complete

State: **REPOSITORY HARDENING COMPLETE / TARGET EVIDENCE PENDING**

The focused follow-up after PR #233 now also:
- fails closed on explicit remote read failure/unavailability instead of falling through to planner reinterpretation;
- rejects secret-like and unsupported fields at the root of the private node registry.

Validation before final merge:
- ASTRA CI PASS;
- 460 tests / 458 pass / 0 fail / 2 Windows-only skips;
- dependency audit 0 vulnerabilities.

Do not recreate this hardening. Remaining work is target/runtime/provider evidence.

## Audit remediation merged — PR #233

State: **REPOSITORY FIXES DONE / TARGET EVIDENCE PENDING**

PR #233 merged as `52135e16f4113460807ff9005a72ba7efc53d911` after full CI success.

Completed repository fixes:
- direct read-only remote node preservation;
- system-info timeout compatibility with SSH;
- nested-secret/unknown node-config rejection;
- temp-validate-replace SSH registry writes;
- stale MEM-X/Sonor canonical status;
- duplicate/overlapping tracker entries;
- safe non-visual CI warning cleanup and Humanoid V9 gesture dependency tracking.

Do not recreate PR #233. Its repository fixes are complete. Current target work is the already-registered three-remote deep evidence slice (admin/file/process/service, unreachable/wrong-identity, STOP/KILL, pinned multi-step), followed by broader release gates under the exact-build freeze rule.

## Full audit checkpoint — 2026-09-24

Read `docs/FULL_AUDIT_2026-09-24.md` for the complete historical audit and remediation record.

Current status after PR #233:
- repository defects identified by the audit are remediated and merged;
- open PRs/issues are zero at this checkpoint;
- do not repeat the fixed remote-read, timeout, node-config, SSH-registry, MEM-X documentation or tracker work;
- PR #239 runtime code was installed and validated on PC1; later documentation-only synchronization advanced `main`, so final release evidence must use a later frozen final commit;
- remaining work is deep remote target evidence plus the broader target/runtime/provider gates.

## Mandatory collaboration continuity

Before any ChatGPT or Codex implementation, read `docs/ASTRA_COLLABORATION_PROTOCOL.md`.

The owner requires ChatGPT and Codex to act as one continuous ASTRA team. Every meaningful change must synchronize the roadmap/pointer/worklog/handoff. New or interrupted sessions must resume existing `ACTIVE`/`BLOCKED` work and must not recreate merged work.

## Work ownership rule

ChatGPT and Codex must not compete for the same ASTRA slice. ChatGPT completes safe repository work; unresolved target/runtime/provider work is handed to Codex with an explicit trail. Codex refines and finishes the existing implementation by default, but a clearly better evidence-backed Codex proposal should be adopted when it improves ASTRA. Replacement without reason is prohibited; superior validated refinement is welcome. Both agents must update roadmap/pointer/worklog/handoff after meaningful changes.

## Historical merged-capability checkpoint — 2026-09-24 (superseded by the live state at the top)

Live repository truth at this checkpoint:

- capability baseline entering this synchronization: PR #226 merge `6cdfe8089dfb2e0273e984ca4ad9a2952d157b8e`; live `main`, open PRs and newest CI always supersede any literal checkpoint SHA;
- PR #225 merged the trusted multi-PC SSH Computer Agent transport after full ASTRA CI success;
- PR #226 merged the safe SSH trust-bootstrap/diagnostic helper after full ASTRA CI success;
- PC1 local read-only execution, local Owner Mode and direct no-model Owner Mode are already implemented and target-validated;
- repository-side multi-PC routing, private node registry, target identity verification, fail-closed behavior and explicit remote Owner Mode syntax are complete;
- PC1 is LOCAL and three remote Windows targets are already privately registered and marker-validated; remaining multi-PC gates are admin/file/process/service, unreachable/wrong-identity, remote STOP/KILL and one pinned multi-step task.

Do **not** recreate PR #217-#226, redo PC1 validation, rebuild the Computer Agent transport, or start another SSH architecture unless a concrete regression is reproduced. The current remote sequence is:

1. capture remote administrator-context evidence on the verified remote nodes;
2. capture bounded file mutation/readback/rollback evidence;
3. capture remote process-control evidence;
4. capture safe service-control evidence or truthful BLOCKED;
5. capture unreachable-node fail-closed evidence;
6. capture wrong-identity fail-closed evidence; do not repeat the already-PASS unknown-node check;
7. prove long-running remote STOP/KILL terminates the remote work itself;
8. complete one pinned-target multi-step task;
9. then continue the remaining real release gates under the exact-build evidence-freeze rule.

Historical observation: intended aliases previously failed name resolution. This is superseded: PC1 is LOCAL and three remote Windows targets are now privately registered and marker-validated. Exact aliases remain private.

## Browser availability refinement — 2026-09-24

PR #223 is merged (`bc0d2d4`, PR CI #605 / main #606 SUCCESS) and production
head `1d3fd72` was installed and verified. See its PR comment for final evidence.
The next reproduced defect is repeated WebGL initialization errors during normal
chat rerenders in a browser that denies GPU contexts. See
`WEBGL_FALLBACK_2026-09-24.md`. Preserve the approved image/HIGH renderer; fall back
only when WebGL2 is unavailable. The earlier remote-alias name-resolution observation is superseded; PC1 is LOCAL and three remote Windows targets are privately registered and marker-validated;
physical voice/HP and remaining comprehensive release gates are still unverified.

## Target runtime recovery — 2026-09-24

Baseline: PR #222 / `0b07a4c`, main CI #604 SUCCESS; no open PR.
Local Owner Mode is already merged. Read `RUNTIME_RECOVERY_2026-09-24.md`
for the reproduced development HTTP 500, stopped Ollama task, and false-positive
Ollama readiness fix. Install a clean production build before release capture.
Read `CODEX_MULTI_PC_SSH_HANDOFF_2026-09-23.md` for the current remote-node validation sequence. PR #225/#226 already provide the repository transport/bootstrap; do not recreate local or multi-PC execution. Physical voice, real remote-PC evidence and M1–M6 evidence gates remain separate from this startup repair.

## Active responsiveness blocker — 2026-09-23

Latest target diagnosis after PR #213: a resident model can still spend seconds
prefilling a new system prefix. Read `OLLAMA_PREFILL_REFINEMENT_2026-09-23.md`.
The focused fix compacts only the already-context-free lightweight Ollama path;
project/memory/action prompts and explicit provider selection are unchanged.
Production remeasurement must bind to the new clean build, not old artifacts.

Before touching Ollama streaming, read `docs/OLLAMA_SSE_LATENCY_HANDOFF_2026-09-23.md`. The raw Ollama endpoint is fast (~681 ms first token), the pre-#209 direct ASTRA adapter was fast (~448 ms), but the production Next/SSE path showed ~29.5 s first-token latency. PR #209's Node `http.request` experiment regressed the direct adapter and was reverted by PR #210. Next work is timing instrumentation at the exact Next/Ollama/SSE boundaries, not another transport rewrite.
## Target-PC continuation — 2026-09-23

PR #188 Sonor evidence and PR #189 runtime fixes are merged. PR #189 merge:
`2a5d2c40cddfa811c27b59aae2bfcf1795d28d8c`, CI #530 SUCCESS.
Read `TARGET_PC_REFINEMENT_2026-09-23.md` for actual Windows/mobile/STOP/MEM-X
evidence and newly reproduced startup-console/health/repository-gate fixes.
Preserve all later foundations. Next is clean-build installation/evidence and
the still-open M1–M6 gates, not reimplementation or a claim of full readiness.

Historical checkpoint date: **2026-09-22**. The live state at the top of this file supersedes this older status block. Always inspect actual `main`, open PRs and CI first.

## ChatGPT saturation / interruption checkpoint

Read `docs/CHATGPT_SATURATION_CHECKPOINT_2026-09-22.md` before repeating any broad audit. PR #185 (NVIDIA Build API-key handoff) is merged at `a33b08351930e5e6674582811f531b32024bc143`; its PR CI passed. The durable checkpoint records what is repository-complete, what genuinely requires target-PC/provider evidence, and the rule for resuming safely after a chat interruption. A new session must finish any current open PR/CI issue first, but must **not** redo the historical branch reconciliation without a demonstrated capability mismatch.

## Resume in one sentence

When the owner says `lanjutkan yang belum selesai`, inspect `main`/CI/open PRs; **resume any open PR/active branch first**; read this pointer, the current session checkpoint/recovery file, `docs/JARVIS_PROGRESS_TRACKER.md`, `docs/CODEX_NEXT_MISSION.md`, `docs/CODEX_REFINEMENT_CONTRACT.md` and the latest worklog/handoff; resume the first valid active task. Dated handoffs such as `docs/POST_AUTOMATION_EVENT_HANDOFF_2026-09-22.md` are historical context only and cannot override this pointer. Do not ask the owner to reconstruct old chats or recreate merged work. The newer post-event-source handoff supersedes historical "PR #176 active" prose in older worklogs.

## Canonical repository checkpoint

Most recent merged repository refinement sequence:

| PR | Repository capability | Merge SHA | Verified CI |
| --- | --- | --- | --- |
| #171 | Phase 16 actual main-UI evidence probe (`?perf=1`) | `cc8432edcf9e854bba9d0d78c14c7731fd279dbd` | PR #466, main #467 SUCCESS |
| #174 | Phase 25 task-presence + Phase 28 diagnostics/action-history Operations UI | `293216e9f94868d00b2636b125922ff09ec593db` | PR #483, main #484 SUCCESS |
| #175 | Phase 24 Event Inbox / subscription surface | `56059728be8ef60b1badb58a8ef13bade2ba569b` | PR #486, main #487 SUCCESS |
| #176 | Opt-in real GitHub Actions REST source adapter with local sync | `059241751f7b70ac5e4ad6b044f8e8cceeab5787` | PR #494, main #495 SUCCESS |
| #178 | Diagnostics provider-health wiring (Ollama/Codex/NVIDIA/Hermes/Cloud) | `dfc7d93fb02e8e32375dd7c3d8ebc7370232c078` | PR #500, main #501 SUCCESS |
| #180 | Local service-health → Event Engine source + Operations sync surface | `3047ea30c060211c2c3c8aabc7b4920e0f7166d1` | PR #506, main #507 SUCCESS |
| #182 | Automation lifecycle → Event Engine runtime bridge | `d04876391483500dda4f0755c4f1c120a25eae07` | PR #512 SUCCESS; main #513 exposed test race |
| #183 | Deterministic Automation Event integration-test hotfix | `0f1cff3723aeb30a56270b86d5b8dcfef713ca2a` | PR #516, main #517 SUCCESS |

PR #176 is **MERGED**, not active. Phase 24 now has read-only GitHub source adapter code; real running-PC sync/polling/notifications remain unverified. GitHub adapter defaults OFF, public repo needs no token, private repo uses a local token. Never treat a passing fake-fetch test as evidence of actual target runtime.

Other merged repository foundations: Phase 14 Automation; Phase 15 security; Phase 16 measurement tools; Phase 17 preflight; Phase 18–20 release/evidence tools; Phase 19 Windows tooling; NVIDIA JARVIS Model Mesh + MAX contracts; and Phase 24/25/28/22/27/29 via PRs #164/#165/#166/#167/#168/#169. Their remaining integrations are tracked in `docs/JARVIS_PROGRESS_TRACKER.md`; do not rebuild them from zero.

Historical branches (206 examined on 2026-09-22) were reconciled in `docs/CROSS_SESSION_RECONCILIATION_2026-09-22.md`. A historical branch being ahead/diverged is not evidence of missing work. Do not repeat that audit without a fresh demonstrated capability mismatch.

## Target-PC MEM-X validation — 2026-09-22

Real target-PC evidence now confirms the existing Sonor bridge is live and read-only on loopback. ASTRA queried Sonor through the production bridge, received 6 bounded records including 4 graph-backed records, preserved `project` / `obsidian` / `graphify` provenance, and completed the turn through local Ollama `qwen3.5:4b`.

The misleading healthy-Ollama status prefix from unavailable Hermes was fixed by PR #187 and merged as `016ac06f9f7363703e3ac312ea6b0dfe774bd9d5`; PR CI #526 passed.

The Windows `ASTRA-Ollama` Scheduled Task was also verified on the target PC: it launches the existing loopback-only Ollama service, `/api/version` responds, the listener is `127.0.0.1:11434`, and the latest task result is success. Do not create a duplicate Ollama task.

MEM-X runtime integration is therefore validated. Remaining MEM-X preservation work is limited to safe private backup/source preservation if desired plus any explicit failure/cancellation evidence required by later release gates. Do not upload Sonor runtime/user datasets, private notes, indexes, secrets, caches, or generated output to public GitHub.

## Current executable mission — real target/runtime evidence

When target-PC access exists, resume in this order:

1. **Phase 14**: real Automation approvals, exact occurrence/scope and global STOP, including denial/cancellation.
2. **MEM-X**: runtime bridge is validated. Preserve the existing Sonor/Graphify/Obsidian project; complete only safe private backup/source preservation and any explicit failure/cancellation evidence still required. Do not build a second pipeline.
3. **Phase 16**: real runtime and Humanoid HIGH performance, Command Center-active and Automation-open captures at `http://127.0.0.1:3017/?perf=1`. Evidence must be tied to the actual clean running build; `NOT_EVALUATED` until reviewed.
4. **Phase 17**: real happy/failure/permission/privacy/Emergency STOP scenarios.
5. **Phase 19**: Windows install/start/update/reinstall and exact-build target-PC evidence.
6. **Phase 20**: evidence-backed core release report; do not claim READY without required evidence.
7. Connect real Phase 21 voice, Phase 23 pixel/camera, Phase 26 Sonor episodic fusion, Phase 27 authenticated PC2/mobile transport, Phase 29 provider-backed skill/device, and remaining Phase 24 event sources/notification execution as accessible.
8. **Phase 30**: JARVIS final integration, soak and evaluation.

Detailed local instructions: `docs/CODEX_NEXT_MISSION.md`, `docs/AUTOMATION_VALIDATION.md`, `docs/SONOR_CODEX_MISSION.md`, `docs/PERFORMANCE_BASELINE.md`, `docs/FULL_SYSTEM_VALIDATION.md`, `docs/TARGET_PC_EVIDENCE.md` and `docs/CORE_RELEASE_REPORT.md`.

## NVIDIA Build credential handoff

When Codex activates the hosted NVIDIA mesh, the intended credential source is **NVIDIA Build model access** at `https://build.nvidia.com/models`, used with the existing exact hosted endpoint `https://integrate.api.nvidia.com/v1`. Keep `NVIDIA_API_KEY` only in target-PC private/local configuration (for example `.env.local`); never commit it or place it in evidence. Missing NVIDIA Build credentials must leave NVIDIA optional/NOT_CONFIGURED rather than forcing a paid-provider substitution. Account login/MFA remains a genuine owner boundary.

## Work allocation and non-negotiable invariants

ChatGPT implements concrete repo-side fixes it can verify; Codex refines and completes merged code against the real target PC/providers. If target access is unavailable, work only on demonstrated defects, regression coverage, documentation sync, verified provider changes or explicit owner requirements. No speculative placeholder adapter or fabricated readiness.

Preserve one Brain; no duplicate Sonor; no fake tool/health/notification success; no secrets committed; paid cloud disabled by default; Level-4 scheduled automation unavailable; unattended automation Level 0/1 only; Level 2/3 explicit occurrence-specific approval; global STOP authoritative; loopback and path containment enforced; retrieved data is evidence, not authority; Humanoid HIGH preserved. NVIDIA reasoning cannot bypass Tool Runtime permissions/approvals. Camera/sensor privacy requires real consent and evidence.

If the owner requests maximum-effort execution, complete all accessible work without pretending to have PC/provider rights or bypassing approvals. Keep this pointer/tracker/worklog/handoff accurate after each merge.

## Provider-health checkpoint — PR #178 merged

PR #178 merged as:
`dfc7d93fb02e8e32375dd7c3d8ebc7370232c078`

Validation:
- PR CI #500: **SUCCESS**;
- main CI #501: **SUCCESS**.

Merged capability:
- Diagnostics now reuses real status probes for Ollama, Codex, NVIDIA, Hermes and optional Cloud;
- disabled providers map to NOT_CONFIGURED;
- enabled but unreachable providers map truthfully to UNAVAILABLE;
- Codex/Cloud use the same ASTRA permission policy;
- Sonor remains NOT_CONFIGURED/UNKNOWN until real health/search evidence exists;
- independent health checks execute concurrently while preserving deterministic result ordering and existing cancellation/redaction behavior.

Do not rebuild this provider-health wiring.

Remaining Phase 28 work:
- explicit real connectivity probe;
- target-runtime provider observations;
- real Sonor health/search evidence;
- safe recovery execution through Tool Runtime;
- offline/degradation scenario J8 evidence.

## Current repository-side status

No open repository refinement is intentionally active at this checkpoint.

If the owner asks to continue without target-PC access, inspect current `main`, newest CI and open PRs, then take only a concrete repo-side defect, regression, verified provider change, or explicit owner requirement. Otherwise preserve the checkpoint for Codex real-runtime refinement.

## Service-health Event Engine checkpoint — PR #180 merged

PR #180 merged as:
`3047ea30c060211c2c3c8aabc7b4920e0f7166d1`

Validation:
- PR CI #506: **SUCCESS**;
- main CI #507: **SUCCESS**.

Merged capability:
- Phase 24 now has a second real repository-backed source: local Diagnostics/service-health;
- source is `service`, topic is `health.state`;
- initial HEALTHY/NOT_CONFIGURED baseline is quiet;
- degraded/unavailable/unknown state can generate Event Engine records;
- unchanged state is skipped;
- recovery back to HEALTHY can generate a recovery event;
- status/sync surface is loopback/guarded and does not expose direct publish;
- Operations EVENTS UI exposes source status and manual local sync;
- provider-health truth still comes from Diagnostics and preserves Sonor UNKNOWN/NOT_CONFIGURED until real evidence exists.

Do not rebuild the service-health adapter or provider-health wiring.

Phase 24 now has three real repository-side source integrations: GitHub Actions, local service-health, and Automation lifecycle. Remaining Phase 24 work is real target-runtime polling/notification/failure/STOP/restart evidence. Do not invent additional Calendar/Email/provider adapters merely to create progress.

## Current repository-side status

No open repository refinement is intentionally active at this checkpoint.

If the owner asks to continue while target-PC/provider access is unavailable:
1. inspect current `main`, newest CI and open PRs;
2. fix a concrete defect/regression if one exists;
3. implement only a genuinely supported real source/provider change or explicit owner requirement;
4. otherwise preserve this checkpoint for Codex real-runtime refinement.

Codex continues to own target-PC sync/polling/proactive notification evidence, Phase 14/MEM-X/16/17/19/20 real execution, and real provider/device completion.

## Automation lifecycle Event Engine checkpoint — PR #182 + #183 complete

PR #182 merged as:
`d04876391483500dda4f0755c4f1c120a25eae07`

Capability:
- adds an Automation lifecycle observer without changing runner authority;
- attaches Event Engine bridge before Automation Service startup;
- maps due/waiting-approval/claimed/started/completed/failed/cancelled into source `automation`;
- preserves Event Engine subscription/dedupe/debounce/rate-limit/quiet-hours policy;
- redacts lifecycle detail before persistence;
- Event Engine publication failures cannot break Automation execution or global STOP;
- exposes read-only bridge counters/status through the existing Automation Service API;
- full service→bridge→canonical Event Store integration is regression-tested.

Validation:
- PR #182 CI #512: **SUCCESS**;
- post-merge main CI #513 found one nondeterministic test wait only;
- PR #183 fixed the test by awaiting the real canonical publish completion without changing runtime behavior;
- PR #183 CI #516: **SUCCESS**;
- main CI #517: **SUCCESS**;
- PR #183 merge: `0f1cff3723aeb30a56270b86d5b8dcfef713ca2a`.

Do not rebuild this bridge or reintroduce a blocking Event Store write into Automation execution.

## Phase 28 recovery audit boundary

The existing Tool Runtime does **not** currently expose a truthful recovery tool for:
- provider reconnect;
- ASTRA service restart;
- transient-cache clearing.

Existing tools such as `computer.app.launch` are not equivalent recovery primitives. Therefore safe recovery execution remains pending until a real provider/service-specific tool exists with correct permission, cancellation and verification semantics. Do not fabricate recovery success by mapping proposals to unrelated generic tools.

## Current repository-side status

No open repository refinement is intentionally active at this checkpoint.

If the owner says `lanjutkan yang belum selesai`:
1. inspect current `main`, newest CI and open PRs;
2. resume an open PR first if one exists;
3. take a concrete verified repo defect/provider change if one exists;
4. otherwise hand off to Codex for real target-PC/provider execution:
   `Phase 14 → MEM-X → Phase 16 → Phase 17 → Phase 19 → Phase 20`,
   plus real Phase 24 notification evidence and later Phase 21/23/26/27/29/30 integration.
