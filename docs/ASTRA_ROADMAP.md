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
- cancellable NDJSON event stream and real task IDs;
- explicit provider, project and Ollama model controls;
- bounded project-context retrieval plus opt-in local memory;
- read-only project and Git tools, allowlisted MCP tools, and single-use approvals;
- Codex engineering adapter using `codex exec --json`, an existing ChatGPT login, isolated config and read-only default;
- Command Center node states and timelines derived from real events;
- Humanoid `LISTENING → THINKING → SPEAKING → IDLE` lifecycle tied to the same runtime;
- loopback/origin/API limits, traversal/symlink/secret guards, redaction, cancellation and child-process cleanup;
- automated tests, typecheck, lint, dependency audit and production build in CI.

Deferred by product decision:
- Sonor Workflow/Graphify/Obsidian memory bridge. It will be connected after this ASTRA foundation is stable, without replacing local safety boundaries;
- paid cloud providers. They remain out of V1 and OFF by default.

Verified local deployment on 2026-09-19:
- Ollama `0.34.2` and `qwen3.5:4b` are installed; model storage is on `D:\AI-Models\Ollama`;
- short local chat and a real `project.read_file` tool turn completed through the production browser UI;
- Codex CLI `0.155.0` completed a read-only project task after a single-use UI approval;
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
- user-selectable model.

### B4 — Codex engineering specialist ✅ adapter and read-only live verification
- engineering routing;
- repo/code tasks;
- explicit specialist events.

### B5 — Memory layer ✅ local project memory; Sonor bridge deferred
- project memory;
- task context;
- retrieval events visible in Command Center.

### B6 — Tool/MCP execution ✅ bounded allowlist and approval gates
- real tool started/completed/error events;
- permissions and failure handling.

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
