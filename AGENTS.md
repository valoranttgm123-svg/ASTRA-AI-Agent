# ASTRA Repository Instructions for Codex

This repository is the working source of truth for the ASTRA AI Agent project.

## START HERE — current Codex mission

Before changing any code, read these files in this exact order:

1. `docs/CODEX_NEXT_MISSION.md` — **current executable mission and task order**.
2. `docs/CODEX_HANDOFF.md` — current implementation state, verified baseline and next task.
3. `docs/CODEX_PROGRESS_TRACKER.md` — persistent completion checklist; update after every merged slice.
4. `docs/SECURITY_VALIDATION.md` — Phase 15 hardening matrix.
5. `docs/ASTRA_MAX.md` — approved ASTRA MAX + JARVIS-Class roadmap and Definition of Done.
6. `docs/ASTRA_ROADMAP.md` — milestone history and current phase sequence.
7. `docs/AUTOMATION_VALIDATION.md` — Phase 14 target-PC validation still required.
8. `docs/SONOR_CODEX_MISSION.md` — preserve/audit/connect the existing Sonor; **do not rebuild it**.
9. `docs/ARCHITECTURE.md` and `SECURITY.md` — runtime/security boundaries.

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
- Current next implementation phase: **Phase 15 — Security/failure hardening**.
- Automation target-PC validation is still required and must not be claimed complete until actually run.
- Background Automation stays OFF by default.
- Unattended Automation stays Level 0/1 only.
- Level 2/3 stay exact-occurrence approval gated.
- Level 4 stays unavailable.

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

When target-PC access is unavailable, the first repository task is:

**Phase 15A — Project path / filesystem hardening.**

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
2. read `docs/CODEX_PROGRESS_TRACKER.md`;
3. read the latest section of `docs/CODEX_HANDOFF.md`;
4. read `docs/CODEX_NEXT_MISSION.md`;
5. identify the first task that is not PASS/complete and is implementable in the current environment;
6. if an earlier task is blocked only by target-PC access, login, Sonor access, camera/mic or another external-only action, record the blocker and continue the next independent repository task;
7. create a focused feature branch;
8. implement the task completely enough to satisfy its exit gate;
9. add/update regression tests;
10. run build, tests, typecheck, lint and audit;
11. open a PR;
12. merge only after green CI;
13. update `CODEX_HANDOFF.md`, `CODEX_PROGRESS_TRACKER.md` and any relevant validation document;
14. continue automatically to the next implementable unfinished task.

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
- update the relevant build/context docs.

## Local commands

Development:

```powershell
cd C:\WINDOWS\system32\ASTRA-AI-Agent
git checkout main
git pull origin main
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
