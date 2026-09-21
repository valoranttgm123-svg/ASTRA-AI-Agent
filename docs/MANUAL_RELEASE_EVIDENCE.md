# Recording Manual Phase 20 Gates

Some ASTRA release gates cannot be proven by repository CI alone. They require real target-PC, browser, integration, or physical STOP evidence.

Do not edit the final release status directly.

Use:

```powershell
npm run release:record-gate -- --gate <gate-id> --status <PASS|FAIL|NOT_RUN> [--evidence <private-path>] [--note "<text>"]
```

Required gate IDs:

- `automation-approval-stop`
- `sonor-graph-memory`
- `browser-humanoid-performance`
- `full-system-approved-actions`
- `emergency-stop`
- `windows-install-update-reinstall`

## PASS example

```powershell
npm run release:record-gate -- --gate browser-humanoid-performance --status PASS --evidence ".astra/performance/browser-idle-<timestamp>.json" --note "Reviewed HIGH-quality browser evidence and console state."
```

PASS is rejected unless the referenced evidence file exists under `.astra/`.

## FAIL example

```powershell
npm run release:record-gate -- --gate emergency-stop --status FAIL --evidence ".astra/validation/emergency-stop-failed.json" --note "Owned task emitted late success after STOP."
```

## Reset to NOT_RUN

```powershell
npm run release:record-gate -- --gate emergency-stop --status NOT_RUN --note "Retest required after fix."
```

The command writes only:

`.astra/release/manual-gates.json`

It does not choose READY/BLOCKED. Run the Phase 20 report generator afterward:

```powershell
npm run release:core-report
```


## Record final-report context labels

Use the context recorder for the non-gate sections of the Phase 20 report:

```powershell
npm run release:record-context -- --connected "Ollama,Codex CLI" --requires-login "Gmail OAuth,Google Calendar OAuth" --not-implemented "Screen understanding" --external-config-required true
```

Supported fields:

- `CONNECTED`;
- `REQUIRES USER LOGIN`;
- `NOT IMPLEMENTED`;
- whether external configuration remains required.

These values are bounded labels only. Secret-like material is scrubbed before it is written to the private manifest.

The command still does **not** choose the final release status.
