# ASTRA Project Memory

> This file records important project decisions agreed during development.
> It is intentionally concise and should be updated whenever architecture, interaction rules, or product direction changes.

## Repository

Primary repository:
`valoranttgm123-svg/ASTRA-AI-Agent`

Default branch:
`main`

Major changes should:
1. branch from latest `main`;
2. create a rollback/backup branch before invasive visual/runtime changes;
3. update the build log / roadmap;
4. run ASTRA CI;
5. merge only after CI succeeds.

---

## Product identity

ASTRA is not intended to be a static chatbot UI.

It is designed as a single AI system with:

```
Humanoid       = face / presence
Runtime        = nervous system / event bus
Brain          = reasoning / orchestration
Command Center = observable brain activity
```

All four must eventually use the same runtime events.

---

## Humanoid decisions

### Visual source

Approved source:
`public/assets/astra-humanoid/astra-idle-v1.webp`

Rules:
- preserve the identity/proportions/colors of the approved artwork;
- current direction is image-driven particle reconstruction;
- do not replace it with a new procedural humanoid;
- do not generate a new replacement image unless explicitly requested;
- Effects Off/reference mode should remain a recoverable fallback.

### Visual character

- near-black background;
- cyan particle contours / energy;
- controlled orange face/core;
- no giant saturated orange/yellow central block;
- particles should be visible individually;
- brightness should come from particle luminance, not excessive blur;
- HIGH mode should remain crisp and readable.

### Renderer

Current design:
- one React Three Fiber / Three.js canvas;
- GPU vertex/fragment shaders;
- two point render passes: base + glow;
- HIGH DPR target 1.5;
- MSAA OFF because point edges are shader-smoothed;
- avoid expensive fullscreen blur/backdrop-filter over continuously animated WebGL.

### Runtime visual states

- IDLE
- LISTENING
- THINKING
- SPEAKING
- ERROR where appropriate

State changes should be driven by real runtime events, not arbitrary looping demo animations.

### Voice

- browser speech playback drives SPEAKING;
- reactive face is gated by real speech playback start/pause/resume/end;
- `speechLevel` is a compatibility event gate, not measured audio loudness;
- never present synthetic cadence as microphone/audio amplitude.

### Camera

- MediaPipe Hand Landmarker;
- worker-based inference;
- current target camera input 320×240 ideal;
- HIGH cadence ~15 FPS;
- LOW cadence ~10 FPS;
- only one frame in-flight;
- no ASTRA camera recording/upload.

### V13 gesture mapping

- PINCH → replay assembly;
- OPEN PALM → listening/mic;
- FIST → stop active interaction;
- gestures use debounce/stability/cooldown;
- head tracking must continue even if gesture actions are toggled off.

---

## Shockwave + SFX decisions

Final assembly event:
- warm core lock;
- cyan/orange radial ring;
- short controlled particle displacement;
- no fullscreen flashing;
- GPU-only.

SFX:
- generated with Web Audio API;
- no MP3/WAV dependency;
- independent SFX ON/OFF;
- TEST SFX should remain available while tuning;
- browser user gesture is required before Web Audio can play;
- sound should be clearly audible on ordinary laptop/monitor speakers;
- preserve limiter/compressor to avoid uncontrolled clipping.

---

## Brain decisions

ASTRA Brain V1 is free/local-first.

Chosen direction:
- Hermes Agent = orchestration;
- Ollama = default local model;
- Codex = engineering specialist;
- optional cloud providers remain OFF by default.

Brain is not implemented yet.

The existing `/api/agent` flow remains a provider-free orchestrator until Brain integration starts.

Brain should sit behind an adapter so UI does not depend directly on Hermes/Ollama/Codex.

---

## Brain event rules

The Brain must publish real lifecycle events.

Examples:

```
brain.request.started
agent.started
agent.completed
tool.started
tool.completed
memory.retrieved
brain.response.ready
brain.completed
brain.error
```

Humanoid consumes high-level state:
- request/work starts → THINKING;
- microphone capture → LISTENING;
- response playback → SPEAKING;
- completion → IDLE.

Command Center consumes detailed events:
- which agent is active;
- which tool is active;
- task status;
- elapsed time;
- errors;
- completion.

Do not make the Humanoid display detailed fake internal reasoning.

---

## Command Center decisions

The radial agent view is not decorative-only.

It will become a live map of real Brain/agent/tool activity.

Examples:
- Chief of Staff = task routing/orchestration;
- Researcher = web/research;
- Engineering = coding/debugging;
- Memory = context retrieval;
- Editor = writing;
- Design = UI/UX;
- Ops = workflows;
- Marketing/Sales/Social/Finance/Strategist = specialist roles as implemented.

Integration/tool nodes (Drive, Email, Developer, Analytics, CRM, etc.) should be grey when unavailable/disconnected.

Status colors:
- CYAN = ready/active context;
- ORANGE = running;
- GREEN = completed;
- RED = error/attention;
- GREY = unavailable/disconnected.

The UI must not mark a node as running unless a real runtime event exists.

---

## Performance decisions

When performance is poor:
1. identify CPU vs GPU vs browser compositor vs software WebGL;
2. optimize architecture first;
3. preserve HIGH fidelity where possible;
4. use AUTO/LOW only as fallback for weaker hardware.

Current GPU diagnostics should remain visible:
- renderer;
- vendor;
- software renderer YES/NO;
- FPS;
- tracking FPS;
- inference time.

If WebGL reports SwiftShader/software rendering, code optimization alone will not fully solve performance.

---

## Development history / rollback

Important rollback branches exist for major humanoid stages.

Examples include:
- `backup/humanoid-v12.0.2-before-v12.0.3-gpu`
- `backup/humanoid-v12.0.3-before-v12.0.4-compositor`
- `backup/humanoid-v12.0.4-before-v12.0.5-clarity`
- `backup/humanoid-v12.0.5-before-v12.0.6-luminance`
- `backup/humanoid-v12.0.6-before-v12.1-shockwave`
- `backup/humanoid-v12.1-before-v12.1.1-sfx`
- `backup/humanoid-v12.1.1-before-v12.1.2-sfx-boost`
- `backup/humanoid-v12.1.2-before-v12.1.3-sfx-presence`
- `backup/humanoid-v12.1.3-before-v13-gesture-control`

The detailed chronological implementation record remains in:
`docs/HUMANOID_BUILD_LOG.md`

Brain architecture notes remain in:
`docs/ASTRA_BRAIN_V1.md`

Roadmap remains in:
`docs/ASTRA_ROADMAP.md`

---

## Next work after V13

1. complete and validate gesture control;
2. build ASTRA Brain adapter/events;
3. connect Hermes;
4. connect Ollama local default;
5. connect Codex engineering specialist;
6. add Memory/tool lifecycle;
7. drive Command Center nodes from real events;
8. unify Humanoid and Command Center through the same Brain/runtime event bus.
