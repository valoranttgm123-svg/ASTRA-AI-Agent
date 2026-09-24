# Windows startup readiness probe refinement

Baseline: PR #224, production `ffb4caa`, main `0a0962a`.

## Reproduced issue

Read-only self-check reported `spawnSync powershell.exe ETIMEDOUT` for the two
Windows startup tasks even though ASTRA-Agent and ASTRA-Ollama were running.
The probe had a five-second timeout but imported `Get-ScheduledTask` and its CIM
module for only two task names. Increasing the HTTP timeout cannot fix that
independent subprocess timeout. No service restart or task reinstall is needed.

## Focused correction

Use native read-only Task Scheduler COM `Schedule.Service` / root `GetTask` for
exactly the existing two names. Keep the same hidden, no-profile subprocess and
five-second budget. Map native states explicitly. Only file-not-found HRESULT
becomes MISSING; permission/connection/other failures still propagate as ERROR.
Unknown state is UNKNOWN, never READY. This inspects installation/enabled state,
not the actual provider/listener health, which has its own checks.

## Target evidence before clean production gate

- Native in-process lookup: both tasks Running, 227 ms observed.
- Actual hidden PowerShell subprocess regression: both states returned in 964 ms.
- Absent-task read-only regression: MISSING in 790 ms, no task created/deleted.
- Ten focused tests passed, including unknown states and independent Ollama health.
- Self-check returned windowsStartupTasks READY; HTTP, Brain, Ollama, Codex,
  memory, tools and Automation store READY. Background Automation remains OFF.
- Private evidence: `.astra/readiness/self-check-2026-09-24T02-08-41-596Z.json`.

These are diagnostic/runtime observations, not a full release verdict. Final
clean-build, CI and installed-runtime results must be recorded on the PR.
No configuration, credentials, startup actions, task permissions or Sonor source
are changed. Physical voice/HP, HIGH performance, remote ASTRA integration and
comprehensive release gates remain separate.
