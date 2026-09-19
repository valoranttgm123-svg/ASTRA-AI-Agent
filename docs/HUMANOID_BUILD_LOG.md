# ASTRA Humanoid Build Log

## Stage 0 — Project inspection

- Existing main interface preserved: `ApexWorld`, `AstraConsole`, `AstraRuntimeProvider`.
- Existing assistant request path preserved: `/api/agent`.
- Existing browser speech output preserved.
- Existing runtime already exposes `idle`, `listening`, `thinking`, `speaking`, `error` avatar states.
- No new paid service enabled.
- No keys moved into browser code.

## Recoverable copies

- Backup before image-driven rebuild: `backup/humanoid-v8-before-image-stage`.
- Backup before V9 visibility repair: `backup/humanoid-v9-before-visibility-fix`.
- Backup before V9.2 renderer repair: `backup/humanoid-v9.1-before-v9.2`.

## Stage 1 — Approved artwork baseline + image-driven particle preview

Approved idle artwork asset: `public/assets/astra-humanoid/astra-idle-v1.webp`.

Implemented:
- original approved artwork reference view;
- image pixels sampled into a Three.js particle field;
- sampled RGB colors retained per particle;
- rounded depth on head samples for mouse head-turn;
- body/chest movement independent from head movement;
- `REFERENCE`, `PARTICLES`, and split `COMPARE` modes;
- `EFFECTS OFF` neutral-artwork fallback;
- reduced-motion support;
- Technical details collapsed by default;
- compact `IDLE`, `LISTENING`, `THINKING`, `SPEAKING` controls;
- fullscreen Humanoid portal inside the existing `AstraRuntimeProvider`;
- existing chat request path and assistant runtime preserved.

## Stage 1.1 — Blank view repair

Reported symptom: the humanoid center area was empty while surrounding UI rendered.

Investigation:
- artwork asset was valid and decoded as 640×388;
- Three.js and the fullscreen portal were mounted;
- particle visibility settings were incorrect for the scene.

Fixes:
- corrected sampler aspect to 320×194;
- retained approved artwork beneath the Canvas as safety/reference;
- changed reference rendering to `object-fit: contain`;
- moved head pivot to the head/neck region;
- added source/particle/FPS diagnostics.

## Stage 1.2 — White-block / overdraw repair (V9.2)

Reported symptom: the particle humanoid rendered as a huge white/pixelated block with cyan edges.

Investigation:
- WebGL is working; the screenshot proves the particle field is rendering;
- `PointsMaterial` with `sizeAttenuation` enabled multiplied the point size by perspective scale, making each sample extremely large on screen;
- two additive layers then accumulated color until the center saturated to white.

Fixes:
- base particles now use a fixed 2.1 px screen size with `sizeAttenuation={false}`;
- base layer uses `NormalBlending` to preserve source cyan/orange colors;
- glow remains additive but uses only 4.2 px and very low opacity;
- depth test/write disabled for predictable flat artwork reconstruction;
- renderer DPR capped at 1.25 and antialias disabled to reduce GPU load;
- particle-view reference underlay reduced to 3.5% opacity;
- speaking/thinking only make small opacity/size changes instead of multiplying point size heavily;
- UI version label updated to `ASTRA // HUMANOID V9.2`.

### Current limitations / intentionally unfinished

- Only the idle artwork is approved. Listening/thinking/speaking currently reuse it with motion/state changes.
- Real microphone capture is not yet implemented in the existing ASTRA project.
- Browser `speechSynthesis` output is treated as playback status, not measured loudness.
- Assembly sequence, intermediate images, backdrop highlight sampling, shockwave, and webcam index-finger tracking remain future stages.

### Verification required

- GitHub Actions production build for V9.2.
- Browser check of `REFERENCE`, `PARTICLES`, and `COMPARE` after pulling the merged V9.2 commit.
- User approval of scale, alignment, particle density, color retention, and head-turn behavior.


## Stage 2 — ASTRA MAX / Humanoid V10

Goal: make the approved image-driven humanoid substantially more polished without changing the assistant runtime or adding a second renderer.

Implemented:
- version label upgraded to `ASTRA MAX // HUMANOID V10`;
- adaptive `QUALITY AUTO / HIGH / LOW` control;
- AUTO quality drops to the lighter profile when measured UI FPS falls below 44;
- cyan edge samples are detected from the approved artwork and rendered as a dedicated profile-energy layer;
- warm/orange artwork samples are detected and rendered as a dedicated neural-core layer;
- speaking energy reacts to the existing runtime `speechLevel` instead of inventing a microphone amplitude;
- orange face/core energy, cyan silhouette energy and scan-line atmosphere react to avatar state;
- fixed-screen point sizing remains in place so the V9.1 white-block regression cannot return;
- base color layer still uses Normal blending; only low-opacity energy layers use Additive blending;
- HIGH uses DPR 1.25 while LOW uses DPR 1.0;
- approved artwork, chat, orb, voice path, `/api/agent`, effects-off and reduced-motion behavior remain preserved;
- no new paid service, secret, external model, or unapproved artwork added.

Verification required:
- GitHub Actions production build;
- browser check on the target PC in AUTO quality;
- compare `REFERENCE`, `PARTICLES`, and `COMPARE`;
- confirm no white saturation and acceptable FPS before adding any later assembly/webcam stages.


## Stage 2.1 — Local index-finger tracking (V10.1)

Implemented:
- official `@mediapipe/tasks-vision@1.0.1` Hand Landmarker;
- MediaPipe inference runs in a dedicated module worker;
- GPU delegate is attempted first and falls back to CPU if unavailable;
- camera starts only after explicit `CAMERA ON` interaction;
- camera is stopped and all media tracks are released on `CAMERA OFF`, Exit, and component unmount;
- only one frame is in flight at a time; stale frames are discarded instead of queued;
- tracking samples at about 15 FPS in HIGH and 10 FPS in LOW;
- index fingertip landmark 8 becomes the humanoid head target;
- camera X is mirrored for natural mirror-like control;
- fingertip target is smoothed before the existing head-motion smoothing;
- camera target has priority while enabled; when no hand is visible the head returns gently to neutral;
- mouse tracking remains available when camera is off;
- no gesture actions added;
- camera status, hand-found state, delegate, tracking FPS, inference time, and pre-camera UI FPS are visible only in Technical details except for the compact active indicator;
- AUTO render quality can still fall back to LOW if the added tracking load reduces UI FPS.

Privacy / loading:
- camera frames are processed on-device by MediaPipe Tasks and are not recorded or uploaded by ASTRA;
- MediaPipe WASM is loaded from the pinned 1.0.1 jsDelivr package;
- the official float16 Hand Landmarker task model is loaded from Google's MediaPipe model hosting;
- no paid service or API key is required.

Verification required:
- production CI build with the worker bundle;
- browser permission flow on the target PC;
- CAMERA ON/OFF resource cleanup;
- hand-found/no-hand return-to-neutral behavior;
- responsiveness comparison using Pre-camera FPS vs current FPS;
- confirm mouse fallback still works with camera off.


## Stage 3 — Dynamic State Engine (V11)

Goal: create distinct Idle, Listening, Thinking and Speaking visuals from the single approved ASTRA Idle artwork. No new state images are generated.

Implemented:
- the approved `astra-idle-v1.webp` remains the only artwork source;
- sampled particles are additionally classified into cyan-energy samples, warm/orange samples, silhouette edges and six radial face-out zones;
- state changes use a 680 ms radial transition that starts at the face and spreads outward;
- rapid state changes target the newest state immediately instead of queueing old animations;
- Listening increases cyan/head energy and subtle attention pulsing;
- Thinking increases orange neural-core energy with a slow processing pulse;
- Speaking increases face/core energy using the existing runtime `speechLevel`;
- Idle returns all added state energy toward the neutral baseline;
- state effects reuse the same Three.js scene, particle positions, head turn, chest motion and webcam tracking;
- fixed-screen point sizing and V10 adaptive quality remain intact;
- Effects Off and reduced-motion still return toward the neutral approved artwork;
- no new artwork, external image generation, paid service or second renderer added.

Verification required:
- production CI build;
- browser test of IDLE → LISTENING → THINKING → SPEAKING and rapid state switching;
- confirm the face-out transition does not shift the humanoid;
- confirm camera tracking still works in every state;
- confirm AUTO/LOW remain responsive on the target PC.

## Stage 3.1 — Real interaction states (V11.1)

Goal: drive ASTRA avatar states from actual browser interaction events instead of preview-only or synthetic timing.

Implemented:
- browser Speech Recognition support through `SpeechRecognition` / `webkitSpeechRecognition` when available;
- microphone only starts after an explicit user click;
- actual recognition `onstart` drives `LISTENING`;
- interim transcript is shown live in the ASTRA console and fullscreen humanoid;
- final voice transcript is automatically sent through the existing `/api/agent` path;
- request start drives `THINKING`;
- `SPEAKING` starts only from the real `speechSynthesis.onstart` event;
- `onpause`, `onresume`, `onend`, and `onerror` update playback state directly;
- the old synthetic interval-based speech amplitude was removed;
- legacy `speechLevel` is retained only as a binary event-driven playback gate for renderer compatibility (1 while actual speech playback is active, 0 otherwise);
- technical diagnostics explicitly state that the playback gate is not measured audio loudness;
- starting a newer microphone interaction aborts stale requests and cancels stale speech;
- starting a newer text request aborts stale recognition/speech;
- sequence guards prevent old mic, request, or speech events from overwriting the latest interaction state;
- main ASTRA console includes MIC / STOP MIC and VOICE ON/OFF controls;
- fullscreen Humanoid includes the same MIC and VOICE controls;
- existing camera/index-finger tracking remains independent and preserved;
- browser permission errors are surfaced without inventing a listening state;
- no audio recording is stored by ASTRA.

Architecture note:
- ASTRA Brain V1 free-first decision is documented in `docs/ASTRA_BRAIN_V1.md`;
- planned brain stack: Hermes orchestration + Ollama local default + Codex engineering specialist;
- paid cloud providers remain optional and disabled by default.

Verification required:
- production CI build;
- Chrome/Edge microphone permission flow on the target PC;
- MIC -> LISTENING -> final transcript -> THINKING -> SPEAKING -> IDLE;
- stop microphone before final transcript;
- VOICE OFF path returns to idle without false SPEAKING;
- rapid voice/text interruption confirms latest-state-wins behavior;
- camera tracking remains functional while mic controls are available.

## Stage 3.2 — Voice Reactive Face (V11.2)

Goal: make the ASTRA face/core visibly react while speech playback is actually active, without pretending to measure speech loudness.

Implemented:
- V11.1 binary playback gate remains sourced from real `speechSynthesis` events;
- dedicated `voiceFace` particle subset is sampled from the approved head/face region;
- dedicated `voiceCore` particle subset is sampled from the center face/neck/core region;
- both subsets reuse the existing approved artwork and the same Three.js renderer;
- playback gate is smoothed through a fast attack / soft release envelope to avoid abrupt visual snapping;
- while actual playback is active, face and core receive orange additive energy;
- face uses a faster visual cadence while core uses a slower cadence to make the response feel layered;
- visual cadence is deterministic animation only and is not exposed or described as audio waveform/loudness;
- `speechSynthesis.onpause` sets the real playback gate to zero, so reactive face/core energy fades;
- `onresume` restores the gate and the reactive animation resumes;
- `onend`, `onerror`, cancel, newer request, and microphone takeover all remove playback energy through the existing V11.1 event wiring;
- reduced-motion keeps a steady, non-rhythmic playback energy instead of pulsing;
- Effects Off suppresses all reactive voice layers;
- HIGH quality uses brighter/larger face/core energy; LOW quality uses lighter layers;
- camera/index-finger head tracking, chat, microphone recognition, adaptive quality, and V11 radial state transitions remain intact;
- no generated image, second renderer, paid service, waveform simulation, or new external dependency was added.

Verification required:
- production CI build;
- actual response playback: face/core pulse only after speech playback starts;
- pause: reactive layers fade while the humanoid remains in speaking context;
- resume: reactive layers restart cleanly;
- voice off / stop / error: no lingering orange reactive energy;
- reduced-motion: no rhythmic pulse;
- LOW/AUTO quality remains responsive;
- camera tracking remains stable during speech playback.

## Stage 3.2.1 — Voice Face Saturation Hotfix (V11.2.1)

Reported symptom:
- during `SPEAKING`, the center face/core became a large bright yellow/orange block;
- humanoid detail was visually flattened by stacked additive layers.

Cause:
- V11.2 `voiceFace` and `voiceCore` masks accepted most bright pixels in broad central regions;
- the general warm layer, radial speaking zones, global glow, face layer, and core layer all accumulated in the same area.

Fix:
- voice face/core masks now require original warm/orange source pixels;
- face mask narrowed to the central warm face region;
- core mask narrowed to the warm lower-face/neck/core region;
- minimum source brightness raised for both voice subsets;
- speaking profile warm/zone energy reduced;
- global speaking glow reduced;
- general warm speaking contribution reduced;
- dedicated voice face/core opacity and point-size ceilings reduced substantially;
- speaking radial-zone contribution reduced and hard-capped;
- base artwork remains dominant so facial silhouette/detail stays readable;
- playback event wiring, pause/resume behavior, microphone, camera/index tracking, adaptive quality, and reduced-motion behavior are unchanged.

Verification required:
- production CI build;
- compare speaking state against the reported V11.2 screenshot;
- confirm no central yellow/orange block;
- confirm pulse remains visible but subtle;
- confirm head shape and source cyan/orange structure remain readable throughout speech.

## Stage 4 — Assembly Sequence (V12)

Goal: make ASTRA visibly construct itself from its existing particle field without blocking chat or adding another renderer.

Implemented:
- one non-blocking 2.6 second assembly timeline;
- assembly is applied inside the existing Three.js particle renderer;
- only the central humanoid is assembled; the surrounding approved artwork/background remains stable;
- source particles originate from a single left-side stream;
- deterministic per-particle timing prevents random layout changes between replays;
- assembly order is head -> neck -> shoulders -> core;
- each particle follows a smooth eased path with a small vertical/depth arc before settling into its existing V11.2.1 final position;
- final positions still receive normal head turn, chest motion, state energy, voice-reactive layers, and camera tracking;
- `REPLAY ASSEMBLY` starts a fresh timeline without resetting chat/runtime state;
- `SKIP` immediately resolves particles to their final positions;
- chat requests, microphone recognition, speech playback, and camera/index-finger tracking remain usable while assembly is running;
- reduced-motion and Effects Off resolve directly to the final approved form;
- the faint reference underlay is reduced further while assembly is active so the particle construction remains visually readable;
- no generated image, second renderer, paid service, new dependency, or change to `/api/agent` was introduced.

Verification required:
- production CI build;
- first-open automatic assembly completes in about 2.6 seconds;
- visible order reads as head -> neck -> shoulders -> core;
- REPLAY works repeatedly without particle drift;
- SKIP resolves immediately and leaves no particles stranded in the source stream;
- send chat / use mic during assembly and confirm AI interaction is not blocked;
- camera tracking continues after assembly completes;
- Effects Off and reduced-motion show the final form without forced motion;
- AUTO/LOW quality remains smooth on the target PC.

## Stage 4.0.1 — Particle Sharpness + Motion Polish (V12.0.1)

Reported feedback:
- particle field looked insufficiently sharp;
- assembly motion felt less smooth than desired.

Rendering polish:
- base HIGH point size reduced from 1.7 px to 1.45 px;
- base LOW point size reduced from 1.25 px to 1.10 px;
- glow and state-energy point sizes reduced so the source artwork remains visually crisp;
- all particle layers now use one shared procedural 32×32 round alpha texture;
- round particle mask uses linear filtering and explicit alpha testing so points read as clean dots instead of square pixels;
- HIGH renderer DPR increased from 1.25 to 1.5;
- WebGL antialiasing enabled and high-performance GPU preference requested;
- no extra image asset or external dependency added.

Motion polish:
- per-frame time-based assembly drift removed;
- cubic smoothstep replaced with quintic smootherstep for zero-velocity-like entry/settling behavior;
- assembly local window widened from 0.28 to 0.34 for gentler convergence;
- lateral curve is now deterministic from particle index and local progress instead of elapsed-time jitter;
- final particle positions, assembly order, runtime state logic, mic, speech, and camera tracking remain unchanged.

Verification required:
- production CI build;
- compare V12 vs V12.0.1 at HIGH quality;
- check face/core detail at idle and speaking;
- replay assembly several times and confirm no micro-jitter near final positions;
- verify AUTO quality can still drop to LOW when needed;
- confirm FPS remains acceptable on the target PC.

## Stage 4.0.2 — Particle Visibility Balance (V12.0.2)

Reported feedback:
- HIGH quality was active but particles were still too difficult to see;
- V12.0.1 round-mask sharpening made the effective visible dot smaller than intended on a DPR 1.5 canvas.

Cause:
- fixed-screen `PointsMaterial` sizes are evaluated in renderer pixels;
- with HIGH DPR 1.5, a 1.45 px point produced roughly sub-1 CSS-pixel visual coverage before the round alpha mask;
- the V12.0.1 alpha cutoff further reduced visible dot area.

Fix:
- HIGH base point increased to 2.25 renderer px;
- LOW base point increased to 1.35 renderer px;
- HIGH glow increased to 4.0 renderer px;
- procedural round sprite coverage widened while retaining circular falloff;
- base alpha cutoff reduced from 0.16 to 0.06;
- energy-layer alpha cutoffs reduced from 0.08 to 0.04;
- base opacity raised to 0.985 at non-speaking states;
- cyan edge and cyan-state visibility lifted moderately;
- warm/voice/core point sizes increased enough to remain visible at HIGH DPR;
- V12.0.1 quintic smootherstep and deterministic assembly curve are preserved;
- no change to particle count, artwork sampling density, camera tracking, mic, chat, state runtime, or provider architecture.

Target:
- particles should remain round and crisp, but clearly visible at normal viewing distance on the user's HIGH-quality 1.5 DPR display;
- avoid returning to the blocky/over-saturated appearance from earlier versions.

## Stage 4.0.3 — GPU Particle Performance (V12.0.3)

Goal:
- improve localhost and production smoothness without reducing HIGH visual quality.

Previous bottleneck:
- the active V12 renderer looped over every particle on the CPU every frame;
- it rewrote the base position buffer;
- it then copied updated positions into edge, warm, cyan, voice-face, voice-core, and six radial-zone geometries;
- HIGH DPR 1.5 and camera tracking amplified the visible cost on less powerful PCs.

GPU refactor:
- new `components/lab/AstraGpuParticles.tsx` is the active particle renderer;
- base artwork positions/colors and classification data are uploaded to GPU buffers once;
- head yaw/pitch rotation is calculated in the vertex shader;
- chest/breathing displacement is calculated in the vertex shader;
- V12 assembly interpolation is calculated in the vertex shader;
- deterministic assembly curve/arc remains preserved;
- state cyan/warm/zone energy is calculated from GPU attributes and small uniforms;
- voice-reactive energy remains driven by the real V11.1 playback gate;
- round particle shaping is generated directly from `gl_PointCoord` in the fragment shader;
- the active renderer uses only two particle draw passes: base Normal blending + soft Additive glow;
- CPU frame work is now limited to smoothing interaction values and updating small uniforms;
- no particle position buffer is rewritten each frame by the active renderer;
- no edge/warm/cyan/voice/zone subset geometry synchronization is performed each frame.

Quality preserved:
- HIGH DPR remains 1.5;
- V12.0.2 HIGH base size remains 2.25 renderer pixels;
- glow remains 4.0 renderer pixels in HIGH;
- V12.0.2 visibility balance remains the reference target;
- head tracking, mic, speaking states, assembly replay/skip, reduced-motion and Effects Off remain supported;
- no new image, paid service, model provider, or external dependency added.

Expected result:
- substantially lower CPU cost during particle animation;
- smoother assembly/head motion;
- better responsiveness when camera tracking is enabled;
- smaller difference between `next dev` and production runtime smoothness.

Verification required:
- production CI build;
- browser shader compilation on Chrome/Edge;
- compare FPS and Task Manager CPU/GPU before/after V12.0.3;
- test HIGH with camera off and camera on;
- replay assembly repeatedly;
- confirm IDLE/LISTENING/THINKING/SPEAKING visuals remain readable;
- confirm no regression to square particles or central color saturation.

## Stage 4.0.4 — Compositor + GPU Diagnostics (V12.0.4)

Goal:
- address remaining perceived lag after the V12.0.3 GPU particle refactor without lowering HIGH visual quality.

Remaining bottlenecks identified:
- the fullscreen Canvas still requested MSAA/antialiasing even though particle edges are already smoothed in the fragment shader;
- a fullscreen blurred energy overlay was composited over an animated WebGL canvas every frame;
- scanlines used `mix-blend-mode: screen`, forcing extra compositor work;
- console and technical panels used `backdrop-filter: blur(...)` over continuously changing WebGL content;
- the old CPU particle renderer remained as dead source in the active module, increasing development transform/HMR work;
- hardware-vs-software WebGL rendering was not visible to the user.

Fixes:
- WebGL MSAA disabled while keeping shader-smoothed round particle edges;
- HIGH DPR remains 1.5;
- fullscreen CSS blur removed from the energy overlay;
- scanline `mix-blend-mode` removed;
- console and Technical panels now use more opaque backgrounds instead of backdrop blur;
- unused legacy CPU particle renderer and subset-geometry synchronization code removed from the active Humanoid module;
- actual WebGL renderer/vendor are read from `WEBGL_debug_renderer_info` when available;
- Technical panel now reports GPU renderer, GPU vendor, and a software-renderer warning;
- SwiftShader/llvmpipe/software renderers are explicitly detected;
- particle count, point sizes, V12.0.2 visibility, V12.0.3 GPU shader motion, camera tracking, mic, voice states, replay/skip, and HIGH quality are preserved.

Important diagnostic:
- if Technical shows `Software renderer: YES`, browser hardware acceleration/GPU selection is the primary bottleneck and code-side particle optimization cannot fully compensate for it.

Verification required:
- production CI build;
- run on the target PC and inspect Technical > GPU renderer/vendor;
- compare FPS with Technical panel closed and open;
- compare `npm run dev` against `npm run build && npm run start`;
- confirm HIGH quality remains visually equivalent to V12.0.3;
- confirm no regression in particle shape, assembly, voice state, or camera tracking.

