# ASTRA Repository Instructions for Codex

This repository is the working source of truth for the ASTRA AI Agent project.

## CHATGPT ↔ CODEX COLLABORATION PROTOCOL — mandatory

Read `docs/ASTRA_COLLABORATION_PROTOCOL.md` before implementation work. It defines the cross-session project-memory, no-repeat, roadmap-update and mutual-handoff rules for both ChatGPT and Codex.

Every meaningful ASTRA change must update the canonical pointer/tracker/worklog/handoff in the same work slice so the other agent can continue without reconstructing old chats.

## CODEX REFINEMENT CONTRACT — mandatory

Read `docs/CODEX_REFINEMENT_CONTRACT.md` before implementation work.

Operating model:

**ChatGPT builds as much safe repository work as possible to save Codex tokens. Codex must refine, complete, integrate, validate, polish, and ship that existing work rather than restart it from zero.**

Codex owns the real target-PC/provider/runtime work, evidence-driven fixes, end-to-end validation, and ready-to-use delivery.

## START HERE — current Codex mission

Before changing any code:

0. inspect current `main`, open PRs, and newest CI;
1. read `docs/ASTRA_COLLABORATION_PROTOCOL.md` — **mandatory cross-session ChatGPT/Codex rule**;
2. read `docs/CURRENT_EXECUTION_POINTER.md` — **shortest authoritative current checkpoint**;
3. read `docs/CROSS_SESSION_RECONCILIATION_2026-09-22.md` — stale/divergent branch reconciliation;
4. read `docs/CODEX_REFINEMENT_CONTRACT.md` — mandatory ChatGPT→Codex division of work;
5. read `docs/CODEX_NEXT_MISSION.md` — executable mission and real-environment order;
6. read `docs/JARVIS_PROGRESS_TRACKER.md` — Phase 21–30 repository-foundation truth;
7. read `docs/ASTRA_WORKLOG.md` — durable chronological history;
8. read `docs/SESSION_RECOVERY.md` — interruption/new-session protocol;
9. read `docs/CODEX_HANDOFF.md` and `docs/CODEX_PROGRESS_TRACKER.md`;
10. then read the validation/security document relevant to the active task.

Supporting canonical documents:
- `docs/ASTRA_MAX.md` — approved ASTRA MAX + JARVIS-Class roadmap and Definition of Done;
- `docs/AUTOMATION_VALIDATION.md` — Phase 14 target-PC validation;
- `docs/SONOR_CODEX_MISSION.md` — preserve/audit/connect the existing Sonor; **do not rebuild it**;
- `docs/TARGET_PC_EVIDENCE.md`;
- `docs/BROWSER_PERFORMANCE_EVIDENCE.md`;
- `docs/PERFORMANCE_BASELINE.md`;
- `docs/CORE_RELEASE_REPORT.md`;
- `docs/MANUAL_RELEASE_EVIDENCE.md`;
- `docs/ARCHITECTURE.md` and `SECURITY.md`.

Read these only when the active task needs their historical/detail context:

- `docs/SONOR_BRIDGE.md`
- `docs/SONOR_UI_INTEGRATION.md`
- `docs/ASTRA_CONVERSATION_HISTORY.md`
- `docs/HUMANOID_BUILD_LOG.md`
- `docs/ASTRA_BRAIN_V1.md`

### Verified baseline

- Phase 14 Automation implementation is merged and CI-verified.
- Phase 14 final implementation merge: PR #92.
- Phase 14 final merge commit: `de4fbefe6f9a23792a542a74d4d0ca1aef1aa208`.
- Post-Phase-14 Codex mission/docs merge: PR #93.
- Phase 15A–P15E are merged and CI-verified.
- Phase 15 repository hardening is merged and CI-verified.
- Phase 16A repository performance instrumentation is merged and CI-verified; P16B/P16C still require the target runtime/browser.
- Phase 17A safe full-system preflight tooling is merged and CI-verified.
- Repository cleanup before RC is complete.
- Phase 19A–19G Windows repository tooling/hardening is merged through PR #117.
- PR #150 is the historical release/security audit checkpoint; later NVIDIA/JARVIS foundations and continuity updates are also merged.
- Latest merged continuity checkpoint before cross-session reconciliation: PR #170, `10bc9f57aeeed4431207a11f8b3626e07560c505`.
- Phase 24/25/28/22/27/29 repository foundations are merged; do not recreate them.
- Phase 18A repository RC gate is merged as PR #119; stale/diverged PR #111 is closed as superseded.
- Repository-only release preparation includes target-PC evidence collection, Humanoid/browser capture, conservative Phase 20 report generation, evidence-backed manual gate recording, final-report context recording, strict evidence-shape/private-path validation, runtime-build attestation, end-to-end capture provenance, stale-browser rejection, browser nested-runtime binding, secure optional-cloud transport, exact GitHub remote validation, and process-tree STOP hardening (PRs #121, #123–#126, #129, #142–#145, #147–#150).
- MEM-X still requires real local Sonor access.
- Automation target-PC validation is still required and must not be claimed complete until actually run.
- Background Automation stays OFF by default.
- Unattended Automation stays Level 0/1 only.
- Level 2/3 stay exact-occurrence approval gated.
- Level 4 stays unavailable.

- NVIDIA NIM / Nemotron Ultra provider is merged as PR #152. It is optional, OFF by default, memory-off by default, and cannot execute side effects. Real hosted readiness requires a local `NVIDIA_API_KEY` on the target PC; never commit that key. Read `docs/NVIDIA_NIM.md` before changing this provider.

### Do not stall on external/local-only blockers

If a task requires target-PC access, real Sonor access, login, physical microphone/camera interaction, or another external action that is unavailable:

1. record the blocker truthfully in the handoff;
2. do not fake the validation;
3. continue with the next implementable task in `docs/CODEX_NEXT_MISSION.md`;
4. return to the blocked local-only validation before the corresponding release gate.

Examples:

- If Phase 14 target-PC validation cannot run yet, continue Phase 15A–15F.
- If real Sonor cannot be reached yet, finish all safe ASTRA-side hardening/tests that do not require guessing Sonor endpoints, mark MEM-X externally blocked, and continue the next implementable roadmap work.
- Do not wait idle for a user reply when independent repository work remains.

### Current exact task

Start with the first not-PASS task in `docs/CODEX_NEXT_MISSION.md`.

When target-PC access is unavailable, continue from the first unchecked implementable tracker item.

The old PR #150 paragraph was a historical release/security checkpoint, not the current project head.

Current task selection must come from `docs/CURRENT_EXECUTION_POINTER.md` after checking current `main`, open PRs, and CI. The Phase 24/25/28/22/27/29 repository foundations are merged. If PR #171 (cross-session reconciliation / Phase 16 main-UI evidence recovery) is still open, resume/fix that PR first; if it has merged, do not recreate it.

After reconciliation, the remaining roadmap is primarily real target-PC/provider evidence: Phase 14, MEM-X, Phase 16, Phase 17, Phase 19, Phase 20, then real Phase 21/23/26/27/29 integrations and Phase 30. Change repository code only for a concrete reproduced gap or explicit owner requirement.

Do not rebuild or redesign completed Phase 14 work.

## User shortcut command — autonomous resume

When the user says any short continuation command such as:

- `lanjutkan yang belum selesai`
- `lanjutkan`
- `teruskan`
- `kerjakan yang tersisa`

treat it as an instruction to resume the repository mission automatically.

Do **not** ask the user to restate the roadmap or choose a phase when the repository already contains enough state.

Resume protocol:

1. read current `main`;
2. read `docs/ASTRA_WORKLOG.md`;
3. read `docs/SESSION_RECOVERY.md`;
4. read `docs/CODEX_PROGRESS_TRACKER.md`;
5. read the latest section of `docs/CODEX_HANDOFF.md`;
6. read `docs/CODEX_NEXT_MISSION.md`;
7. read `docs/CODEX_CONTINUATION_NOTE_2026-09-21.md`;
8. identify the first task that is not PASS/complete and is implementable in the current environment;
9. if an earlier task is blocked only by target-PC access, login, Sonor access, camera/mic or another external-only action, record the blocker and continue the next independent repository task;
10. create a focused feature branch;
11. implement the task completely enough to satisfy its exit gate;
12. add/update regression tests;
13. run build, tests, typecheck, lint and audit;
14. open a PR;
15. merge only after green CI;
16. update `ASTRA_WORKLOG.md`, `CODEX_HANDOFF.md`, `CODEX_PROGRESS_TRACKER.md` and any relevant validation document;
17. continue automatically to the next implementable unfinished task.

Stop only when:

- all currently implementable mission tasks are complete, or
- every remaining task genuinely requires external/user-only access or a high-impact approval.

When stopping, report the exact completed PR/commit(s), remaining blockers, and the next task to resume.

The short user command `lanjutkan yang belum selesai` is therefore sufficient. Do not require the user to paste detailed instructions again.

## Project intent

ASTRA should become one integrated AI operating environment:

```text
USER
  ↓
HUMANOID / CHAT / MIC / GESTURE
  ↓
ASTRA RUNTIME / EVENT BUS
  ↓
ASTRA BRAIN
  ├─ Hermes orchestration
  ├─ Ollama local default
  ├─ Codex engineering specialist
  ├─ Memory
  └─ Tools / MCP / optional cloud
  ↓
COMMAND CENTER
  └─ visualizes real agent/tool/task events
```

Humanoid is the face/presence of ASTRA.
Brain is the reasoning/execution layer.
Command Center is the real-time visualization/control surface for Brain activity.

Do not build these as disconnected systems.

## Non-negotiable Humanoid rules

- Keep the approved artwork source:
  `public/assets/astra-humanoid/astra-idle-v1.webp`
- Humanoid remains image-driven, not a newly invented procedural character.
- Preserve the approved silhouette, cyan/orange palette, source proportions, and faceless/bald visual language.
- Do not generate or replace artwork unless the user explicitly asks.
- Keep one renderer.
- HIGH quality should preserve visual fidelity; optimize architecture before lowering quality.
- Never describe a visual pulse as measured audio loudness unless real audio amplitude is actually measured.
- Camera hand tracking uses local MediaPipe inference; do not claim browser speech recognition is local/private.
- Keep Effects Off / reduced-motion fallbacks.
- Preserve recoverable backup branches before large visual refactors.

## Runtime rules

- Real user interaction must drive state:
  `IDLE → LISTENING → THINKING → SPEAKING → IDLE`
- Do not fake agent activity in Command Center.
- Command Center nodes must light from real Brain/runtime events.
- Meaningful stop/cancel actions must actually stop mic/request/speech, not only change animation.
- Paid cloud providers are disabled by default and must not be silently used.
- No secrets in the repository.

## Git / validation rules

Before merging meaningful changes:

- create a recoverable backup branch when the change is risky;
- work on a feature branch;
- run the production GitHub Actions build;
- merge only when CI succeeds;
- update the relevant build/context docs;
- append the merged slice, PR, merge commit, CI result, important finding, and exact next task to `docs/ASTRA_WORKLOG.md`.

## Local commands

Development (run from the actual ASTRA repository root; do not assume a fixed Windows path):

```powershell
git rev-parse --show-toplevel
git switch main
git pull --ff-only
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

Production comparison:

```powershell
npm run build
npm run start
```

## Privacy / repository hygiene

Never commit:
- API keys;
- OAuth tokens;
- passwords;
- SSH private keys;
- broker credentials;
- private memory databases;
- private ChatGPT/system prompts;
- hidden chain-of-thought.

The conversation-history document stores project-relevant decisions and facts, not hidden reasoning or credentials.


## Current approved continuation — ASTRA MAX

The executable next-session plan is `docs/CODEX_NEXT_MISSION.md`; `docs/ASTRA_MAX.md` remains the authoritative product roadmap and Definition of Done.

Do not stop after one hardening slice, Memory task, MCP task, or integration and wait for a new roadmap. Work milestone-by-milestone, preserving recoverable commits and validation gates, until the current mission is complete or all remaining work is genuinely blocked by external/user-only actions.

The 18 ReasoningWeb nodes must become truthful capabilities or truthful unavailable states. A node must never be presented as READY/ONLINE simply because it exists visually.


## JARVIS-Class continuation

`docs/ASTRA_MAX.md` now continues through Phase 30.

Phase 20 is an ASTRA MAX core release checkpoint, not the terminal stop. Once the core release is stable, continue Phase 21–30 automatically unless a genuine external/user action blocks progress.

Do not treat “JARVIS-Class” as permission for fictional claims or unsafe autonomy. The target is a practical always-available assistant experience with truthful always-on voice, opt-in situational awareness, proactive events, episodic memory, durable background work, secure multi-device presence, self-diagnostics, skill/device expansion, verification and user control.


## Existing Sonor graph

A local Sonor workflow graph already exists on the user's target PC at `127.0.0.1:55127`. Reuse it. Do not build a duplicate Graphify/Obsidian system inside ASTRA.

When local PC access is available, inspect Sonor's real server/API implementation and connect the existing `lib/memory/sonor.ts` adapter using the contract in `docs/SONOR_BRIDGE.md`. Do not guess endpoint paths and do not claim READY until the real end-to-end check passes.

## NVIDIA JARVIS Mesh — PR #154

The single NVIDIA Nemotron provider was upgraded to an adaptive four-profile NVIDIA Build/NIM mesh in PR #154, merge commit `ce5a5623867f443ffc931c6b4687b19e38412882`.

Profiles:
- Chief: `nvidia/nemotron-3-ultra-550b-a55b`
- Deep: `z-ai/glm-5-3`
- Fast: `nvidia/nemotron-3.5-lightning-30b-a3b`
- Vision: `z-ai/glm-5-3-flash`

Rules:
- preserve deterministic routing in `lib/brain/nvidia.ts`;
- NVIDIA remains reasoning/chat only and must not bypass Tool Runtime/Codex/Hermes approval boundaries;
- AUTO fallback and private-memory forwarding remain explicit opt-ins;
- Vision must not be reported as active perception until ASTRA carries an actual visual payload;
- never commit `NVIDIA_API_KEY`;
- read `docs/NVIDIA_NIM.md` before modifying NVIDIA routing.

## Zero-touch owner delivery contract

The owner wants a ready-to-use ASTRA, not a sequence of setup instructions.

Read `docs/READY_TO_USE_DELIVERY.md` before target-PC work. Codex owns all technically executable setup, repair, configuration, testing, and release validation. Do not ask the owner to run commands or edit configuration that Codex can perform through its available local access.

Only request human input for unavoidable secrets/login/MFA/consent, UAC/security prompts, physical observations, or genuinely high-impact approvals. Resume automatically after that input.

Repository CI is not sufficient for "ready". Final readiness requires truthful target-PC evidence and no known reproducible release-blocking defect left unfixed.

## NVIDIA MAX canonical direction

The owner approved one final NVIDIA architecture. Do not create a competing NVIDIA roadmap.

Read `docs/NVIDIA_MAX_INTEGRATION.md` before NVIDIA-related work.

Repository rules:
- preserve the existing JARVIS Model Mesh;
- use the NVIDIA Skill Hub as bounded discover/rank/select infrastructure, not as direct execution;
- do not eagerly load the full NVIDIA skill catalog into prompts;
- Sonor/Graphify/Obsidian remains canonical memory; NeMo Retriever/RAG is subordinate retrieval;
- AI-Q is a research backend, not a second Brain;
- DeepStream/VSS is read-only perception unless a separately approved tool acts on results;
- NemoClaw/Hermes learned workflows must be reviewable/revocable and cannot self-elevate permissions;
- NeMo Guardrails is defense in depth; ASTRA Tool Runtime/approval remains final authority;
- NVIDIA evaluation may produce evidence but may not self-declare release READY;
- do not claim voice/vision/provider readiness without real target-PC evidence.

After NVA-0 merges, the next independent repository slice is NVA-1 from `docs/NVIDIA_MAX_INTEGRATION.md`.

## Current execution pointer override

Read `docs/CURRENT_EXECUTION_POINTER.md` immediately after checking current `main`.

It supersedes older "next NVA-1/NVA-2" wording elsewhere in historical sections. NVIDIA repo-only architecture is saturated through PR #162. Future NVIDIA work must be driven by real backend/target-PC evidence or a concrete provider defect/change.

Do not restart NVA-0…NVA-9 from old branch names or chat memory.
