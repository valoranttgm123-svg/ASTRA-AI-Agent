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

## Stage 1 — Approved artwork baseline

Approved idle artwork name: `astra-idle-v1.png`.

Goal:
- show the untouched approved image at target size;
- preserve image proportions and colors;
- provide a reference/particle comparison control;
- keep technical controls collapsed by default;
- keep effects-off and reduced-motion support;
- do not add state artwork that has not been approved.

### Checked

- pending CI after implementation.

### Unfinished

- image-sampled particle reconstruction;
- approved listening/thinking/speaking artwork;
- assembly sequence;
- webcam finger tracking;
- audio-level analysis when a provider exposes analyzable playback.
