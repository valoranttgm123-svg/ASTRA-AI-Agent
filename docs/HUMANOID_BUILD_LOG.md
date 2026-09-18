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
