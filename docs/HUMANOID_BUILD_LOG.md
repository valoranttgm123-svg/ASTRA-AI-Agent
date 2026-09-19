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

