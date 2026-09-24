# CODEX REFINEMENT CONTRACT


## Mandatory shared-memory collaboration rule — 2026-09-24

Codex and ChatGPT are one continuous ASTRA project team. Read `docs/ASTRA_COLLABORATION_PROTOCOL.md` before implementation.

Codex must consume ChatGPT's latest merged pointer/tracker/worklog/handoff before changing the same subsystem, and must write its own runtime/provider/target-PC changes back to those same durable documents so the next ChatGPT session can continue without guessing. A new session or missing chat context never authorizes rebuilding completed, active, blocked, or repo-complete/target-pending work.

Status date: **2026-09-22**

This document defines the division of work between ChatGPT repository work and Codex execution work for ASTRA.

## Refinement means finish, not replace

When ChatGPT has already produced an ASTRA implementation, Codex's default job is to inspect it, preserve the valid parts, reproduce any remaining defect on the real target, and **finish or correct that implementation**.

Codex must not create a parallel/replacement subsystem simply because ChatGPT's first version is incomplete. Replace architecture only when current evidence proves the existing design cannot satisfy the requirement or the owner explicitly changes direction.

If ChatGPT could not complete a target-only step, treat the repository state as `REPO_DONE_TARGET_PENDING` or `BLOCKED`, perform the missing real-environment work, then write the result back into the pointer/tracker/worklog/handoff for the next ChatGPT session.

## Core rule

**ChatGPT pre-builds as much safe repository work as possible to conserve Codex tokens. Codex then refines, completes, integrates, validates, and ships that work.**

Codex must treat merged ChatGPT work as the starting implementation, not as disposable scaffolding.

## ChatGPT role

ChatGPT should consume repository-side work that can be completed without the real target environment, including:

- architecture/contracts;
- provider-neutral adapters;
- schemas and persistence;
- permission/trust boundaries;
- API/UI wiring that can be verified in CI;
- regression tests;
- security/failure hardening;
- documentation;
- recovery pointers and handoffs;
- branch/history reconciliation;
- dry-run/planning logic;
- mocks/fixtures only when clearly test-only and never reported as real integration;
- CI fixes and repository cleanup.

The purpose is to reduce the amount of reasoning/coding Codex must spend on work that does not require the target PC or real provider.

## Codex role

Codex owns **refinement and completion**.

For every merged ChatGPT slice, Codex should:

1. read the existing implementation first;
2. preserve working contracts and tests;
3. inspect the real target PC/provider/runtime;
4. replace assumptions with real environment facts;
5. connect the existing abstractions to supported real mechanisms;
6. fix incompatibilities and concrete defects found during execution;
7. improve implementation quality where the target environment exposes weaknesses;
8. run real integration tests;
9. run failure/cancellation/STOP/permission cases;
10. collect truthful evidence tied to the exact build;
11. polish UX/runtime behavior;
12. complete packaging/startup/update/reinstall where relevant;
13. update tracker/handoff/worklog;
14. continue until the feature is genuinely ready-to-use or blocked by a real external boundary.

Codex must **not** restart the feature from zero merely because ChatGPT built the first version.

## Refinement, not duplication

Codex should not:

- recreate an already-merged subsystem under a second architecture;
- create a second NVIDIA roadmap;
- rebuild Sonor instead of inspecting the real existing Sonor;
- replace Phase 24/25/28/22/27/29 foundations without a concrete defect;
- discard tests just to make target integration easier;
- bypass ASTRA Tool Runtime, permission ceilings, scoped approvals, STOP, privacy, or evidence rules;
- mark repository contracts as real provider/hardware readiness;
- fabricate benchmark, microphone, camera, Windows, provider, device, or login evidence.

When an existing design is wrong for the real environment, Codex should make the **smallest evidence-driven correction** and preserve compatible work.

## Token-efficiency rule

Codex tokens should be spent primarily on work ChatGPT cannot reliably finish from repository access alone:

- target-PC inspection and execution;
- real provider/API/tool version discovery;
- local credential/configuration wiring;
- Windows/service/startup behavior;
- real Sonor/Graphify/Obsidian inspection;
- microphone/audio transport;
- camera/screen/pixel transport;
- GPU/browser performance measurement;
- PC2/mobile authenticated transport;
- real NVIDIA service integration;
- real skill/device/provider installation;
- end-to-end debugging from actual logs;
- real evidence collection;
- final packaging and ready-to-use validation.

Before writing new repository architecture, Codex must check whether ChatGPT has already implemented a foundation it can refine.

## NVIDIA-specific refinement rule

The NVIDIA repository architecture is already merged.

Codex's NVIDIA work is to **complete the real integrations**, including as supported by the actual environment:

- Skill Hub installation/update/remove mechanism;
- AI-Q transport;
- NeMo Retriever/RAG under real Sonor;
- Document Intelligence/OCR backend;
- Nemotron Voice/Speech transport;
- DeepStream/VSS/vision pipeline with real pixels;
- NemoClaw/Hermes governed workflow integration;
- NeMo Guardrails/Content Safety deployment;
- evaluation suites against the exact runtime/build.

Do not invent endpoint schemas. Inspect the supported NVIDIA mechanism/version first, then adapt the existing contracts.

## JARVIS foundation refinement rule

Repository foundations are already merged for:

- Phase 24 Event Engine;
- Phase 25 Durable Background Tasks;
- Phase 28 Diagnostics/Audit/Offline;
- Phase 22 Identity/Trust/Secrets;
- Phase 27 Multi-device;
- Phase 29 Generic Skill/Environment.

Codex should connect these to real event sources, executors, OS identity/secrets, device transports, providers, services, UI/runtime surfaces, telemetry, and evidence.

Do not rebuild the foundations merely because their real adapters are still pending.

## Current real-execution priority

Unless a concrete defect or dependency changes the order:

`Phase 14 → MEM-X → Phase 16 → Phase 17 → Phase 19 → Phase 20`

Then continue real JARVIS/NVIDIA/provider/device integrations and Phase 30.

## Zero-touch delivery rule

The owner expects the finished system, not repeated setup instructions.

Codex should perform all technically executable work itself and ask for owner involvement only at genuine external boundaries such as:

- MFA/login/CAPTCHA;
- UAC/security consent;
- physical microphone/camera observation or permission;
- unavailable private credential;
- high-impact approval requiring the owner.

After that boundary is satisfied, Codex resumes automatically.

## Completion standard

A feature is not complete merely because ChatGPT wrote code or Codex made it run once.

Completion means, where applicable:

`existing foundation → real integration → happy path → failure handling → cancellation/STOP → permission/privacy validation → regression tests → evidence → UX/polish → ready-to-use delivery`

That is Codex's refinement responsibility.
