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

## Merged checkpoint and additional real findings

PR #189 merged as `2a5d2c40cddfa811c27b59aae2bfcf1795d28d8c` after CI #530 SUCCESS.
The production build passed. Mobile humanoid was visually inspected at 390×844:
provider/chat/STOP and wrapped controls fit without horizontal clipping. This is
browser viewport evidence, not a physical phone or LAN test.

The real browser sent `provider=codex`; clicking STOP aborted the HTTP request
(`net::ERR_ABORTED`) and returned the console to IDLE with no console error.
This checks browser cancellation, not a physical microphone or an approved
background occurrence. The Codex subprocess-tree regression separately passes.

Additional target-PC defects reproduced:

- Installer's fixed three-second Brain request timed out although the API was
  healthy after optional provider probes. The per-probe budget now uses the
  remaining overall deadline, capped at 15 seconds. Live health checks passed
  in approximately 4.1 seconds (Hermes unavailable) and 2.2 seconds (available).
- ASTRA and Hermes task results were `0xC000013A` (console interruption). Their
  runners now launch hidden child consoles; Hermes uses its official detached
  control-event handling. The new gateway diagnostic confirmed `detached=true`
  and `absorb_windows_console_controls=true`. Long-term/reboot soak is pending.
- The repository release-gate wrapper also spawned `npm.cmd` with `shell:false`;
  a direct probe reproduced EINVAL. It now invokes the bundled npm CLI through
  Node, with a real Windows subprocess regression. No command shell was enabled.
- Direct `powershell.exe -File scripts/windows/self-check.ps1` failed because
  `$npm` existed only in its update/collector callers. The standalone wrapper now
  resolves `npm.cmd` itself and retains native exit-code handling. A regression
  prevents caller-scope dependence; installed runtime evidence is collected after
  building this exact fix.

Clean Windows repository gate at commit `578f4e6` passed all 420 tests, typecheck,
lint, production build, dependency audit (zero vulnerabilities), and diff check.
This is repository evidence; target runtime and physical gates are separate.

Sonor recheck on 23 September: ASTRA and ALURKA each returned six scoped records
with project/Obsidian/Graphify provenance; two-stage query times were 138 ms and
79 ms. Connection-refusal fallback and pre-aborted adapter checks passed; live
in-flight cancellation remains covered by the HTTP fixture, not a portal outage.
Current Hermes health passes the reviewed profile check; this alone does not
prove model tool use or responsive voice. Current Codex actual reply took 9.4 s.

Partial Phase 14 target-PC check: a unique temporary definition saved PAUSED,
then enabling it placed Level 2 only in waitingApproval. An unapproved run
returned waiting_occurrence_approval and did not durably claim it. That exact
temporary definition was removed afterward; existing jobs were preserved.
Background service stayed OFF. Approved Level 2/3 execution and occurrence STOP
remain pending and are not inferred from this negative-path test.
