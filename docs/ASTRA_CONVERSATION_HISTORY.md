# ASTRA Conversation-Derived Project History

Purpose: preserve the ASTRA project decisions and history from the user's conversations so future Codex sessions can continue without losing context.

This is not a verbatim export of private ChatGPT internals. It records the project-relevant conversation history available to the assistant, while excluding secrets, credentials, hidden reasoning, and unrelated personal information.

Last updated: 2026-09-19

---

## 1. Core project direction

The user is building **ASTRA AI Agent** as more than a chatbot. The target is a unified AI operating environment with three visible layers:

```text
HUMANOID = ASTRA's face / embodied presence
BRAIN = ASTRA's reasoning, orchestration, memory, and execution layer
COMMAND CENTER = visual map of real Brain/agent/tool activity
```

The user explicitly approved this relationship:

```text
USER
  ↓
Humanoid / Chat / Mic / Gesture
  ↓
ASTRA Runtime
  ↓
ASTRA Brain
  ↓
Hermes / Ollama / Codex / Memory / Tools
  ↓
results + events
  ├─ back to Humanoid for SPEAKING
  └─ to Command Center for real-time visualization
```

The Command Center must not be fake decoration. Agent nodes should activate only when the corresponding agent/tool is actually running.

---

## 2. Repository and foundation

Repository:
- `valoranttgm123-svg/ASTRA-AI-Agent`
- public fork of the APEX-UI visual foundation.

Main preserved application pieces:
- `ApexWorld`
- `ApexOverviewPanel`
- `AstraConsole`
- `AstraRuntimeProvider`
- Humanoid portal/lab
- `/api/agent`

The current `/api/agent` path remains a provider-free/local-safe orchestration boundary until ASTRA Brain is implemented.

The user wants the repo itself to become the durable handoff surface for Codex. Therefore project history, decisions, and build logs are kept in GitHub.

---

## 3. Approved Humanoid art direction

The user rejected several procedural/3D humanoid experiments and approved an **image-driven particle reconstruction** approach.

Approved artwork:
- `public/assets/astra-humanoid/astra-idle-v1.webp`
- source size: 640×388.

Approved visual language:
- centered bust: head / neck / shoulders / core;
- faceless, bald/subtle AI entity;
- no eyes, teeth, or conventional facial details;
- near-black body/background;
- cyan contour/particle/rim energy;
- warm orange inner face/core energy;
- surrounding energy/network landscape from the approved image;
- preserve source identity/proportions/colors.

Important user preference:
- do **not** generate more replacement images unless explicitly requested;
- improve code/rendering using the approved artwork.

Renderer constraints:
- one renderer;
- sRGB input/output;
- NoToneMapping;
- source-driven particles;
- Effects Off/reference fallback;
- reduced-motion support;
- state changes driven by real runtime events;
- do not claim visual cadence is measured audio amplitude.

---

## 4. Early Humanoid iterations

### V5
- realistic FaceCap-style 3D head experiment.
- user disliked the result.

### V6
- GLTF texture/blob repair attempt.
- fixed texture loading but did not establish the preferred design.

### V7
- procedural entity experiment.
- not accepted.

### V8
- more polished procedural humanoid.
- still rejected by the user.

Decision:
- abandon invented procedural humanoid direction;
- move to approved artwork reconstruction.

---

## 5. V9 image-driven reconstruction

V9 introduced:
- approved artwork as the source;
- pixel sampling into a Three.js particle field;
- source RGB retention;
- rounded head depth;
- independent head/body motion;
- REFERENCE / PARTICLES / COMPARE modes;
- Effects Off fallback;
- technical diagnostics.

A blank-center issue was repaired in PR #22.

### V9.2
Problem:
- huge white/pixelated block in the center.

Cause:
- perspective point-size attenuation plus stacked additive overdraw.

Fix:
- fixed-screen particle sizing;
- Normal blending for the base;
- low-opacity additive glow;
- capped renderer DPR.

PR #23 merged.
Backup:
- `backup/humanoid-v9.1-before-v9.2`

---

## 6. V10 ASTRA MAX

V10 added:
- adaptive AUTO/HIGH/LOW quality;
- cyan edge subset;
- warm/core subset;
- layered renderer improvements.

PR #24 merged.
Backup:
- `backup/humanoid-v9.2-before-v10-max`

### V10.1 index-finger tracking

Added:
- `@mediapipe/tasks-vision@1.0.1`;
- worker-based hand tracking;
- camera permission flow;
- landmark 8/index fingertip tracking;
- mirrored X;
- one in-flight frame;
- HIGH roughly 15 FPS tracking cadence;
- LOW roughly 10 FPS;
- camera ideal 320×240;
- cleanup of worker/media stream.

PR #25 merged.
Backup:
- `backup/humanoid-v10-before-tracking`

The user's expectation evolved from "head follows finger" toward full hand gesture control, later implemented in V13.

---

## 7. V11 state engine

V11 introduced a dynamic visual state engine over one approved artwork:
- IDLE;
- LISTENING;
- THINKING;
- SPEAKING.

State transitions use radial zones and cyan/warm energy changes instead of swapping to invented alternate humanoid images.

### V11.1 real interaction state wiring

Added:
- real browser Speech Recognition mic flow;
- final transcript auto-sent through `/api/agent`;
- speechSynthesis playback events drive SPEAKING;
- playback gate is binary/event-driven, not loudness;
- camera remains independent.

PR #27 merged.
Backup:
- `backup/humanoid-v11-before-v11.1-real-interaction`

### V11.2 voice-reactive face

Added:
- warm face/core subsets;
- smoothed playback envelope;
- deterministic visual cadence while actual speechSynthesis playback is active.

PR #28 merged.

### V11.2.1 saturation hotfix

User reported a huge yellow/orange central block while speaking.

Fix:
- narrow face/core masks;
- require warm source pixels;
- reduce additive stacking;
- cap speaking energy.

PR #29 merged.
Backup:
- `backup/humanoid-v11.2-before-v11.2.1-hotfix`

---

## 8. V12 assembly sequence

The user wanted ASTRA to visibly construct itself.

V12 implemented:
- ~2.6 second non-blocking assembly;
- central humanoid only;
- background remains stable;
- deterministic particle source stream from the left;
- order:
  1. head;
  2. neck;
  3. shoulders;
  4. core;
- REPLAY ASSEMBLY;
- SKIP;
- mic/chat/voice/camera remain usable;
- reduced-motion resolves directly to final form.

PR #30 merged.
Backup:
- `backup/humanoid-v11.2.1-before-v12-assembly`

---

## 9. V12.0.1 sharpness and smoother motion

User feedback:
- particles not sharp enough;
- assembly not smooth enough.

Changes:
- shared procedural round particle mask;
- HIGH DPR raised to 1.5;
- point sizes reduced initially for crispness;
- quintic smootherstep replaced cubic easing;
- time-dependent assembly jitter removed;
- deterministic stream curve.

PR #31 merged.
Backup:
- `backup/humanoid-v12-before-v12.0.1-particle-polish`

---

## 10. V12.0.2 particle visibility

User feedback:
- after sharpening, particles became too hard to see.

Fix:
- increased base and glow point sizes;
- widened round mask coverage;
- lowered alpha cutoffs;
- increased cyan/warm visibility.

PR #32 merged.
Backup:
- `backup/humanoid-v12.0.1-before-v12.0.2-visibility`

---

## 11. Performance discussion and V12.0.3 GPU refactor

User reported localhost lag.

Diagnosis:
- old active renderer looped over all particles on CPU every frame;
- copied updated positions to edge/warm/cyan/voice/six zone geometries;
- many buffer uploads;
- HIGH DPR and camera tracking increased cost;
- `next dev` adds HMR/source-map overhead.

The user asked whether optimization would reduce quality.
Decision:
- optimize architecture first;
- preserve HIGH visual quality;
- move work to GPU rather than cutting particle count.

### V12.0.3 GPU Particle Performance

Implemented:
- custom GPU vertex/fragment shader renderer;
- static particle buffers;
- GPU head rotation;
- GPU chest movement;
- GPU assembly;
- GPU state/voice energy;
- round particle shaping via `gl_PointCoord`;
- two active draw passes only: base + glow;
- CPU updates only small uniforms.

PR #33 merged.
Backup:
- `backup/humanoid-v12.0.2-before-v12.0.3-gpu`

---

## 12. V12.0.4 compositor/GPU diagnostics

Lag still felt noticeable.

Additional bottlenecks identified:
- MSAA was redundant because round particles are shader-smoothed;
- fullscreen CSS blur;
- backdrop-filter;
- mix-blend-mode;
- legacy dead CPU renderer source;
- possibility of browser using software WebGL renderer.

V12.0.4 changes:
- MSAA off;
- HIGH DPR remains 1.5;
- fullscreen compositor blur removed;
- backdrop blur removed;
- mix-blend removed;
- dead CPU particle renderer removed;
- Technical panel reports real WebGL renderer/vendor;
- detects SwiftShader/llvmpipe/software renderer.

PR #34 merged.
Backup:
- `backup/humanoid-v12.0.3-before-v12.0.4-compositor`

If `Software renderer: YES`, browser GPU/hardware acceleration becomes the main performance problem.

---

## 13. V12.0.5 particle clarity

User screenshot showed particles still not distinct enough.

Changes:
- HIGH base point modestly increased;
- glow tightened instead of simply enlarged;
- source contrast boosted;
- each point renders a bright core plus thin soft rim.

PR #35 merged.
Backup:
- `backup/humanoid-v12.0.4-before-v12.0.5-clarity`

---

## 14. V12.0.6 luminance lift

User screenshot:
- particles were crisp but still too dark.

Changes:
- controlled gamma/midtone lift;
- small floor for dark source particles;
- slightly stronger cyan/orange energy;
- capped highlight normalization;
- HIGH base point 2.80;
- glow remains tight.

PR #36 merged.
Backup:
- `backup/humanoid-v12.0.5-before-v12.0.6-luminance`

---

## 15. V12.1 final shockwave

User asked to continue to the next stage.

Implemented:
- GPU-only final shockwave after natural assembly completion;
- warm core lock;
- cyan/orange radial ring;
- small radial displacement;
- ~2.35 second duration;
- no extra mesh/canvas/draw pass;
- SKIP / Effects Off / reduced-motion suppress it.

PR #37 merged.
Backup:
- `backup/humanoid-v12.0.6-before-v12.1-shockwave`

---

## 16. Shockwave sound iterations

The user noticed V12.1 had no sound.

### V12.1.1 synthesized SFX

Added Web Audio API SFX:
- low core pulse;
- electric rise;
- filtered noise sweep;
- soft impact;
- independent SFX ON/OFF;
- browser user-gesture audio unlock;
- REPLAY ASSEMBLY arms/resumes audio.

PR #38 merged.
Backup:
- `backup/humanoid-v12.1-before-v12.1.1-sfx`

### V12.1.2 SFX boost

User feedback:
- SFX too quiet.

Changes:
- higher master gain;
- stronger all layers;
- DynamicsCompressor limiter.

PR #39 merged.
Backup:
- `backup/humanoid-v12.1.1-before-v12.1.2-sfx-boost`

### V12.1.3 loud SFX + presence layer

User feedback:
- still not audible enough.

Key realization:
- laptop/monitor speakers often reproduce sub-bass poorly;
- simply raising 40–100 Hz gain is not enough.

Changes:
- stronger pre-limiter master;
- post-limiter output gain;
- boosted core/rise/noise/impact;
- dedicated 260–920 Hz mid-frequency presence layer;
- TEST SFX button for immediate output verification.

PR #40 merged.
Backup:
- `backup/humanoid-v12.1.2-before-v12.1.3-sfx-presence`

If TEST SFX remains completely silent, investigate browser/Windows output routing rather than continuing to raise gain blindly.

---

## 17. Humanoid ↔ Brain ↔ Command Center relationship

The user explicitly asked how the Humanoid relates to the Brain and the Command Center.

Approved mental model:

### Humanoid
- ASTRA's face/presence;
- receives voice/text/gesture;
- shows high-level state;
- speaks results.

### Brain
- actual reasoning/execution;
- orchestration;
- model routing;
- memory;
- tools;
- agent delegation.

### Command Center
- real-time visualization/control surface;
- shows which real agent/tool/task is active;
- should never fake activity.

Example flow:

```text
User:
"ASTRA, check ALURKA project and find the database error."

Humanoid
  LISTENING
    ↓
ASTRA Runtime
    ↓
ASTRA Brain
    ↓
Chief of Staff
    ↓
Memory
    ↓
Engineering
    ↓
Developer/GitHub tool
    ↓
result
    ├─ Command Center nodes update from real events
    └─ Humanoid switches to SPEAKING
```

Suggested Command Center event examples:

```ts
{
  type: "agent.started",
  agent: "engineering",
  task: "Inspect Supabase connection"
}
```

and:

```ts
{
  type: "agent.completed",
  agent: "engineering"
}
```

Humanoid needs only high-level state; Command Center can display detailed agent/tool state.

---

## 18. Command Center roles discussed

The graph/dashboard area should become the ASTRA Command Center.

Suggested roles:
- Chief of Staff — orchestration/delegation;
- Researcher — public/web/document research;
- Strategist — planning/prioritization;
- Finance — financial/budget analysis;
- Editor — writing/revision;
- Memory — context retrieval;
- Design — UI/UX/visual work;
- Engineering — coding/debugging/repo work;
- Social — content/social media;
- Ops — workflows/automation;
- Marketing — positioning/campaign work;
- Sales — leads/offers/sales workflows.

Tool/integration nodes can include:
- Drive;
- Email;
- CRM;
- Analytics;
- Developer/GitHub;
- other MCP/plugin/tool connections.

Suggested status colors:
- cyan = ready/active;
- orange = working;
- green = completed;
- red = error/attention;
- grey = unavailable/unconnected.

These colors are UI semantics only; actual activity must come from real runtime events.

---

## 19. ASTRA Brain V1 decision

The user approved a local-first/free-first Brain strategy.

Architecture direction:

```text
ASTRA UI / HUMANOID / VOICE
          ↓
ASTRA BRAIN ADAPTER
          ↓
      HERMES AGENT
   /       |        \
OLLAMA   CODEX    OPTIONAL CLOUD
 LOCAL   SPECIALIST
   \       |        /
     MEMORY / SKILLS / TOOLS
```

Roles:
- **Hermes Agent**: orchestration framework.
- **Ollama**: default local model, no per-request API fee.
- **Codex**: engineering specialist for repo/code/build/test work.
- **Memory**: durable context.
- **Tools / MCP**: actions and integrations.
- **Paid cloud**: optional, disabled by default.

Important:
- paid providers must not silently activate;
- ASTRA should ask or follow an explicit spending policy before paid escalation;
- frontend should depend on a stable ASTRA Brain adapter, not directly on Hermes internals.

See:
- `docs/ASTRA_BRAIN_V1.md`

---

## 20. V13 gesture control — current stage

After V12.1.3, the user said to continue to the next stage.

V13 direction:
- reuse the existing MediaPipe Hand Landmarker;
- no new gesture model;
- compute gestures from the existing 21 landmarks in the worker.

Initial gesture mapping:
- PINCH → replay assembly;
- OPEN PALM → begin ASTRA listening/mic;
- FIST → stop the current ASTRA interaction and return IDLE.

Stability policy:
- gesture must remain stable for multiple inference frames;
- release/neutral required before retrigger;
- cooldown prevents spam.

A new runtime `stopInteraction()` action was added so FIST actually:
- aborts request;
- stops microphone recognition;
- cancels speech playback;
- returns runtime/avatar to IDLE.

V13 PR:
- #41
- branch: `astra/v13-gesture-control`

Backup:
- `backup/humanoid-v12.1.3-before-v13-gesture-control`

---

## 21. User preferences that should guide future work

- prefers direct implementation rather than long hypothetical discussion;
- wants recoverable GitHub backups before risky changes;
- wants CI-green merges;
- strongly prefers smoothness without degrading HIGH visual quality;
- wants visual improvements based on the approved artwork rather than replacement character generation;
- wants ASTRA to become genuinely functional, not just decorative;
- wants Codex to be able to continue from GitHub without re-explaining project history;
- wants conversation/project context saved in GitHub;
- prefers local/free paths where possible before paid services.

---

## 22. Current local workflow

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

Development mode may feel heavier than production because of Next.js HMR/source maps/recompilation.

---

## 23. Next major roadmap after V13

1. Finish/validate V13 gesture control.
2. Implement ASTRA Brain Adapter.
3. Add Hermes local service/adapter.
4. Connect Ollama as default local model.
5. Route `/api/agent` through Brain Adapter.
6. Add durable Memory and Skills.
7. Add Codex as engineering specialist.
8. Add MCP/tools and permission policies.
9. Add real Brain/runtime event bus.
10. Bind Command Center nodes/pipeline to real events.
11. Keep Humanoid state synchronized with Brain events.
12. Optional paid cloud providers remain disabled by default.

---

## 24. Context preservation rule

When future Codex/ChatGPT work changes:
- architecture;
- Humanoid behavior;
- Brain design;
- Command Center semantics;
- version roadmap;
- major bug fixes;
- user-approved decisions;

update this file or `docs/CODEX_HANDOFF.md` so the next session can resume from GitHub.
