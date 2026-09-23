# Target-PC refinement — 2026-09-23

This slice reconciles the real Windows fixes with current main through PR #188.
It does not replace the existing roadmap or declare the whole release ready.

## Reproduced defects and fixes

- Windows Tool Runtime verification could not spawn `npm.cmd` with `shell:false`
  (EINVAL). Fixed-script verification now invokes the bundled npm CLI with Node,
  retaining shell-free arguments and the existing tool permission boundary.
- A stopped `ASTRA-Agent` scheduled task left its Next server listening on 3017.
  The exact PID and command line were observed after Stop-ScheduledTask. The new
  shutdown helper validates loopback, exact checkout/Next command, PID creation
  time and bounded port release. It stopped the observed orphan successfully.
  Update/repair use it; no executable-name-wide termination or file deletion.
- Shared provider selection now reaches chat, humanoid and voice submission,
  persists across reloads and preserves the newer NVIDIA option. Selection alone
  never enables a provider, private-memory forwarding or paid cloud.
- Humanoid mobile controls are bounded/scrollable; STOP controls actual runtime.
  Removed manual fake listening/thinking/speaking controls. Approved art and HIGH
  particle fidelity are unchanged. Physical speech/gesture validation remains open.
- Codex chat/verification force read-only even when local execution is authorized.
  Optional isolated config requires an explicit model. AUTO preference for Codex
  is opt-in; explicit Ollama remains explicit.
- The official Hermes Runs transport is optional and requires an authenticated,
  reviewed read-only Sonor profile. It verifies final run state and requests remote
  STOP on cancellation. The older transport remains available.
- Sonor HTTP reads reject redirects and bound streamed payload size. Failure and
  cancellation retain the shared Memory Manager semantics.

## Evidence so far

- Full Windows suite: 414/414 passed before the added shutdown regression.
- Shutdown-script regressions: 7/7 passed, including the new guard contract.
- Codex/cancellation targeted suite: 17/17 passed, including owned descendants.
- Typecheck and lint passed; npm audit reported zero vulnerabilities.
- A fixed-delay HTTP abort fixture was changed to wait for accepted requests;
  Windows temporary-directory cleanup gets bounded retries after exit checks.
- Sonor live scope/provenance and provider evidence from 20–22 September remains
  historical evidence, not attestation of the new combined build. PR #188 records
  the independently completed live Sonor → Ollama turn.

## Preservation and remaining gates

- Existing Sonor engine has a separate local Git baseline and source-only backup.
  Private GitHub backup is not published: CLI authentication is invalid and the
  configured connector does not provide private-repository creation. No private
  vault, graph database, transcript, token or runtime configuration was uploaded.
- Background Automation remains OFF. Real exact-occurrence approval/STOP,
  clean-build performance/full-system/release evidence, physical microphone,
  camera, phone and authenticated device transport remain separate gates.
- Last real Hermes answer took roughly 129 seconds on CPU; it is not represented
  as low-latency voice readiness. NVIDIA and other unconfigured services remain
  optional/unavailable, not silently enabled.
- Next: build/install this combined source, validate the visible UI and real STOP,
  collect private runtime evidence and continue M1–M6 from the execution pointer.
