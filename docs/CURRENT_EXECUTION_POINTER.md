# ASTRA CURRENT EXECUTION POINTER

Status date: **2026-09-22**

This is the shortest authoritative handoff for a new ChatGPT/Codex session.

If older documentation, a historical branch, or chat history conflicts with this file, first verify current `main`, newest CI, and open PRs. Then use this pointer.

## ChatGPT → Codex work contract

Canonical rule: `docs/CODEX_REFINEMENT_CONTRACT.md`.

**ChatGPT pre-builds everything safely possible in the repository to save Codex tokens. Codex refines, integrates, validates, fixes, polishes, and completes that existing work against the real target environment.**

Do not restart merged foundations from zero.

## Current repository truth

Canonical `main` after cross-session reconciliation:

- Phase 14 Automation implementation: merged; real target-PC approval/STOP validation still required.
- Phase 15 security/failure hardening: merged and CI-verified.
- Phase 16 repository measurement tooling:
  - runtime harness merged;
  - Humanoid/browser HIGH capture merged;
  - Command Center / Automation-panel main-UI evidence tooling recovered and merged in PR #171.
- Phase 17 safe preflight tooling: merged; real scenarios still required.
- Phase 18–20 release/evidence tooling: merged; final release verdict still requires real evidence.
- Phase 19 Windows install/update/reinstall/readiness tooling: merged; target-PC proof still required.
- NVIDIA JARVIS Model Mesh and NVIDIA MAX provider-neutral repository contracts: merged.
- JARVIS repository foundations Phase **24 → 25 → 28 → 22 → 27 → 29**: merged and must not be recreated.

Latest reconciliation implementation:

- PR #171;
- merge commit: `cc8432edcf9e854bba9d0d78c14c7731fd279dbd`;
- PR CI #466: **SUCCESS**;
- post-merge `main` CI #467: **SUCCESS**.

The 2026-09-22 reconciliation audited all **206** branches. Historical divergent branches are classified in:

`docs/CROSS_SESSION_RECONCILIATION_2026-09-22.md`

Do not repeat that branch-history audit unless a new concrete capability mismatch is demonstrated.

## What the earlier Phase 21–30 plan became

Repository foundations from the interrupted sessions are accounted for:

| Phase | Repository status | Real-world status |
| --- | --- | --- |
| 24 Event Engine | **MERGED** — PR #164 | real event adapters/evidence still required |
| 25 Durable Background Tasks | **MERGED** — PR #165 | real executors/restart/long-running evidence still required |
| 28 Diagnostics / Audit / Offline | **MERGED** — PR #166 | real health/recovery/offline evidence still required |
| 22 Identity / Trust / Secrets | **MERGED** — PR #167 | real OS identity/credential integration still required |
| 27 Multi-device | **MERGED** — PR #168 | real authenticated transport/device pairing still required |
| 29 Generic Skill / Environment | **MERGED** — PR #169 | real provider-backed skill/device evidence still required |

Intentionally deferred because real environment/input is required:

- Phase 21 real always-on voice transport;
- Phase 23 real screen/camera pixel transport;
- Phase 26 real Sonor-backed episodic/context fusion;
- Phase 30 final JARVIS scenarios, soak and evidence.

Repository contracts are not proof that those systems are operational.

## Immediate execution order

When target-PC/local access is available, continue in this order:

1. **Phase 14** — real Automation approval behavior + STOP.
2. **MEM-X** — inspect/preserve/connect the real Sonor + Graphify + Obsidian system.
3. **Phase 16** — collect real runtime, Humanoid HIGH, Command Center and Automation-panel measurements.
4. **Phase 17** — run real full-system scenarios including approved actions and Emergency STOP.
5. **Phase 19** — verify Windows install/startup/update/reinstall on the real target PC.
6. **Phase 20** — generate the evidence-backed core release report.
7. Continue real provider/device integrations for Phase 21/23/26/27/29 as environment access allows.
8. Execute **Phase 30** final JARVIS scenarios/soak/evaluation.

Do **not** call ASTRA READY before the relevant real evidence exists.

## If target PC / external provider is unavailable

Do not create placeholder integrations merely to look busy.

Allowed repository work is limited to:

- a newly demonstrated defect;
- regression coverage for a concrete failure;
- documentation synchronization;
- a provider change backed by real current documentation/evidence;
- an explicit new owner requirement.

Otherwise preserve the checkpoint.

## Phase 16 main-UI evidence recovery

The old branch `astra/main-ui-performance-evidence` contained an incomplete prototype that never reached `main`.

PR #171 rebuilt the useful capability correctly on current architecture:

- opt-in probe via `?perf=1`;
- main idle evidence;
- Command Center active evidence;
- Automation panel open evidence;
- live telemetry sampling rather than stale React closure state;
- clean running-build verification at start and completion;
- private `.astra/performance/` output;
- no prompt, response, mic transcript, approval token or console-message content persisted;
- `releaseVerdict = NOT_EVALUATED`;
- regression tests.

Real target-browser capture is still pending.

Do not merge or resume the abandoned prototype branch.

## Historical branch rule

A branch is actionable only when at least one is true:

- it has a current open PR;
- this pointer names it as active;
- a fresh comparison proves a concrete capability is missing from `main`;
- the owner explicitly requests revival.

A branch being `ahead` or `diverged` is not enough.

Historical examples that must not be revived automatically include:

- early Humanoid/reference/live branches;
- `astra/core-v1`;
- `astra/astra-max-production`;
- `astra/phase14-safe-automation`;
- `astra/phase18a-repository-rc-gate`;
- `astra/v15-brain-streaming-telemetry`;
- `feature/phase28-diagnostics-audit`;
- `feature/phase29-extension-environment-registry`;
- `windows/private-evidence-reparse-hardening`;
- stale handoff/document branches.

See the reconciliation document for rationale.

## NVIDIA direction

Do not create a second NVIDIA architecture.

Use the merged JARVIS Model Mesh and contracts already in the repository. Real integration must validate actual supported mechanisms/backends before adding transport code.

For every real backend:

`health → happy path → cancellation → malformed response → outage/degradation → STOP/permission behavior → evidence`

NVIDIA reasoning/integration never bypasses ASTRA Tool Runtime or approval boundaries.

## Owner delivery contract

The owner wants ready-to-use delivery.

Codex/ChatGPT should perform every technically executable repository/local task itself where available. Human input is reserved for genuine external boundaries such as:

- login/MFA/CAPTCHA;
- UAC/security consent;
- physical microphone/camera observation;
- unavailable secret;
- genuinely high-impact approval.

Do not turn executable work into setup instructions for the owner.

## New-session recovery order

On any new/interrupted session:

1. inspect current `main`;
2. inspect newest CI;
3. inspect open PRs;
4. read this file;
5. read `docs/CROSS_SESSION_RECONCILIATION_2026-09-22.md`;
6. read `docs/JARVIS_PROGRESS_TRACKER.md`;
7. read `docs/SESSION_RECOVERY.md`;
8. read the latest tail of `docs/ASTRA_WORKLOG.md`;
9. read `docs/CODEX_HANDOFF.md`;
10. read `docs/CODEX_NEXT_MISSION.md`;
11. read the validation document for the actual active phase.

If the owner says only:

`lanjutkan yang belum selesai`

that is sufficient. Resume from repository truth. Do not ask the owner to reconstruct old chat history.

## Current next task

There is no remaining speculative repository-foundation slice authorized by the earlier Phase 24/25/28/22/27/29 sequence.

The next useful work is real execution/evidence:

`Phase 14 → MEM-X → Phase 16 → Phase 17 → Phase 19 → Phase 20`

Then continue real provider/device integrations and Phase 30.

Only deviate when a concrete new defect or explicit owner requirement makes another task genuinely actionable.


## Active repo-side refinement — PR #174

Concrete non-provider work found after the foundation audit:

- Phase 25 UI/runtime durable-task presence;
- Phase 28 user-facing diagnostics + action-history panel.

Active PR:
- #174 — `feature/operations-task-diagnostics-ui`.

Scope is deliberately bounded:
- reuse existing `/api/tasks` and `/api/diagnostics`;
- expose task lifecycle state/controls, not production executors;
- diagnostics remains read-only;
- connectivity remains UNKNOWN until a real probe exists;
- no recovery execution, provider health fabrication, or target-PC evidence claims.

If PR #174 is open in a new session, inspect its newest CI and resume/fix it before starting another repo-side refinement.
