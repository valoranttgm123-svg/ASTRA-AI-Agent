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
npm run release:browser-bundle
npm run release:record-gate -- --gate browser-humanoid-performance --status PASS --evidence ".astra/performance/browser-release-bundle-<timestamp>.json" --note "Reviewed all six HIGH browser scenarios and console state."
```

PASS is rejected unless the referenced evidence is a non-empty regular file inside the real `.astra/` tree. The recorder also requires a clean Git working tree, re-checks that `HEAD` and cleanliness remain stable before writing, then stores the evidence SHA-256, byte size, observation timestamp, and current Git commit.

For `browser-humanoid-performance`, PASS additionally requires a valid current-commit six-scenario browser release bundle. A single IDLE/LISTENING/THINKING/SPEAKING/Assembly/Shockwave capture is never sufficient by itself. If the file changes afterward, `release:core-report` rejects the PASS until it is reviewed and recorded again.

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

The recorder also stamps the context with the current Git commit and timestamp. Phase 20 will not use stale context from another commit. On first context recording, external configuration defaults conservatively to `true` unless explicitly set to `false`.

The command still does **not** choose the final release status.
