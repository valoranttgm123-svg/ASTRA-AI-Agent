# ASTRA Windows Release Validation

> Read-only target-PC evidence helper.
>
> Repository CI can verify this script remains non-destructive, but the validation only counts after it is executed on the actual target Windows installation.

## Command

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\validate-windows-release.ps1
```

Optional non-default ASTRA port:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\validate-windows-release.ps1 -Port 3017
```

## What it verifies

- `ASTRA-Agent` Scheduled Task exists;
- `ASTRA-Ollama` Scheduled Task exists;
- both tasks use `RunLevel Limited`;
- task actions point to the expected ASTRA/Ollama runner scripts;
- ASTRA-Agent uses the validated port;
- desktop `ASTRA.url` points to the loopback URL;
- the ASTRA port has a listener;
- no listener on that port is bound to a non-loopback address;
- the existing read-only `self-check.ps1` succeeds.

## Evidence

The validator writes private evidence under:

`.astra/readiness/windows-release-validation-*.json`

It records installation invariants only. It deliberately writes:

`ReleaseVerdict = NOT_EVALUATED`

It does not mark Phase 19 or Phase 20 READY.

## What it does not do

- no task registration/unregistration;
- no task start/stop;
- no Git pull/reset/clean;
- no npm install/build;
- no project/private-data deletion;
- no Sonor guess;
- no Automation approval/STOP proof;
- no FPS/performance proof;
- no real full-system scenario execution.

Those remain separate target-runtime gates.
