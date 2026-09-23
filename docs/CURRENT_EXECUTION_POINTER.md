# ASTRA CURRENT EXECUTION POINTER

## Active responsiveness blocker — 2026-09-23

Before touching Ollama streaming, read `docs/OLLAMA_SSE_LATENCY_HANDOFF_2026-09-23.md`. The raw Ollama endpoint is fast (~681 ms first token), the pre-#209 direct ASTRA adapter was fast (~448 ms), but the production Next/SSE path showed ~29.5 s first-token latency. PR #209's Node `http.request` experiment regressed the direct adapter and was reverted by PR #210. Next work is timing instrumentation at the exact Next/Ollama/SSE boundaries, not another transport rewrite.
## Target-PC continuation — 2026-09-23

PR #188 Sonor evidence and PR #189 runtime fixes are merged. PR #189 merge:
`2a5d2c40cddfa811c27b59aae2bfcf1795d28d8c`, CI #530 SUCCESS.
Read `TARGET_PC_REFINEMENT_2026-09-23.md` for actual Windows/mobile/STOP/MEM-X
evidence and newly reproduced startup-console/health/repository-gate fixes.
Preserve all later foundations. Next is clean-build installation/evidence and
the still-open M1–M6 gates, not reimplementation or a claim of full readiness.

Status date: **2026-09-22**. This is the authoritative short handoff for interrupted ChatGPT/Codex sessions. Check the actual latest `main`, open PRs and CI first; do not assume this checkpoint is still the HEAD.

## ChatGPT saturation / interruption checkpoint

Read `docs/CHATGPT_SATURATION_CHECKPOINT_2026-09-22.md` before repeating any broad audit. PR #185 (NVIDIA Build API-key handoff) is merged at `a33b08351930e5e6674582811f531b32024bc143`; its PR CI passed. The durable checkpoint records what is repository-complete, what genuinely requires target-PC/provider evidence, and the rule for resuming safely after a chat interruption. A new session must finish any current open PR/CI issue first, but must **not** redo the historical branch reconciliation without a demonstrated capability mismatch.

## Resume in one sentence

When the owner says `lanjutkan yang belum selesai`, inspect `main`/CI/open PRs; read this pointer, `docs/JARVIS_PROGRESS_TRACKER.md`, `docs/POST_AUTOMATION_EVENT_HANDOFF_2026-09-22.md`, `docs/CODEX_NEXT_MISSION.md`, `docs/CODEX_REFINEMENT_CONTRACT.md` and the latest worklog/handoff; resume the first active task. Do not ask the owner to reconstruct old chats or recreate merged work. The newer post-event-source handoff supersedes historical "PR #176 active" prose in older worklogs.

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
