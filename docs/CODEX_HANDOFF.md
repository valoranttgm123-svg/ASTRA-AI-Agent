# ASTRA Codex Handoff

## 2026-09-20 — scoped registered project context checkpoint

Phase 3 project context now has a real read-only loading path:
- `lib/projects/context.ts` reads only paths explicitly listed in a resolved project's `docs` / `importantFiles`;
- every target must remain inside the registered `workspace` after both lexical resolution and `realpath` resolution;
- there is no recursive directory scan;
- `.env`, credentials/secrets, SSH/GPG paths, certificate/private-key formats and unsupported/binary extensions are rejected;
- per-file size and file-count limits are configurable;
- accepted files enter the existing Memory Manager with provenance source type `project`;
- Brain unified memory can combine local memory + registered project files + Sonor without special-case prompt concatenation.

This does **not** grant arbitrary filesystem access. Project identification alone still cannot read files that are not explicitly registered.

## 2026-09-20 — real Memory lifecycle telemetry checkpoint

This branch adds real retrieval telemetry emitted by the Memory Manager itself:
- `memory.search.started`
- `memory.source.queried`
- `memory.graph.matched`
- `memory.context.selected`
- `memory.search.completed`

The events are generated from actual source queries/selections, streamed through Brain SSE during retrieval, and retained in the final Brain trace. Do not replace them with UI-only animation.

## 2026-09-20 — Sonor workflow graph bridge checkpoint

The user already has a Codex-built Sonor workflow/project graph running locally at `http://127.0.0.1:55127/#graph`.

Do not rebuild Graphify or Obsidian inside ASTRA. Sonor is the existing aggregation layer for Graphify relations, Obsidian-linked notes, projects/files, and Codex + ChatGPT context.

Implemented on the ASTRA side:
- `lib/memory/sonor.ts` — strict loopback-only Sonor `AstraMemorySource`;
- `lib/brain/unified-memory.ts` — local memory + Sonor through the existing Memory Manager;
- Brain context now consumes unified memory;
- `.env.example` includes disabled-by-default Sonor settings;
- `docs/SONOR_BRIDGE.md` defines the ASTRA-compatible provenance contract;
- tests cover loopback safety, response validation, manager integration, and Brain context consuming Sonor/Graphify records.

Important limitation: the actual Sonor source/API is local to the user's PC and is not present in the connected GitHub repositories. The real endpoint path/schema still needs inspection on that PC. Do not claim the user's Sonor runtime is connected until that production-PC check succeeds.

Next local task when Codex access is available:
1. inspect Sonor source/network layer at port 55127;
2. locate an existing server-side graph/search API, or add a small read-only ASTRA compatibility endpoint;
3. configure `ASTRA_SONOR_SEARCH_PATH`;
4. run ASTRA + Sonor end-to-end using a real ALURKA/ASTRA project query;
5. verify provenance, project isolation, cancellation, bounds, and real memory lifecycle events.

## 2026-09-20 — pre-Codex-limit ASTRA MAX foundation checkpoint

Stable `main` now includes the implementation checkpoints below. Do not rebuild them.

Merged checkpoints:
- PR #57 — Phase 0/1 baseline + canonical truthful 18-node capability registry.
- PR #58 — Phase 2 Memory Intelligence foundation: provenance/source contracts + bounded multi-source manager.
- PR #59 — Phase 3 Project Registry foundation: explicit local registry + project resolution + `project.selected` Brain context/event.
- PR #60 — Phase 4 Planner safety foundation: bounded steps/retries/timeouts/dependencies/permission contracts; **no autonomous execution**.
- PR #61 — Phase 6 Tool Registry metadata foundation: provider-neutral, permission-aware, **non-executing** tool definitions.

Current stable main before this documentation checkpoint:
`968ecebae6166bcfbae1fa5f7e9e0f0e337b0ea6`

What is genuinely working now:
- 18 Command Center nodes have one canonical capability registry and truthful default states;
- unimplemented integrations show `NOT_CONFIGURED` instead of fake ONLINE;
- local memory retrieval preserves provenance/project/privacy/relevance/confidence;
- multi-source memory manager can rank, dedupe, isolate projects, bound context, survive failed sources and cancel;
- explicitly registered projects can be resolved by id/name/alias/recent activity without scanning arbitrary folders;
- Brain envelope can report selected project and memory source types;
- planner data is safety-bounded before future execution;
- tool metadata cannot claim unsafe permission levels or READY status without a provider.

Not live yet — do not claim otherwise:
- Graphify/Obsidian/Sonor adapters;
- scoped loading of project docs/workspaces into Brain context;
- model-generated Strategist plans;
- multi-step plan executor;
- real multi-agent orchestration beyond current routing;
- executable Tool Registry handlers;
- MCP;
- real browser/research tools;
- Gmail/Calendar/Drive/CRM connectors;
- Windows Computer Agent;
- autonomous/background execution.

Next Codex work, in order:
1. Finish Phase 2 live memory-source adapters for Graphify + Obsidian (Sonor optional) using `AstraMemorySource`; preserve local/read-only defaults and provenance.
2. Emit real `memory.search.started/source.queried/context.selected/search.completed` events around actual retrieval.
3. Finish Phase 3 by loading only scoped registered project context through approved Files/Drive paths; project identification alone is not file access.
4. Implement Phase 4 real Strategist/Planner generation through a permitted provider, normalized by `createBoundedPlan`.
5. Implement Phase 5 Chief orchestration using real plan steps and truthful agent lifecycle.
6. Connect Phase 6 tool handlers/MCP behind the existing registry, permission levels, approval UI, cancellation and verification.
7. Continue the remaining ASTRA MAX and JARVIS-Class roadmap in `docs/ASTRA_MAX.md`.

Every merged foundation above passed production build, unit/integration tests, typecheck, lint and dependency audit in ASTRA CI.

## 2026-09-20 — ASTRA MAX Phase 2 memory foundation checkpoint

The provider-neutral Memory Intelligence foundation is implemented and validated on `astra/astra-max-memory-foundation`.

Completed:
- provenance/source contracts in `lib/memory/contracts.ts`;
- local-memory retrieval now returns provenance, project, privacy, relevance and confidence while keeping the old bounded text/entry interface compatible;
- Brain envelope reports retrieved memory source types;
- `lib/memory/manager.ts` provides bounded multi-source ranking, dedupe, project isolation, cancellation and graceful source-failure handling;
- event type contracts exist for future real memory lifecycle telemetry;
- automated tests cover local provenance, Brain source reporting, multi-source isolation, dedupe and cancellation.

Important limitation: Graphify, Obsidian and Sonor are **not connected yet**. Do not report them as live. They should plug into the new `AstraMemorySource` contract later.

Next safe foundation work: **Phase 3 Project Registry**. It must read only explicitly registered project metadata and must not scan arbitrary user directories.

## 2026-09-20 — ASTRA MAX Phase 0–1 implementation checkpoint

Phase 0 and Phase 1 are implemented on `astra/astra-max-production` and validated by CI.

Completed:
- baseline locked from stable `main` `15ed870f...` with recoverable pre-MAX backup;
- canonical 18-node capability registry added at `lib/agent/capabilities.ts`;
- Brain visual-node routing now uses the canonical registry;
- Command Center roster and overview use the same registry;
- unimplemented/unconfigured skills/integrations show `NOT_CONFIGURED` instead of misleading ONLINE status;
- registry invariants are covered by automated tests;
- build, tests, typecheck, lint and dependency audit passed.

Next automatic task: **Phase 2 — Memory Intelligence foundation**. Add provider-neutral provenance/source contracts while preserving bounded local-memory retrieval. Live Graphify/Obsidian integration should follow those contracts and must remain local/read-only by default until explicitly configured.

## 2026-09-20 — JARVIS-Class continuation approved

The ASTRA MAX mission now continues beyond the core release through **Phase 21–30 JARVIS-Class Expansion** in `docs/ASTRA_MAX.md`.

Phase 20 is a core release gate, not the final stop. After it is stable, Codex should continue automatically through always-on voice, identity/trust/secrets, screen/vision context, proactive event engine, durable background tasks, episodic memory/context fusion, secure multi-device presence, self-diagnostics/recovery/offline mode, skill/IoT expansion, and final JARVIS-Class integration/reliability validation.

Do not interpret “JARVIS-Class” as permission for hidden surveillance, unrestricted autonomy, or fictional/impossible capability claims. All existing ASTRA permission, privacy, truthful telemetry, verification, loopback/local-first and emergency-stop rules remain in force.

Ultimate roadmap stop condition: Phase 30 and its verified final status.

## 2026-09-20 — ASTRA MAX continuation approved

The approved continuation mission is now `docs/ASTRA_MAX.md`.

Codex must treat that document as the production roadmap from the current stable Brain V1 / V15 / V13 state through the final ready-to-use release. Do not rebuild completed foundations. Continue the phases sequentially, commit recoverable checkpoints, validate each milestone, and keep this handoff plus `docs/ASTRA_ROADMAP.md` and `docs/ARCHITECTURE.md` updated.

Key product decision:
- all 18 ReasoningWeb nodes must become truthful real capabilities, skills, tools/integrations, or explicit unavailable/not-configured states;
- no fake ONLINE agents, fake tool work, fake telemetry, or fake success;
- Graphify + Obsidian/Sonor memory intelligence is included in the roadmap, followed by Project Registry, Planner/Orchestrator, Tool Registry/MCP, Files/GitHub, business specialists, communication integrations, Design/Social, Computer Agent, multimodal/voice, Command Center MAX, automation, hardening, release candidate, Windows ready-to-use, and final release;
- Codex should continue automatically milestone-to-milestone and stop only when a genuine external action (OAuth/login/device permission/high-impact approval) requires the user.

Current stable baseline before ASTRA MAX implementation: `main` at or newer than `9aaa2b2`.

For the complete mission, read `docs/ASTRA_MAX.md` before implementation.

## 2026-09-19 — Brain V1 local release verification

- B1–B8 implementation is complete in `astra/brain-v1-complete`.
- Production UI was verified at `http://127.0.0.1:3017` with zero browser console errors.
- Ollama `0.34.2` + `qwen3.5:4b` completed a short local chat. Extended thinking is disabled by default for responsive chat. Ollama tool execution remains intentionally unavailable until trustworthy provider telemetry exists.
- Codex CLI `0.155.0`, using the existing ChatGPT login, completed both a read-only project query and a per-request approved write with exact content verification. This PC's managed requirements reject `workspace-write`, so local execution uses the explicit danger-mode opt-in while external actions/cloud remain disabled.
- Hidden logon tasks `ASTRA-Agent` and `ASTRA-Ollama` plus an `ASTRA` desktop shortcut were installed and verified. Both services remain loopback-only.
- Sonor/Graphify/Obsidian integration is intentionally the next stage. Hermes remains disabled. Physical microphone input was not verified by browser automation.

This file is the short operational context for Codex. For the full history, read `docs/ASTRA_CONVERSATION_HISTORY.md`.

Last updated: 2026-09-19

## Current project state

Brain V1 foundation B1–B8 is implemented on feature branch `astra/brain-v1-complete`:
- cancellable streaming API and real event bus;
- Hermes guarded by gateway review and one-use approval;
- explicit Ollama/Codex selection with exact Ollama model enforcement;
- Codex CLI engineering adapter, disabled until an allowed CLI/login is verified;
- bounded project memory and explicit save;
- Codex/Hermes execution delegation and permission gates;
- real Command Center status/timeline;
- shared Humanoid/Brain lifecycle;
- 12 security/integration tests plus build/typecheck/lint/audit CI.

Runtime facts must remain distinct from code readiness. On 2026-09-19, the Codex desktop binary could not be launched directly from WindowsApps. An isolated official Codex CLI 0.155.0 was then installed under `D:\ASTRA-Tools`; its existing ChatGPT login and one read-only ASTRA task were verified. This machine-level path is intentionally not committed. Sonor memory integration is the next stage after this branch is stable.

Repository:
- `valoranttgm123-svg/ASTRA-AI-Agent`

Current stable architecture:
- ASTRA Humanoid V13
- gesture control: PINCH / OPEN PALM / FIST
- loud synthesized shockwave SFX + presence layer
- GPU particle renderer
- image-driven approved artwork
- real mic/speech state wiring
- camera index-finger head tracking
- runtime `stopInteraction()` for real cancellation
- ASTRA Brain Adapter + real event trace
- Hermes primary local gateway + Ollama fallback
- local durable Memory/Skills
- Codex CLI engineering specialist
- central tool/side-effect permission policy
- optional paid cloud guard, OFF by default
- Command Center provider/feature telemetry

V13:
- PR #41 merged to `main`
- backup: `backup/humanoid-v12.1.3-before-v13-gesture-control`

## V13 implementation summary

Existing MediaPipe worker:
- `components/lab/handTracker.worker.ts`
- model: existing MediaPipe Hand Landmarker
- no new model added.

Gesture detection:
- PINCH;
- OPEN PALM;
- FIST.

Stabilization:
- three stable inference frames for gesture;
- two neutral frames to release;
- ~900 ms cooldown;
- same HIGH/LOW worker cadence as index tracking.

Gesture actions:
- PINCH → replay assembly;
- OPEN PALM → begin listening/mic;
- FIST → `runtime.stopInteraction()`.

Runtime stop action:
- abort in-flight request;
- stop/abort recognition;
- cancel speechSynthesis;
- clear agent;
- set runtime/avatar to IDLE.

UI:
- GESTURES ON/OFF;
- stable gesture indicator;
- last action;
- pinch ratio;
- extended finger count;
- existing camera head tracking remains available.

## Humanoid current architecture

Important files:
- `components/lab/HumanoidLabV9.tsx`
- `components/lab/AstraGpuParticles.tsx`
- `components/lab/useFingerTracking.ts`
- `components/lab/handTracker.worker.ts`
- `components/AstraRuntime.tsx`

Approved art:
- `public/assets/astra-humanoid/astra-idle-v1.webp`

Renderer:
- React Three Fiber / Three.js;
- two active particle draw passes;
- custom GPU vertex/fragment shader;
- HIGH DPR 1.5;
- MSAA OFF;
- sRGB;
- NoToneMapping.

GPU shader currently handles:
- head yaw/pitch;
- chest/breathing;
- assembly;
- state energy;
- voice energy;
- luminance lift;
- round point shaping;
- final shockwave.

## Current SFX

Shockwave SFX is synthesized with Web Audio API.

Layers:
- low core pulse;
- electric rise;
- filtered noise;
- low impact;
- mid-frequency presence layer.

V12.1.3 added:
- stronger pre-limiter gain;
- DynamicsCompressor limiter;
- post-limiter output gain;
- TEST SFX button.

If TEST SFX is silent, check browser/Windows output routing before increasing gain again.

## Approved Brain direction

See `docs/ASTRA_BRAIN_V1.md`.

Target:

```text
Humanoid / Chat / Mic / Gesture
        ↓
ASTRA Runtime / Event Bus
        ↓
ASTRA Brain Adapter
        ↓
Hermes Agent
   ├─ Ollama local
   ├─ Codex engineering
   ├─ Memory
   ├─ Skills
   └─ Tools / MCP
        ↓
Command Center real-time events
```

Paid cloud:
- optional;
- OFF by default;
- requires both `ASTRA_CLOUD_ENABLED=true` and `ASTRA_ALLOW_PAID_CLOUD=true`;
- never silently used.

Brain provider order:
- engineering/GitHub: Codex → Hermes → Ollama → explicit cloud → routing-only;
- other routes: Hermes → Ollama → explicit cloud → routing-only.

Private memory:
- default file `.astra/memory.json`;
- gitignored;
- not sent to Codex/cloud unless explicitly enabled.

## Command Center rule

The existing graph/dashboard should become a real ASTRA Command Center.

Do not animate fake work.

It should react to real events such as:
- `agent.started`;
- `agent.completed`;
- `tool.started`;
- `tool.completed`;
- `task.progress`;
- `brain.response.ready`;
- errors/cancellations.

Humanoid should consume high-level state.
Command Center should consume detailed Brain/runtime activity.

## Performance history / constraints

The user repeatedly reported lag and dark/unclear particles.

Major fixes already done:
- CPU per-particle motion moved to GPU;
- subset buffer sync removed;
- two draw passes only;
- MSAA removed;
- fullscreen CSS blur/backdrop-filter removed;
- software renderer diagnostics added;
- particle clarity and luminance remapped in shader.

Do not casually reintroduce:
- per-frame full particle CPU loops;
- many synchronized geometries;
- fullscreen blur over animated Canvas;
- extra particle renderers;
- high additive overdraw.

Optimize architecture before lowering HIGH quality.

## User-approved development rules

- preserve approved artwork;
- no replacement/generated humanoid art unless explicitly asked;
- use recoverable backup branches;
- CI must pass before merge;
- keep GitHub docs updated for future Codex sessions;
- no secrets committed;
- prefer local/free components before paid cloud;
- direct implementation is preferred over lengthy speculation.

## Next work after Brain V1

Brain V1 architecture is implemented. Do not rebuild these layers from scratch.

Next work:
1. validate/tune V13 gesture thresholds on the target camera only if real camera tests need it;
2. configure local `.astra/memory.json` / `.astra/skills.json` when private context is desired;
3. verify Codex CLI availability/auth on the target Windows machine;
4. configure Hermes-side MCP/tool permissions to match ASTRA's policy flags;
5. add provider-native `tool.started/tool.completed` telemetry only when Hermes/Codex exposes trustworthy events;
6. add explicit UI approval flows before enabling destructive side effects;
7. keep paid cloud OFF unless the user deliberately opts in;
8. continue performance/UX work without degrading HIGH Humanoid quality.

## Local validation

Development:

```powershell
cd C:\WINDOWS\system32\ASTRA-AI-Agent
git checkout main
git pull origin main
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

Production:

```powershell
npm run build
npm run start
```
