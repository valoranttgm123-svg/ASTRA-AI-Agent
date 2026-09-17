# ASTRA Humanoid Build Log

## Stage 0 — Project inspection

- Existing main interface preserved: `ApexWorld`, `AstraConsole`, `AstraRuntimeProvider`.
- Existing assistant request path preserved: `/api/agent`.
- Existing browser speech output preserved.
- Existing runtime already exposes `idle`, `listening`, `thinking`, `speaking`, `error` avatar states.
- No new paid service enabled.
- No keys moved into browser code.

## Recoverable copy

- Backup branch before the image-driven rebuild: `backup/humanoid-v8-before-image-stage`.

## Stage 1 — Approved artwork baseline + image-driven particle preview

Approved idle artwork asset: `public/assets/astra-humanoid/astra-idle-v1.webp`.

Implemented:
- original approved artwork shown as the reference view;
- image pixels sampled into a Three.js particle field;
- sampled RGB colors retained per particle;
- head samples receive rounded depth so they can turn toward the mouse;
- head motion glides instead of snapping;
- far-side detail compresses/darkens naturally through 3D rotation while additive points preserve a cyan profile glow;
- body/chest movement remains separate from head movement;
- `REFERENCE`, `PARTICLES`, and split `COMPARE` modes;
- `EFFECTS OFF` fallback;
- `prefers-reduced-motion` respected;
- technical details panel collapsed by default;
- compact `IDLE`, `LISTENING`, `THINKING`, `SPEAKING` preview controls remain outside technical details;
- main ASTRA interface now has a dedicated `HUMANOID` button;
- humanoid opens as a full-screen portal inside the existing `AstraRuntimeProvider`, so opening/closing it does not remount the assistant runtime;
- visible `EXIT` control returns to the main interface;
- request latency and FPS are shown only in Technical details;
- command input still uses the existing `/api/agent` request path.

### Current limitations / intentionally unfinished

- Only the idle artwork is approved. No listening/thinking/speaking image filenames or artwork are invented. Those preview states currently change motion/lighting only while using the approved idle artwork.
- Real microphone capture is not currently implemented in the existing ASTRA project. `beginListening/endListening` exist as runtime state hooks, but there is no browser microphone pipeline to preserve yet.
- Browser `speechSynthesis` playback is not directly analyzable through Web Audio, so speaking visuals use playback status rather than measured loudness.
- Assembly sequence, intermediate images, backdrop-specific highlight sampling, shockwave, and webcam index-finger tracking remain for later stages because no approved source files/timing have been supplied yet.

### Verification still required before merge

- GitHub Actions production build.
- Visible browser comparison between `REFERENCE` and `PARTICLES`.
- User approval of scale, alignment, particle density, color retention, and head-turn behavior.
