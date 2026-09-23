# Target runtime recovery — 24 September 2026

Baseline: PR #222, main `0b07a4c6749ed0d8327020572994ee0b8601e003`,
GitHub Actions #604 SUCCESS. Repository was clean; no PR was open.

## Reproduced defects

1. The process occupying 127.0.0.1:3017 was `next dev`, not the installed
   production runner. `/api/agent` returned HTTP 500 with `UnhandledSchemeError`
   for `node:child_process`. Node-only instrumentation dependencies were being
   considered by the Edge compilation.
2. `ASTRA-Ollama` had exited `3221225786` (Windows console-control exit), with no
   port 11434 listener. Its script still invoked the executable in the inherited
   console, unlike the previously refined ASTRA and Hermes runners.
3. The latest historical self-check inferred Ollama READY from Strategist READY
   even when the active provider was Hermes. That is not an Ollama health check.

## Focused correction

- Follow Next's explicit `NEXT_RUNTIME === "nodejs"` conditional import pattern;
  keep all service/preload dependencies in the Node-only startup module.
  Reference: https://nextjs.org/docs/15/app/guides/instrumentation
- Launch the existing Ollama executable with a separate hidden console and wait
  for its exit. Retain loopback-only validation, current model storage and the
  existing scheduled task; no extra watchdog/task or public port.
- Reuse the already-executed independent Ollama probe in Brain feature status.
  Release readiness uses this probe. Legacy alternate-provider status without
  an Ollama probe is UNKNOWN, never guessed READY from Strategist.

## Target checks before the production gate

- Same development URL returned valid status after the instrumentation patch.
- While Ollama was still stopped, status correctly returned
  `features.ollama.available=false` while Hermes remained the selected provider.
- Starting the existing ASTRA-Ollama task restored `/api/version` (0.34.2),
  then the real Brain probe reported qwen3.5:4b available.
- The existing harmless Owner Mode validator passed: exit 0, marker returned,
  routing-only provider, memory count 0, no plan and real tool lifecycle events.
- 11 targeted regression tests passed; typecheck and lint passed (one preexisting
  unused catch binding in the recent Computer fast path).

These are targeted checks, not final release attestation. Development mode may
retain an earlier startup build label after hot reload. Production validation
must use a clean committed build and fresh evidence after installation.

## Still separate / not claimed

Physical microphone and camera, HP hardware interaction, remote-node transport,
NVIDIA latency, comprehensive browser/GPU recovery, full automation/permission
scenarios, and all remaining M1–M6/Phase-30 release gates. Local Owner Mode is not
proof of remote administration. Sonor graph/vault and credentials remain private
and unchanged. Record final CI/install results on this PR after the clean build.
