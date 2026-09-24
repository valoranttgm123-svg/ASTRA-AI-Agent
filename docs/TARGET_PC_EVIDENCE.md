# ASTRA Target-PC Evidence Collector

This repository provides a single Windows wrapper for collecting the **read-only / non-destructive** evidence that can be automated safely on the real ASTRA PC.

It does **not** mark ASTRA READY and it does not replace the manual approval/STOP, Sonor, browser/Humanoid, or real external-action validation gates.

## Default read-only collection

Run from the actual ASTRA repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\collect-target-pc-evidence.ps1
```

Default checks:

- running-build attestation: the ASTRA server must report the same full Git commit as the clean checkout used for collection;
- Windows install preflight;
- ASTRA runtime readiness self-check;
- Windows release invariant validator;
- Automation status/safety inspection without `-RunSafeTick`.

The collector writes only private evidence under:

`.astra/readiness/`

Before writing, the Windows private-output guard rejects `.astra`, `.astra/readiness`, or an existing evidence target when it is a symbolic link, junction, or other reparse point. Evidence collection fails closed instead of following redirected private-storage paths.

Its summary always keeps:

`ReleaseVerdict = NOT_EVALUATED`

The collector now requires a clean Git working tree before it starts, verifies that the running ASTRA build reports the same commit and was built from a clean tree, persists that verified build identity in the private evidence as `Runtime.Commit` + `Runtime.WorkingTreeClean`, verifies the same build again after all probes, re-checks the repository, and records `VerifiedAtStart` / `VerifiedAtCompletion`. If the runtime build changes, the tree becomes dirty, or `HEAD` changes during collection, provenance fails and `ReadOnlyCollectionPassed` cannot be true. Phase 20 accepts the evidence only when its schema, both runtime-attestation checks, every recorded check is PASS with no duplicate names, loopback port/base URL is exact, the repository is clean, and both the evidence commit and persisted runtime-build commit match the current repository-gate evidence.

## Optional runtime performance probe

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\collect-target-pc-evidence.ps1 -IncludePerformance
```

This invokes the existing loopback-only performance harness with **zero Ollama turns** by default. It measures status endpoints; it does not claim browser/Humanoid FPS.

## Optional chat-mode full-system preflight

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\collect-target-pc-evidence.ps1 -IncludeChatPreflight -Provider auto
```

This invokes the existing Phase 17 chat-mode preflight. It does not approve writes, create PRs, send email, or modify calendar state.

## Still manual / real-environment required

Even when every collector check passes, the following remain separate:

- real Level-2/3 Automation approval behavior;
- STOP during a real running occurrence;
- real Sonor outage/degradation and active-query cancellation; retrieval/project-scope/Graphify/Obsidian provenance was already validated separately and should not be repeated;
- browser/Humanoid HIGH FPS and console measurements;
- approved external-write scenarios for configured integrations;
- emergency STOP against a real cancellable task.

A green evidence bundle means only that the included read-only checks passed.
