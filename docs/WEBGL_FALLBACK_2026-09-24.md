# WebGL-unavailable fallback refinement

Installed result: PR #224 merged `0a0962a`, CI #607/#608 SUCCESS; production
`ffb4caa`, 449/449 tests and repository gate PASS. Private configuration/registry
hashes unchanged. At this morning's retest native browser WebGL was available;
the regression scenario was therefore deliberately injected in this test browser
only. Real Codex chat completed, a real Owner Mode tool started then UI STOP
settled, and the approved image/unavailable label/disabled capture controls were
visible at 390x844. No physical microphone, camera or HP was used.
Subsequent existing strict SSH identity checks returned PC2 and SNRPC2;
DeviceSNR still failed DNS. This supersedes the historical all-DNS-failed result
below but does not prove ASTRA's unfinished remote transport.

Baseline: PR #223 production `1d3fd72`, same tree as merge `bc0d2d4`.
Automated Chromium reported a browser-blocked WebGL context. This observation
does not establish that every native browser or the physical GPU is broken.

## Reproduced failure

The application shell survived, but R3F's asynchronous renderer configuration
continued rejecting on ordinary React updates: 10 errors at page load, 18 after
VOICE OFF, 28 after selecting OLLAMA. The existing React boundary did not bound
these asynchronous failures. Merely adding another render retry would not fix it.

## Correction

- Probe WebGL2 once per mounted visual component, catching denial/throws/loss.
- Release the temporary probe context before mounting the real renderer.
- Never mount R3F when the probe failed; streaming text does not retry it.
- Keep the existing SVG core frame. Humanoid fallback uses the unchanged approved
  `astra-idle-v1.webp` at full visibility, with truthful unavailable status.
- Keep HIGH artwork/particle parameters untouched when WebGL is supported.
- Disable all three performance-capture actions unless the renderer is available
  and a real GPU observation exists. Fallback must not generate 3D evidence.

A reload may retry after browser/GPU recovery; no periodic GPU retry loop,
permission changes, camera activation, secret access or Sonor changes are added.
This handles initial context denial; it is not a claim that all possible later
GPU resets have been solved. Existing supported-renderer context-loss handling
remains in place.

## Validation and limits

Targeted tests cover denied/null/throwing/lost contexts, WebGL2 selection, probe
release, artwork retention, capture guards and absence of render-driven retry.
Full tests/build/CI and production browser verification must pass before final
handoff. Record final exact-SHA results on the PR without uploading private logs.

Physical microphone/camera, HP hardware use, actual GPU HIGH performance, remote
PC transport and comprehensive core release gates remain separate. Last remote
check used existing strict-host-key SSH aliases; all three failed DNS resolution.
