# ASTRA Phase 14 Automation Validation

This document is the final activation/validation checklist for the safe local Automation runtime.

## Safety contract

The production Automation contract is:

- definitions are stored privately under `.astra/automations.json` by default;
- the background service is OFF unless `ASTRA_AUTOMATION_SERVICE_ENABLED=true`;
- unattended execution ceiling is Permission Level 0/1 only;
- unattended execution uses local Ollama + bounded Brain planning + an internal hard permission ceiling;
- Permission Level 2 requires exact per-occurrence approval;
- Permission Level 3 additionally requires the existing single-use scoped approval token for the exact planned action;
- Permission Level 4 is unavailable to scheduled Automation;
- occurrences are durably claimed before execution and are not silently replayed after a crash/failure;
- only one background service tick may be active at a time;
- global STOP aborts both browser-owned Automation work and the active background service tick;
- Command Center Ops activity comes only from real `automation.*` lifecycle events.

## CI validation

Every Phase 14 milestone must pass:

```text
npm run build
npm test
npm run typecheck
npm run lint
npm audit --audit-level=high
```

Phase 14E3 also includes an end-to-end test that verifies:

1. an enabled Level-1 occurrence executes through the read-only Brain executor;
2. Brain receives `provider=ollama`, `requirePlan=true`, and `permissionCeiling=1`;
3. a due Level-2 occurrence remains in `waitingApproval`;
4. the Level-2 occurrence is not durably claimed by the unattended service;
5. the Level-1 occurrence is durably claimed;
6. a second tick does not execute the same Level-1 occurrence twice;
7. real lifecycle telemetry contains both waiting-approval and completed states.

## Target-PC activation

Automation service remains OFF unless the owner explicitly enables it.

From the repository root on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\enable-automation.ps1
```

This updates private `.env.local`, restarts the existing `ASTRA-Agent` task if present, and checks the loopback service status.

To disable it again:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\enable-automation.ps1 -Disable
```

## Target-PC read-only validation

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\validate-automation.ps1
```

The validator checks:

- loopback Automation API availability;
- service opt-in/running/tick state;
- definition and queue counts;
- no Permission Level 2+ occurrence appears in the unattended `ready` queue;
- no Level-4 definition is loaded.

To intentionally run one explicit safe Level 0/1 tick:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\validate-automation.ps1 -RunSafeTick
```

This does not approve or execute Level 2/3 work.

## UI validation

Open the ASTRA UI and verify:

1. open **AUTOMATION**;
2. service status matches the loopback service status;
3. create a definition — it must save as **PAUSED**;
4. editing is available only while paused;
5. enable a Level-1 read-only definition;
6. after a due safe tick, Ops/Command Center shows real Automation lifecycle;
7. create a Level-2 definition — it must appear under due approval, never unattended ready;
8. approve the exact Level-2 occurrence in the UI;
9. for a Level-3 tool action, inspect scope before **APPROVE ONCE**;
10. trigger **STOP ACTIVE** during a running occurrence and verify cancellation.

## Completion terminology

Use these statuses truthfully:

- **IMPLEMENTATION COMPLETE** — code, tests, control plane, safety boundary, service, UI and documentation are present.
- **CI VERIFIED** — repository quality gates pass.
- **TARGET-PC VERIFIED** — the Windows validation commands above have actually passed on the target PC with the intended local runtime.
- **PHASE 14 COMPLETE** — only after both CI VERIFIED and TARGET-PC VERIFIED are true.

Until target-PC validation is actually run, report:
`IMPLEMENTATION COMPLETE / CI VERIFIED / TARGET-PC VALIDATION REQUIRED`.
