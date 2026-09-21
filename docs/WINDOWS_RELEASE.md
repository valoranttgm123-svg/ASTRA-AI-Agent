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

Windows-native evidence writers use a shared private-output guard. A symlink, junction, or other NTFS reparse point at `.astra`, `.astra/readiness`, or an existing target evidence file is rejected before the writer stores JSON.

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
5. stops the ASTRA-Agent scheduled task before dependency/build refresh;
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
