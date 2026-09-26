# ASTRA Windows Local Release Operations

> Phase 19 repository tooling.
>
> These commands are designed for the local Windows installation. Repository CI can verify their source contracts, but actual install/update/reinstall behavior is not marked VERIFIED until it is executed successfully on the target Windows PC.

## Safety model

Windows release scripts must preserve these rules:

- ASTRA binds to loopback only;
- no automatic public exposure;
- no automatic paid-cloud enablement;
- no deletion of project files or Ollama models during uninstall/reinstall;
- no deletion of `.env.local` or `.astra/`;
- no `git reset --hard` or `git clean` in the updater;
- update is fast-forward only;
- tracked local modifications block automatic pull;
- self-check is read-only;
- private readiness/release evidence writers reject symbolic-link/junction/reparse-point redirects under `.astra/`;
- Sonor is never guessed READY without MEM-X.

## Read-only install preflight

Before install/update/reinstall, the Windows wrappers now run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\preflight-local.ps1
```

The preflight is read-only and verifies:

- Node.js is available and major version is **20 or newer** (matching the current CI baseline minimum);
- `npm.cmd` is available;
- `git.exe` is available;
- `package.json` and `package-lock.json` exist;
- the checkout has `.git` metadata, including Git worktree pointer files;
- the complete listener set for the requested ASTRA port is inspected;
- any non-loopback listener on that port fails preflight before install/update/reinstall can mutate the system;
- a safe existing listener is reported as `LOOPBACK_LISTENING`; otherwise the port is `FREE`;
- current elevation state is reported;
- ASTRA does **not** declare administrator privilege as a requirement;
- existing `.env.local` / `.astra` presence is reported without reading their contents.

The preflight does not register/start/stop tasks, run `npm ci`, run a build, pull Git, delete files, or change configuration.

`install-local.ps1`, `update-local.ps1`, and `reinstall-local.ps1` invoke this preflight before their first mutating operation.

## Install

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-local.ps1
```

This:

- runs `npm ci` and `npm run build` unless `-SkipBuild` is supplied;
- registers hidden limited-user logon tasks:
  - `ASTRA-Agent`;
  - `ASTRA-Ollama`;
- starts the local services;
- creates `ASTRA.url` on the desktop;
- waits on a bounded startup health gate instead of relying on a fixed sleep;
- requires ASTRA `/api/agent` to report `ready=true`;
- requires Ollama `/api/version` to report a version;
- requires the Automation service endpoint to return a service status object;
- creates the desktop shortcut only after the startup health gate passes.

Default ASTRA URL:

`http://127.0.0.1:3017/`

## Read-only self-check

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\self-check.ps1
```

Equivalent npm command:

```powershell
npm run release:self-check
```

Evidence is written under:

`.astra/readiness/`

The self-check does not start or stop services, edit configuration, approve actions, read secret values from `.env.local`, or select the Phase 20 release status.

## Safe update

Normal update:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\update-local.ps1
```

Updater behavior:

1. reads the active Git branch;
2. rejects tracked local modifications;
3. requires the active branch to match the requested branch (default `main`);
4. runs only:
   `git pull --ff-only origin main`;
5. stops the ASTRA-Agent task and its exact-checkout loopback server before dependency/build refresh;
6. runs `npm ci`;
7. runs `npm run build`;
8. re-registers/restarts the existing local install through `install-local.ps1 -SkipBuild`;
9. verifies pre-existing `.env.local` and `.astra/` still exist;
10. runs the read-only readiness self-check.

Useful options:

```powershell
# Files are already updated manually; rebuild/restart only.
powershell -ExecutionPolicy Bypass -File .\scripts\windows\update-local.ps1 -SkipPull

# Re-register/start using an already valid build.
powershell -ExecutionPolicy Bypass -File .\scripts\windows\update-local.ps1 -SkipPull -SkipBuild
```

If the update/build fails, do not mark the installation updated. Fix the reported failure first, build successfully, then run the installer or updater again.

The updater intentionally does not auto-reset or discard local tracked changes.

`stop-astra-runtime.ps1` also handles an orphaned Next child after Task Scheduler
stops its PowerShell wrapper. It refuses other checkouts/processes and checks PID
creation time before stopping the observed server. It never terminates by name.

## Reinstall / repair startup integration

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\reinstall-local.ps1
```

For an already valid build:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\reinstall-local.ps1 -SkipBuild
```

Reinstall:

- runs `npm ci` and `npm run build` **before** removing existing startup integration, unless `-SkipBuild` is explicitly used;
- if dependency install or production build fails, the existing task registrations/shortcut are left in place;
- only after a successful build removes ASTRA startup task registrations and the desktop shortcut through the existing uninstaller;
- does not delete the repository;
- does not delete Ollama models;
- does not delete `.env.local`;
- does not delete `.astra/`;
- runs the installer again;
- runs the read-only self-check.

## Uninstall startup integration only

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\uninstall-local.ps1
```

This removes:

- `ASTRA-Agent` scheduled task;
- `ASTRA-Ollama` scheduled task;
- desktop `ASTRA.url`.

It does not delete project files or models.

## Automation validation remains separate

Phase 14 target-PC validation still requires:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\validate-automation.ps1
```

Optional deliberate safe Level-0/1 occurrence:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\validate-automation.ps1 -RunSafeTick
```

Do not treat the Windows update/reinstall scripts as proof that Automation approval/STOP behavior passed.

## Sonor remains separate

Follow:

`docs/SONOR_CODEX_MISSION.md`

The readiness self-check intentionally reports Sonor as unresolved until the real local Sonor structured search API is audited and MEM-X is executed.

## Deterministic target execution sequence — M5

Run this only after the active functional defect gates are closed enough to select a release candidate. Record every sub-gate as **PASS | FAIL | BLOCKED** and preserve private owner state.

### M5-0 — release-candidate and private-state pin

Before any install/update/reinstall mutation:

1. record the exact intended release commit;
2. require a clean working tree;
3. record running ASTRA build identity;
4. privately record existence/hash/size metadata for state that must survive, including applicable `.env.local`, `.astra/` project/automation/config artifacts, without exposing contents;
5. record current startup-task/shortcut state;
6. record current loopback listener state.

Do not continue official evidence on a moving commit.

### M5-1 — read-only preflight

Run `preflight-local.ps1`.

Require:
- supported Node/npm/Git;
- expected repository metadata;
- no unsafe non-loopback listener on the ASTRA port;
- truthful elevation state;
- private-state presence reported without reading secret values.

A preflight FAIL blocks later mutation until repaired.

### M5-2 — production build/install/start

Use the approved install path for the pinned candidate.

Require:
- dependency installation/build succeeds;
- ASTRA-Agent and ASTRA-Ollama tasks are registered with the intended bounded/user context;
- startup health gate succeeds;
- ASTRA reports ready only on loopback;
- Ollama version/model status is truthful;
- Automation service endpoint responds truthfully;
- desktop launcher/shortcut resolves to the intended loopback ASTRA URL.

### M5-3 — startup/restart invariants

Using the native read-only task/runtime probes:

1. verify exact scheduled-task identity/principal/path invariants;
2. stop/restart only ASTRA-owned runtime through approved scripts when required;
3. require no orphaned wrong-checkout server;
4. require the expected runtime commit after restart;
5. require no public/non-loopback listener.

### M5-4 — provider and subsystem truth

Capture truthful target status for:
- Ollama/model;
- Codex;
- Automation;
- Sonor;
- any enabled NVIDIA/cloud provider;
- private runtime directories.

Do not turn NOT_CONFIGURED/OFFLINE/BLOCKED into READY.

### M5-5 — actual update path

PASS requires a real supported transition into the pinned candidate, for example from a known safe ancestor/installed release using the normal fast-forward updater.

Require:
- tracked local changes block automatic update;
- update uses fast-forward only;
- dependencies/build complete;
- runtime restarts on the intended commit;
- private owner state survives;
- read-only self-check passes afterward.

If no legitimate update transition exists in the test environment, record **BLOCKED / NOT EXERCISED**. `-SkipPull` validates rebuild/restart, not the Git fast-forward update behavior.

### M5-6 — reinstall/repair path

On the pinned candidate:

1. record pre-reinstall private-state hashes/metadata;
2. run the supported reinstall/repair path;
3. require dependency/build success before destructive startup-registration removal;
4. require tasks/launcher to be restored;
5. require runtime/build identity to remain the pinned commit;
6. require private owner state to survive unchanged where preservation is required;
7. run the read-only self-check again.

### M5-7 — bounded startup health

Test the bounded startup health gate under the real installed runtime.

Require:
- readiness succeeds within the documented bound when healthy;
- a genuine startup failure does not become false READY;
- timeout/failure leaves a truthful diagnostic state;
- no unrelated process/service is killed as cleanup.

### M5-8 — final Windows evidence reconciliation

After install/update/reinstall work:
- re-check clean repository/build identity;
- re-check loopback-only listeners;
- re-check startup tasks;
- compare required private-state preservation metadata;
- run target-PC evidence collection;
- record PASS/FAIL/BLOCKED for install, update, reinstall and health separately.

Do not collapse a PASSing install into an assumed update/reinstall PASS.

## Phase 19 truth status

Repository tooling can be CI-verified.

Target-PC readiness still requires real execution evidence for:

- install path;
- startup tasks;
- loopback binding;
- Ollama/model;
- Codex;
- Automation;
- Sonor;
- private runtime directories;
- update/reinstall path;
- bounded startup health gate on the actual target PC.

Do not mark those target-PC checklist rows verified from source inspection alone.
