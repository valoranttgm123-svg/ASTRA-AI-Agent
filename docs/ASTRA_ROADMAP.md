# ASTRA Roadmap

> Living roadmap for ASTRA AI Agent.
>
> This document records the agreed implementation sequence so project direction is not dependent on chat history.

## Product vision

ASTRA is designed as one connected AI operating system:

```
USER
  ↓ voice / text / gesture
HUMANOID
  ↓
ASTRA RUNTIME / EVENT BUS
  ↓
ASTRA BRAIN
  ↔ COMMAND CENTER
  ↓
TOOLS / MEMORY / MODELS
  ↓
RESULT
  ↓
HUMANOID / COMMAND CENTER
```

The four major parts have distinct roles:

- **Humanoid** = ASTRA's face, presence, animation, voice and interaction layer.
- **ASTRA Runtime** = shared state/event layer connecting UI, Brain and tools.
- **ASTRA Brain** = reasoning/orchestration/action layer.
- **Command Center** = live visualization of actual Brain/agent/tool activity.

The Command Center must visualize real runtime events. It must not show fake agent activity.

---

## Completed stages

### V9 — Image-driven humanoid
- Approved artwork is the single visual source.
- Particle reconstruction replaces procedural character generation.
- The surrounding approved artwork remains part of the visual identity.

### V9.2 — Safe point renderer
- Fixed oversized point/overdraw regression.
- Normal base blend + controlled additive glow.

### V10 — ASTRA MAX
- Adaptive quality.
- Cyan edge energy.
- Warm/core subset.
- Layered particle renderer.

### V10.1 — Index-finger head tracking
- MediaPipe Hand Landmarker worker.
- Camera runs independently from ASTRA chat/mic.
- Finger position controls humanoid head orientation.

### V11 — Dynamic state engine
Runtime visual states:
- IDLE
- LISTENING
- THINKING
- SPEAKING

### V11.1 — Real mic + state wiring
- Browser Speech Recognition input.
- Text/mic requests use the same ASTRA runtime.
- Speech playback drives real SPEAKING state.
- Playback gate is event-driven; it is not fake audio loudness.

### V11.2 — Voice-reactive face
- Face/core particles react only while real speech playback is active.

### V11.2.1 — Voice saturation hotfix
- Prevents large yellow/orange blocks during SPEAKING.

### V12 — Assembly sequence
- Head → neck → shoulders → core.
- Non-blocking assembly.
- Replay and Skip controls.
- Existing chat/mic/camera remain usable.

### V12.0.1 — Particle sharpness + motion polish
- Crisp round particle mask.
- Quintic smootherstep assembly easing.
- Deterministic particle paths.

### V12.0.2 — Visibility balance
- Improved particle readability at HIGH DPR.

### V12.0.3 — GPU particle performance
- Per-particle motion moved from CPU to GPU shaders.
- Active renderer reduced to two particle draw passes.
- CPU only updates small uniforms per frame.

### V12.0.4 — Compositor optimization + GPU diagnostics
- MSAA removed because particles are shader-smoothed.
- Removed expensive fullscreen CSS blur/backdrop compositing.
- Added WebGL GPU/vendor/software-renderer diagnostics.

### V12.0.5 — Particle clarity boost
- Brighter crisp core.
- Thin soft rim.
- Tighter glow.

### V12.0.6 — Particle luminance lift
- Gamma/midtone lift.
- Dark-particle floor.
- Controlled highlight normalization.

### V12.1 — Final GPU shockwave
- Warm core lock.
- Cyan/orange radial shockwave.
- GPU-only.
- No extra mesh or render pass.

### V12.1.1 — Shockwave SFX
- Synthesized Web Audio sound.
- Independent SFX ON/OFF.
- No external audio file.

### V12.1.2 — SFX boost
- Stronger master/layers.
- DynamicsCompressor limiter.

### V12.1.3 — Loud SFX + presence layer
- Post-limiter output gain.
- Mid-frequency presence for laptop/monitor speakers.
- TEST SFX button.

---

## Current stage

### V13 — Gesture Control — COMPLETE

Goal: upgrade the existing MediaPipe camera pipeline from pointer tracking into deliberate gesture control.

Gesture mapping:

```
PINCH      → Replay assembly
OPEN PALM  → Begin listening / MIC
FIST       → Stop current ASTRA interaction
```

Requirements:
- use the same existing Hand Landmarker model;
- no second camera pipeline;
- no cloud gesture service;
- gesture must be stable for multiple inference frames;
- gesture must return to neutral before retrigger;
- cooldown prevents accidental repeated actions;
- GESTURES ON/OFF must not disable ordinary head tracking.

V13 preserves:
- V12.1 GPU shockwave;
- V12.1.3 loud SFX;
- mic / voice;
- camera tracking;
- HIGH GPU particle rendering.

---

## Brain V1 completion — implemented 2026-09-19

The repository now implements the complete B1–B8 foundation. Runtime provider availability is reported honestly: a configured local Ollama, reviewed Hermes gateway, or authenticated Codex CLI is still required for model inference.

Completed in this stage:
- cancellable SSE lifecycle stream with live provider telemetry;
- explicit `AUTO`, `OLLAMA`, and `CHATGPT / CODEX` provider controls;
- bounded opt-in local memory and route-specific skills;
- server-side permission policy plus per-request execution approval;
- Codex engineering adapter using `codex exec --json`, an existing ChatGPT login, and read-only default;
- Command Center node states and timelines derived from real events;
- Humanoid `LISTENING → THINKING → SPEAKING → IDLE` lifecycle tied to the same runtime;
- loopback/origin/content-type/body limits, cancellation propagation, local-provider URL guards, and child-process cleanup;
- automated tests, typecheck, lint, dependency audit and production build in CI.

Deferred by product decision:
- Sonor Workflow/Graphify/Obsidian memory bridge. It will be connected after this ASTRA foundation is stable, without replacing local safety boundaries;
- paid cloud providers. They remain out of V1 and OFF by default.

Verified local deployment on 2026-09-19:
- Ollama `0.34.2` and `qwen3.5:4b` are installed; model storage is on `D:\AI-Models\Ollama`;
- short local chat completed through the production browser UI; Ollama tool execution remains intentionally unavailable;
- Codex CLI `0.155.0` completed a read-only project query and a per-request approved file write whose exact content was verified; the temporary proof file was removed afterward;
- hidden user-logon tasks `ASTRA-Agent` and `ASTRA-Ollama` start the loopback services, and the desktop shortcut opens `http://127.0.0.1:3017`;
- browser console validation has zero errors. The remaining Three.js deprecation warning is upstream/non-blocking;
- physical microphone capture was not automated and remains a device/browser-permission check, not a claimed release proof.

---

## Implemented major stage

# ASTRA Brain V1

Architecture decision:

```
ASTRA UI / HUMANOID / VOICE
          ↓
ASTRA BRAIN ADAPTER
          ↓
HERMES AGENT
          ↓
┌─────────────────────────────┐
│ Ollama         local model  │
│ Codex          engineering  │
│ Memory         context      │
│ Tools / MCP    actions      │
│ Cloud AI       optional     │
└─────────────────────────────┘
```

Default strategy:
- **Hermes Agent** = orchestration framework.
- **Ollama** = free/local-first model provider.
- **Codex** = engineering/coding specialist.
- **Cloud providers** = optional, OFF by default.
- Brain integration happens through a stable adapter interface.

Target Brain interface:

```ts
interface AstraBrain {
  chat(input: string): Promise<BrainResponse>;
  execute(task: BrainTask): Promise<BrainResult>;
  cancel(id?: string): void;
  status(): BrainStatus;
}
```

Brain must emit real events such as:

```
brain.request.started
agent.started
tool.started
tool.completed
agent.completed
brain.response.ready
brain.completed
brain.error
```

These events drive both Humanoid state and Command Center visualization.

---

## Command Center integration

The existing radial agent UI will become a real Brain activity map.

Core roles:

- Chief of Staff → orchestration / task routing
- Researcher → web / references / documents
- Strategist → planning / prioritization
- Finance → financial data / budgeting / analysis
- Editor → writing / revision
- Memory → project/context retrieval
- Design → UI/UX / creative tasks
- Engineering → coding / debugging / repo work
- Social → social content
- Ops → automation / operational workflows
- Marketing → campaign / positioning
- Sales → sales / offers / leads

Tool/integration nodes may include:
- Drive
- Email
- CRM
- Analytics
- Developer
- GitHub
- Calendar
- other MCP/plugins

Node colors should represent actual status:

```
CYAN   = ready / active context
ORANGE = running
GREEN  = completed
RED    = error / attention required
GREY   = unavailable / disconnected
```

No node may appear active unless a real event supports that state.

---

## Planned Brain + Command Center sequence

### B1 — Brain adapter ✅
- define Brain interfaces and event types;
- keep existing UI working against adapter;
- no provider lock-in.

### B2 — Hermes orchestration ✅
- connect Hermes behind adapter;
- basic task routing;
- cancellation and error propagation.

### B3 — Ollama local provider ✅
- local/free default model;
- provider health/status;
- exact configured model plus explicit UI provider selection.

### B4 — Codex engineering specialist ✅ adapter and read-only live verification
- engineering routing;
- repo/code tasks;
- explicit specialist events.

### B5 — Memory layer ✅ local project memory; Sonor bridge deferred
- project memory;
- task context;
- retrieval events visible in Command Center.

### B6 — Tool/execution policy ✅ real Codex/Hermes delegation and approval gates
- real provider lifecycle events; tool events are shown only when a provider exposes trustworthy telemetry;
- server-side permissions, approval, cancellation, and failure handling.

### B7 — Command Center live event map ✅
- node state driven by Brain events;
- running pipeline;
- task detail panel;
- agent/tool timelines.

### B8 — Humanoid + Brain unified state ✅
- listening/thinking/speaking derived from runtime/Brain lifecycle;
- agent detail stays in Command Center;
- Humanoid remains the high-level presence layer.

---

## Quality rules

- HIGH quality must remain visually high quality.
- Optimize architecture before reducing visual fidelity.
- Prefer GPU computation over per-frame CPU particle buffer rewrites.
- Do not add duplicate renderers unless absolutely required.
- Keep one approved artwork source unless a new image is explicitly approved.
- Avoid fake waveform/loudness claims.
- Avoid fake agent/tool activity.
- Preserve SFX/voice/camera/mic independence.
- Every major visual/runtime stage should have a rollback branch before invasive changes.
- Production CI must pass before merging to `main`.

---

## Current implementation order

```
✅ V9       Image-driven humanoid
✅ V10      ASTRA MAX
✅ V10.1    Finger tracking
✅ V11      Dynamic state engine
✅ V11.1    Real mic/state wiring
✅ V11.2    Voice-reactive face
✅ V12      Assembly
✅ V12.0.x  Performance / visibility / clarity
✅ V12.1    Final shockwave
✅ V12.1.x  Shockwave SFX
✅ V13      Gesture Control
✅ Brain V1 foundation (B1–B8)
✅ Command Center real-event integration
✅ Brain-driven Humanoid/Command Center unification
⏳ Sonor workflow/memory bridge (next project stage)
```


---

# ASTRA MAX — approved continuation to ready-to-use release

Detailed specification: `docs/ASTRA_MAX.md`.

The product decision on 2026-09-20 is to continue beyond Brain V1 as one structured production program rather than isolated feature requests. Codex should execute the phases below sequentially and keep the repository recoverable and validated at each stage.

## ASTRA MAX phase sequence

1. **Phase 0 — Baseline lock**: verify current `main`, tests/build, backup, feature branch.
2. **Phase 1 — Agent/capability normalization**: map every visual node to a truthful agent/skill/tool/integration/runtime state.
3. **Phase 2 — Memory Intelligence**: unified local memory, provenance, Graphify, Obsidian, optional Sonor, bounded retrieval.
4. **Phase 3 — Project Registry**: multi-project identity, aliases, workspaces, repos, docs, milestones and memory namespaces.
5. **Phase 4 — Strategist + Planner**: bounded multi-step planning, retries, cancellation, permission checkpoints.
6. **Phase 5 — Agent Orchestrator**: Chief coordinates real specialists.
7. **Phase 6 — Tool Registry + MCP**: provider-neutral execution interface and policy gate.
8. **Phase 7 — Files + GitHub production flow**: inspect/edit/test/build/diff/PR/CI/verify.
9. **Phase 8 — Business skills**: Finance, Sales, Marketing, Ops, Editor, Analytics.
10. **Phase 9 — Communication/cloud-file integrations**: CRM, Calendar, Email, Drive with truthful NOT_CONFIGURED states until connected.
11. **Phase 10 — Design + Social**: provider-neutral creative/social workflow.
12. **Phase 11 — Computer Agent**: controlled Windows actions, OFF by default, permission gated, global STOP.
13. **Phase 12 — Voice + Multimodal**: unify text, mic, gesture, camera, image and optional screen context.
14. **Phase 13 — Command Center MAX**: real live operational visualization; no fake traces.
15. **Phase 14 — Automation**: safe scheduled workflows under the same permission model.
16. **Phase 15 — Security/failure hardening**: outages, malformed output, injection, cancellation, path and permission failures.
17. **Phase 16 — Performance pass**: protect Humanoid FPS while measuring agent/memory/tool overhead.
18. **Phase 17 — Full system test**: project continuation, development PR workflow, ALURKA campaign workflow, calendar/email workflow, emergency stop.
19. **Phase 18 — Release Candidate**: all tests/typecheck/lint/build/audit/diff checks pass.
20. **Phase 19 — Windows ready-to-use release**: install/start/self-check path for ASTRA + Ollama + Codex/integrations.
21. **Phase 20 — Final release**: only after the full Definition of Done in `docs/ASTRA_MAX.md`.

## 18-node Command Center requirement

The existing visual roster remains, but every node must be truthful:

- Chief of Staff
- Memory
- Strategist
- Researcher
- Finance
- Editor
- Sales
- Marketing
- Ops
- Social
- Engineering
- Design
- Developer
- Analytics
- CRM
- Calendar
- Email
- Drive

Allowed operational states:

`READY`, `ACTIVE`, `WAITING_APPROVAL`, `BLOCKED`, `OFFLINE`, `NOT_CONFIGURED`, `ERROR`.

A visual node is not evidence of a working capability. Real runtime events and real adapters/tools must drive status.

## Final target

ASTRA is not considered ready merely because individual modules exist. It is ready only when it can truthfully identify a project, retrieve relevant memory, plan work, select real agents/tools, request permissions, execute permitted steps, stream progress, verify results, report failures honestly, and preserve useful project state while the Humanoid remains responsive and global STOP works.

See `docs/ASTRA_MAX.md` for the full Definition of Done, permission model, security boundaries, verification requirements, final-report format, and Git strategy.


---

# ASTRA JARVIS-Class Expansion — approved continuation after Phase 20

Detailed specification: `docs/ASTRA_MAX.md#astra-jarvis-class-expansion--phase-2130`.

Product decision on 2026-09-20: Phase 20 is now the **ASTRA MAX Core Release Gate**, not the terminal roadmap stop. After the core release is stable, Codex should continue through Phase 21–30 automatically unless a genuine external/user action blocks progress.

## Phase 21–30 sequence

21. **Always-On Voice Presence** — wake word architecture, VAD, interruption/barge-in, truthful mic state, personality layer.
22. **Identity / Trust / Secrets** — trusted session/device identity, optional speaker recognition, secure secret vault, explicit authorization boundaries.
23. **Situational Awareness** — opt-in screen context, screenshot understanding, camera vision, active application context and privacy controls.
24. **Event Engine + Proactive Intelligence** — approved event subscriptions, proactive alerts, dedupe, quiet hours and notification policy.
25. **Background Tasks + Parallel Agents** — durable queue, checkpoints, pause/resume/cancel, bounded concurrency and safe parallel specialist work.
26. **Episodic Memory + Context Fusion** — project timeline, decisions/results/provenance, relevance-bounded fusion across memory/project/screen/integrations.
27. **Multi-Device Presence** — secure pairing, device registry, per-device capability permissions and safe task routing.
28. **Self-Diagnostics / Recovery / Audit / Offline** — health checks, safe recovery, action history and graceful local-first degradation.
29. **Skill Ecosystem + IoT Bridge** — versioned permission-reviewed skills plus explicitly registered environment/device capabilities.
30. **JARVIS-Class Integration + Self-Evaluation + Ready Release** — integrated scenarios, soak/reliability tests, final safety/performance/verification gates.

## Ultimate roadmap stop condition

The final completion status is one of:

- `JARVIS-CLASS READY`
- `JARVIS-CLASS READY WITH EXTERNAL CONFIGURATION REQUIRED`
- `JARVIS-CLASS BLOCKED`

The “JARVIS-Class” label describes the practical assistant experience target, not fictional superintelligence or impossible movie capabilities.


---

## Implementation checkpoint — 2026-09-20 before next Codex session

Merged to `main`:
- ✅ Phase 0 baseline lock
- ✅ Phase 1 canonical 18-node capability registry
- ✅ Phase 2 Memory Intelligence **foundation** (provenance + multi-source contracts/manager); live Graphify/Obsidian/Sonor still pending
- ✅ Phase 3 Project Registry **foundation** (explicit registry + project detection); scoped project file/context loading still pending
- ✅ Phase 4 Planner **safety foundation** (bounds/contracts only); Strategist/model planner and execution still pending
- ✅ Phase 6 Tool Registry **metadata foundation** completed early; real handlers/MCP execution still pending

The next Codex session should not rewrite these foundations. It should connect real providers/adapters to them and advance the remaining roadmap with truthful telemetry, permission gates, cancellation and verification.


---

## Phase 5A implementation checkpoint — 2026-09-20

Implemented on `astra/phase5-bounded-agent-orchestrator`:

- bounded dependency-aware plan executor;
- permission gate before handler invocation;
- retries/timeouts/cancellation;
- real step lifecycle telemetry;
- Memory and Ollama reasoning handlers;
- Codex read-only inspect / permitted safe-local action / evidence-producing verify handlers;
- truthful stop on missing Research/browser or unconfigured tool handler;
- agent-aware permission floors for GitHub/Communication/Business/Trading actions.

Phase 5 is **partially implemented**, not fully complete. Full completion requires the executable Tool Registry/MCP and real Research/browser capability from the next roadmap work.


---

## Phase 6A implementation checkpoint — 2026-09-20

Implemented on `astra/phase6a-executable-tool-runtime`:

- executable Tool Registry with permission/policy gates before handlers;
- timeout, cancellation and bounded input/output;
- verified completion requirement;
- real tool lifecycle telemetry;
- native `project.context.search` read-only tool;
- native plan inspection routed through Tool Runtime;
- transport-injected MCP contract using the same runtime;
- tests for native project isolation, policy/permission blocking, false-completion rejection, MCP fixture execution and Command Center tool telemetry.

Production MCP remains **NOT CONFIGURED** until a real server/transport is explicitly connected and verified.

Next major milestone: Phase 7 Files + GitHub production workflow through this runtime, then real Research/browser tooling to finish Phase 5 delegation coverage.


---

## Phase 7A implementation checkpoint — 2026-09-20

Implemented on `astra/phase7a-scoped-files-local-git`:

- centralized registered-workspace path safety;
- scoped exact file read;
- SHA-preconditioned + read-back-verified file write;
- bounded shell-free process runner;
- local Git status and per-file diff;
- validated branch creation;
- explicit safe-file staging;
- staged-set-safe local commit + new-HEAD verification;
- allowlisted npm test/typecheck/lint/build verification;
- temporary-repo end-to-end test of the complete local flow.

External GitHub push and PR creation remain Level-3 `NOT_CONFIGURED`; Phase 7 is partial until a real authenticated GitHub provider and CI verification path are connected.


---

## Phase 7B implementation checkpoint — 2026-09-20

Implemented on `astra/phase7b-authenticated-github-transport`:

- provider-neutral authenticated GitHub transport;
- default local `gh` CLI provider with verified auth status;
- Level-3 verified push with GitHub remote/current-branch/remote-ref checks;
- Level-3 PR creation with returned URL verification;
- Level-1 bounded GitHub Actions status read;
- dynamic READY / NOT_CONFIGURED GitHub tool availability;
- structured planner `toolId` / bounded `toolInput`;
- live tool catalog supplied to Strategist;
- registered-tool permission floors;
- structured tool execution through bounded orchestrator;
- project-scope enforcement for tool calls;
- fixture tests for auth availability, approval/policy gates, verified external actions and CI reads.

Phase 7 is still partial until scoped Level-3 approval and a real target-PC push/PR/CI validation complete.


---

## Phase 7C implementation checkpoint — 2026-09-20

Implemented on `astra/phase7c-scoped-level3-approval`:

- preflight before any plan execution for elevated permissions;
- one-time five-minute Level-3 challenge;
- exact input + exact stored-plan binding;
- exact-step approval only;
- safe visible approval scope;
- separate Level-3 ASTRA Console confirmation;
- no token display;
- no model replanning on approval replay;
- follow-up challenge for a second Level-3 action;
- Level-4 rejection before execution;
- API/SSE token validation and lifecycle events;
- regression tests for scope, single-use, policy/availability, exact-step and Level-4 boundaries.

After merge, Phase 7 requires real target-PC validation (gh auth + registered workspace + branch/edit/verify/commit/push/PR/CI). The next code milestone is a real Research/browser capability to close the remaining Phase 5 orchestration gap.


---

## Phase 5B / Research implementation checkpoint — 2026-09-20

Implemented on `astra/phase5b-real-research-browser`:

- native SSRF-resistant `browser.fetch`;
- provider-neutral Research transport;
- local SearXNG search provider with real health verification;
- Level-1 `research.search` and source-backed `research.web`;
- bounded S1/S2/S3 provenance;
- untrusted-web evidence boundary;
- bounded orchestrator Research step execution;
- planner research/browser Level-1 contracts;
- dynamic Researcher runtime status;
- deterministic security/integration regression tests.

After merge, the Phase 5 Researcher gap is closed at the architecture/tooling level. General web search still requires a real local SearXNG service on the target PC; without it ASTRA remains truthful and exposes only explicit-public-URL fetch.

Next code milestone: Phase 8 Business Skills.


---

## Phase 8 implementation checkpoint — 2026-09-20

Implemented on `astra/phase8-business-skills`:

- input-aware Finance, Sales, Marketing, Ops, Editor and Analytics skills;
- specialist skill lifecycle mapped to the matching Command Center nodes;
- native deterministic `business.finance.metrics`;
- native deterministic `analytics.summary`;
- business intent routing and quantitative-plan triggering;
- Level-1 planner contracts for both deterministic tools;
- live Business capability status;
- Phase 8 node contracts marked implemented while external actions remain separate integrations;
- regression coverage for finance arithmetic, analytics statistics, skill selection, routing, planner floors and visual-node truth.

Next: Phase 9 provider-neutral CRM / Calendar / Email / Drive integration contracts and real connected transports where available.


---

## Phase 9 implementation checkpoint — 2026-09-20

Implemented on `astra/phase9-communication-cloud-integrations`:

- provider-neutral CRM / Calendar / Email / Drive transport contract;
- canonical truthful tool IDs;
- Level-1 read vs Level-3 external-write separation;
- selective READY exposure by real provider capability;
- verified-completion requirement;
- planner permission floors;
- live Brain + Command Center integration readiness;
- nodes marked partial/NOT_CONFIGURED until provider auth exists;
- regression coverage for permission, policy, verification and capability truth.

Next: Phase 10 Design + Social provider-neutral creative/publishing workflow.


---

## Phase 10 implementation checkpoint — 2026-09-20

Implemented on `astra/phase10-design-social`:

- real Social content-preparation skill;
- real Design visual-brief skill;
- Social/Design lifecycle mapped to truthful visual nodes;
- provider-neutral creative transport;
- Level-3 design generate/edit and social publish/schedule contracts;
- default NOT_CONFIGURED provider state;
- verified-completion requirement;
- live creative feature status;
- regression coverage for routing, permission, policy and capability truth.

Next: Phase 11 controlled Computer Agent, OFF by default.


---

## Phase 11 implementation checkpoint — 2026-09-20

Implemented on `astra/phase11-controlled-computer-agent`:

- OFF-by-default Windows Computer transport;
- bounded process-list read;
- fixed-allowlist application launch;
- no arbitrary shell/path input;
- Level-1 read vs Level-2 local-action permission floors;
- allowShell gate for launches;
- OS spawn-event verification;
- shared AbortSignal/global STOP cancellation;
- live Computer feature state;
- regression tests for configuration, permission, policy, selective capability and cancellation.

Next: Phase 12 Voice + Multimodal unification. Real target-PC desktop validation remains a separate required validation step.


---

## Phase 12 implementation checkpoint — 2026-09-20

Implemented on `astra/phase12-multimodal-input-envelope`:

- unified trusted input provenance envelope;
- text vs voice source tracking;
- keyboard/microphone/gesture-open-palm/API trigger tracking;
- bounded modality/consent metadata;
- gesture-triggered mic sessions identified truthfully;
- no camera/image/screen pixels transmitted;
- image/screen payload claims rejected while unconfigured;
- provider context receives no-visual-inference boundary;
- Brain response envelope preserves input provenance;
- multimodal runtime status + Command Center MM chip;
- regression coverage for parser, consent, envelope and status.

Next milestone: inspect current `main` roadmap after merge and continue the next unfinished ASTRA MAX capability without duplicating existing foundations.
