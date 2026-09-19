# ASTRA Codex Handoff

## 2026-09-19 — Brain V1 local release verification

- B1–B8 implementation is complete in `astra/brain-v1-complete`.
- Production UI was verified at `http://127.0.0.1:3017` with zero browser console errors.
- Ollama `0.34.2` + `qwen3.5:4b` completed both a short chat and a real allowlisted file-read tool turn. Extended thinking is disabled by default for responsive chat; project context is retrieved only for context-bearing requests.
- Codex CLI `0.155.0`, using the existing ChatGPT login, completed a read-only project query after a single-use UI approval.
- Hidden logon tasks `ASTRA-Agent` and `ASTRA-Ollama` plus an `ASTRA` desktop shortcut were installed and verified. Both services remain loopback-only.
- Sonor/Graphify/Obsidian integration is intentionally the next stage. Hermes remains disabled. Physical microphone input was not verified by browser automation.

This file is the short operational context for Codex. For the full history, read `docs/ASTRA_CONVERSATION_HISTORY.md`.

Last updated: 2026-09-19

## Current project state

Brain V1 foundation B1–B8 is implemented on feature branch `astra/brain-v1-complete`:
- cancellable streaming API and real event bus;
- Hermes guarded by gateway review and one-use approval;
- Ollama model selection and read-only tool loop;
- Codex CLI engineering adapter, disabled until an allowed CLI/login is verified;
- bounded project memory and explicit save;
- allowlisted MCP tools and permission gates;
- real Command Center status/timeline;
- shared Humanoid/Brain lifecycle;
- 21 security/integration tests plus build/typecheck/lint/audit CI.

Runtime facts must remain distinct from code readiness. On 2026-09-19, the Codex desktop binary could not be launched directly from WindowsApps. An isolated official Codex CLI 0.155.0 was then installed under `D:\ASTRA-Tools`; its existing ChatGPT login and one read-only ASTRA task were verified. This machine-level path is intentionally not committed. Sonor memory integration is the next stage after this branch is stable.

Repository:
- `valoranttgm123-svg/ASTRA-AI-Agent`

Current stable main:
- ASTRA Humanoid V13
- gesture control: PINCH / OPEN PALM / FIST
- loud synthesized shockwave SFX + presence layer
- GPU particle renderer
- image-driven approved artwork
- real mic/speech state wiring
- camera index-finger head tracking
- runtime `stopInteraction()` for real cancellation

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

1. validate/tune V13 gesture thresholds on the target camera if needed;
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
