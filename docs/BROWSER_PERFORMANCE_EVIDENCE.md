# Browser / Humanoid Performance Evidence

ASTRA Humanoid V15 can capture real browser performance evidence from the target browser without persisting chat text or console message content.

## Where

Open:

`http://127.0.0.1:3017/lab/humanoid`

or open the Humanoid from the main ASTRA UI.

## Before capture

Set:

`QUALITY HIGH`

The performance capture button is disabled when resolved quality is LOW.

For a normal state baseline, select one of:

- IDLE
- LISTENING
- THINKING
- SPEAKING

For dynamic evidence, start:

- Assembly; or
- Shockwave

then capture while that effect is active.

## Capture

Click:

`PERF CAPTURE`

Normal states are sampled for roughly 10 seconds. Assembly/shockwave use a shorter window matching the transient effect.

The browser records only structured telemetry:

- requestAnimationFrame frame intervals;
- average FPS;
- P50/P95/max frame time;
- slow-frame count;
- viewport and DPR;
- GPU renderer/vendor and software-renderer flag;
- JS heap values when the browser exposes them;
- particle count;
- Humanoid state;
- HIGH/LOW resolved quality;
- Effects / reduced-motion / camera state;
- assembly/shockwave state;
- long-task count and total duration;
- window error count;
- unhandled rejection count;
- console error/warning counts.

It does **not** store:

- chat response text;
- prompts;
- console message content;
- microphone audio;
- camera frames;
- approval tokens;
- credentials.

## Storage

Evidence is POSTed only to the same local ASTRA server and written under:

`.astra/performance/browser-<scenario>-<timestamp>.json`

The endpoint uses the same ASTRA loopback/same-origin guard and requires the `x-astra-client` mutation header.

Every file records:

`releaseVerdict = NOT_EVALUATED`

A capture is evidence, not an automatic PASS.

## Phase 16 use

Capture at minimum:

- Idle HIGH
- LISTENING HIGH
- THINKING HIGH
- SPEAKING HIGH
- Assembly HIGH
- Shockwave HIGH

Also review the browser console manually for anything that occurred before the capture window.

Command Center and Automation-panel render evidence remain separate UI scenarios; do not claim them measured merely because the Humanoid capture passed.
