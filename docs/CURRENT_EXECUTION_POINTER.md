# ASTRA CURRENT EXECUTION POINTER

Status date: **2026-09-22**. This is the authoritative short handoff for interrupted ChatGPT/Codex sessions. Check the actual latest `main`, open PRs and CI first; do not assume this checkpoint is still the HEAD.

## Resume in one sentence

When the owner says `lanjutkan yang belum selesai`, inspect `main`/CI/open PRs; read this pointer, `docs/JARVIS_PROGRESS_TRACKER.md`, `docs/POST_EVENT_SOURCE_HANDOFF_2026-09-22.md`, `docs/CODEX_NEXT_MISSION.md`, `docs/CODEX_REFINEMENT_CONTRACT.md` and the latest worklog/handoff; resume the first active task. Do not ask the owner to reconstruct old chats or recreate merged work. The newer post-event-source handoff supersedes historical "PR #176 active" prose in older worklogs.

## Canonical repository checkpoint

Most recent merged repository refinement sequence:

| PR | Repository capability | Merge SHA | Verified CI |
| --- | --- | --- | --- |
| #171 | Phase 16 actual main-UI evidence probe (`?perf=1`) | `cc8432edcf9e854bba9d0d78c14c7731fd279dbd` | PR #466, main #467 SUCCESS |
| #174 | Phase 25 task-presence + Phase 28 diagnostics/action-history Operations UI | `293216e9f94868d00b2636b125922ff09ec593db` | PR #483, main #484 SUCCESS |
| #175 | Phase 24 Event Inbox / subscription surface | `56059728be8ef60b1badb58a8ef13bade2ba569b` | PR #486, main #487 SUCCESS |
| #176 | Opt-in real GitHub Actions REST source adapter with local sync | `059241751f7b70ac5e4ad6b044f8e8cceeab5787` | PR #494, main #495 SUCCESS |

PR #176 is **MERGED**, not active. Phase 24 now has read-only GitHub source adapter code; real running-PC sync/polling/notifications remain unverified. GitHub adapter defaults OFF, public repo needs no token, private repo uses a local token. Never treat a passing fake-fetch test as evidence of actual target runtime.

Other merged repository foundations: Phase 14 Automation; Phase 15 security; Phase 16 measurement tools; Phase 17 preflight; Phase 18–20 release/evidence tools; Phase 19 Windows tooling; NVIDIA JARVIS Model Mesh + MAX contracts; and Phase 24/25/28/22/27/29 via PRs #164/#165/#166/#167/#168/#169. Their remaining integrations are tracked in `docs/JARVIS_PROGRESS_TRACKER.md`; do not rebuild them from zero.

Historical branches (206 examined on 2026-09-22) were reconciled in `docs/CROSS_SESSION_RECONCILIATION_2026-09-22.md`. A historical branch being ahead/diverged is not evidence of missing work. Do not repeat that audit without a fresh demonstrated capability mismatch.

## Current executable mission — real target/runtime evidence

When target-PC access exists, resume in this order:

1. **Phase 14**: real Automation approvals, exact occurrence/scope and global STOP, including denial/cancellation.
2. **MEM-X**: inspect, preserve and connect the existing real Sonor/Graphify/Obsidian project; do not build a second pipeline.
3. **Phase 16**: real runtime and Humanoid HIGH performance, Command Center-active and Automation-open captures at `http://127.0.0.1:3017/?perf=1`. Evidence must be tied to the actual clean running build; `NOT_EVALUATED` until reviewed.
4. **Phase 17**: real happy/failure/permission/privacy/Emergency STOP scenarios.
5. **Phase 19**: Windows install/start/update/reinstall and exact-build target-PC evidence.
6. **Phase 20**: evidence-backed core release report; do not claim READY without required evidence.
7. Connect real Phase 21 voice, Phase 23 pixel/camera, Phase 26 Sonor episodic fusion, Phase 27 authenticated PC2/mobile transport, Phase 29 provider-backed skill/device, and remaining Phase 24 event sources/notification execution as accessible.
8. **Phase 30**: JARVIS final integration, soak and evaluation.

Detailed local instructions: `docs/CODEX_NEXT_MISSION.md`, `docs/AUTOMATION_VALIDATION.md`, `docs/SONOR_CODEX_MISSION.md`, `docs/PERFORMANCE_BASELINE.md`, `docs/FULL_SYSTEM_VALIDATION.md`, `docs/TARGET_PC_EVIDENCE.md` and `docs/CORE_RELEASE_REPORT.md`.

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


## Active repo-side refinement — PR #180

PR #180 / `feature/service-health-event-adapter` is the active repository slice.

Scope:
- second real Event Engine source from local Diagnostics;
- source `service`, topic `health.state`;
- healthy/not-configured initial baseline stays quiet;
- degraded/unavailable/unknown emits;
- unchanged state skips;
- recovery to HEALTHY emits;
- guarded local status/sync only;
- Operations EVENTS UI exposes source status and manual local sync;
- no fabricated provider activity and no direct event publish control.

If interrupted, inspect PR #180 newest head + CI first; fix only concrete failures and do not recreate Phase 24/28 foundations.
