# ASTRA Codex Handoff

This file is the short operational context for Codex. For the full history, read `docs/ASTRA_CONVERSATION_HISTORY.md`.

Last updated: 2026-09-19

## Current project state

Repository:
- `valoranttgm123-svg/ASTRA-AI-Agent`

Current stable main before V13 merge:
- ASTRA Humanoid V12.1.3
- loud synthesized shockwave SFX + presence layer
- GPU particle renderer
- image-driven approved artwork
- real mic/speech state wiring
- camera index-finger head tracking

Current work:
- V13 Gesture Control
- branch: `astra/v13-gesture-control`
- PR: #41
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
- never silently used.

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

## Next work after V13

1. merge/validate V13;
2. ASTRA Brain Adapter;
3. Hermes adapter/service;
4. Ollama local default;
5. route `/api/agent` through Brain;
6. durable Memory/Skills;
7. Codex engineering specialist;
8. MCP/tools permissions;
9. Brain/runtime event bus;
10. Command Center real event visualization.

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
