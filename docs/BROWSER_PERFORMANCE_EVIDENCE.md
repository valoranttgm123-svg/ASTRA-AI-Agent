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

Capture a normal state only while the real runtime is in that state:

- IDLE
- LISTENING
- THINKING
- SPEAKING

Manual fake-state buttons were removed. IDLE is available without activating
devices. LISTENING requires the owner's actual microphone session; THINKING
requires a real pending task; SPEAKING requires actual enabled speech output.
Do not synthesize a runtime state or enable microphone/camera access solely to
complete a release checklist. Missing physical evidence leaves that gate open.

For dynamic evidence, start:

- Assembly; or
- Shockwave

then capture while that effect is active.

## Capture

Click:

`PERF CAPTURE`

Normal states are sampled for roughly 10 seconds. Assembly/shockwave use a shorter window matching the transient effect.

Before sampling starts, the browser reads the running ASTRA build identity from `/api/agent`. It reads it again when sampling completes. A capture is rejected if the build commit changes, either attestation is not clean, or the evidence no longer matches the clean server checkout when it is saved. This prevents a stale browser tab or stale ASTRA server build from being labeled as current release evidence.

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


## Release bundle

Individual captures are not enough to mark the Phase 20 `browser-humanoid-performance` gate PASS.

After capturing all required HIGH scenarios on the same clean repository commit, run:

```powershell
npm run release:browser-bundle
```

The bundler requires valid current-commit captures for exactly:

- IDLE
- LISTENING
- THINKING
- SPEAKING
- Assembly
- Shockwave

Each saved browser capture now includes repository and runtime provenance:

- full Git commit;
- whether the Git working tree was clean at capture time;
- running-build commit;
- clean-build state;
- start and completion runtime-attestation flags.

The bundler rejects:

- LOW-quality captures;
- dirty-tree captures;
- captures from another Git commit;
- captures from a stale/dirty build or without start/end runtime attestation;
- missing required scenarios;
- malformed/private-path evidence.

It writes a structured snapshot under:

`.astra/performance/browser-release-bundle-<timestamp>.json`

The bundle embeds the sanitized telemetry for all six scenarios together with each source file path, SHA-256 and byte size. It still records:

`releaseVerdict = NOT_EVALUATED`

After manual review confirms the measured performance and console state are acceptable, record the gate using the **bundle**, not an individual capture:

```powershell
npm run release:record-gate -- --gate browser-humanoid-performance --status PASS --evidence ".astra/performance/browser-release-bundle-<timestamp>.json" --note "Reviewed all six HIGH browser scenarios and console state."
```

The gate recorder rejects an individual capture file for this PASS.
