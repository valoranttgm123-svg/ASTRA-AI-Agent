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

## Deterministic target evidence sequence — M1

Use this exact sequence on the target PC after the active Multi-PC defect slice is complete. Record every sub-gate as **PASS | FAIL | BLOCKED**. Do not infer neighboring gates.

### M1-0 — build and starting-state pin

Before enabling or changing Automation:

1. record the exact repository/runtime commit;
2. require the working tree/build identity required by the active release-evidence rules;
3. record whether `ASTRA_AUTOMATION_SERVICE_ENABLED` was originally enabled or disabled without exposing secret values;
4. record current service/API status and queue counts;
5. plan to restore the original enable/disable state after testing.

### M1-1 — read-only baseline

Run `validate-automation.ps1` without `-RunSafeTick`.

PASS requires:
- loopback Automation API available;
- truthful service state;
- no Level-2+ occurrence in unattended ready queue;
- no Level-4 definition loaded;
- no mutation required for the baseline check.

### M1-2 — safe Level-0/1 execution

Using only a disposable read-only definition:

1. create or select one bounded Level-0/1 occurrence;
2. run one explicit safe tick;
3. require one durable claim;
4. require real lifecycle telemetry;
5. require exactly one completion;
6. prove a repeated tick does not replay the same claimed occurrence.

### M1-3 — Level-2 waiting/denial boundary

Using a disposable Level-2 definition:

1. make one occurrence due;
2. require it to appear as waiting approval, never unattended ready;
3. deny/cancel that exact occurrence;
4. require no tool side effect;
5. require truthful denied/cancelled state;
6. require no automatic retry or silent execution.

### M1-4 — exact Level-2 approval

Using a harmless disposable Level-2 action:

1. approve only the exact due occurrence;
2. require execution once;
3. require the approval not to authorize another occurrence;
4. require no replay after refresh/restart/tick;
5. record real lifecycle evidence.

If no harmless disposable Level-2 action exists, record **BLOCKED** rather than inventing proof.

### M1-5 — Level-3 scoped approval

Only when a safe configured Level-3 provider/action exists:

1. inspect the exact scope before approval;
2. use **APPROVE ONCE**;
3. require one exact scoped execution;
4. require token/scope not to be persisted into public evidence;
5. require a second action/occurrence to need a new approval.

If no safe configured Level-3 integration exists, record **BLOCKED: external/configured Level-3 action unavailable**.

### M1-6 — STOP during active occurrence

Use a harmless cancellable occurrence:

1. prove the occurrence is actively running;
2. invoke **STOP ACTIVE** / global STOP;
3. require the owned work to settle within its bound;
4. require no late success/completed event;
5. require no automatic retry;
6. require UI, service state and Command Center telemetry to settle truthfully.

### M1-7 — restart/persistence check

When safe and required by the target gate:

1. capture the durable claim/queue state;
2. restart only the ASTRA-owned local runtime through the approved Windows path;
3. require already-claimed completed work not to replay;
4. require waiting-approval work to remain approval-bound;
5. require service/UI state to match after recovery.

### M1-8 — restore and final check

1. remove disposable definitions/evidence-only state where appropriate;
2. restore the owner's original Automation enable/disable state;
3. run the read-only validator again;
4. require no leftover active disposable occurrence;
5. record final PASS/FAIL/BLOCKED for each sub-gate.

Target-PC PASS requires the actual target behavior above. Repository CI or unit tests alone do not satisfy M1.

## Completion terminology

Use these statuses truthfully:

- **IMPLEMENTATION COMPLETE** — code, tests, control plane, safety boundary, service, UI and documentation are present.
- **CI VERIFIED** — repository quality gates pass.
- **TARGET-PC VERIFIED** — the Windows validation commands above have actually passed on the target PC with the intended local runtime.
- **PHASE 14 COMPLETE** — only after both CI VERIFIED and TARGET-PC VERIFIED are true.

Until target-PC validation is actually run, report:
`IMPLEMENTATION COMPLETE / CI VERIFIED / TARGET-PC VALIDATION REQUIRED`.
