# Phase 20 Core Release Report

The Phase 20 report generator converts **real private evidence** into the exact final-report sections required by the ASTRA MAX roadmap.

It is conservative by design:

- missing evidence => `BLOCKED`;
- runtime performance evidence is accepted only when all required ASTRA status endpoints contain real samples;
- chat-mode preflight evidence is accepted only when scenarios A–D are all captured as completed;
- chat-mode preflight alone is not full-system validation;
- runtime timing alone is not browser/Humanoid performance proof;
- manual physical gates cannot be marked PASS without:
  - a valid observation timestamp;
  - an existing evidence file under `.astra/`;
- evidence inputs must resolve to regular files inside `.astra/`; directory inputs and symlink escapes are rejected;
- the tool never reads evidence outside `.astra/`;
- generated output stays under `.astra/release/`.

## 1. Run the repository gate

```powershell
npm run release:repo-gate
```

After PASS, the command stores private evidence under:

`.astra/release/repository-gate-*.json`

## 2. Collect target-PC evidence

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\collect-target-pc-evidence.ps1
```

Optional:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\collect-target-pc-evidence.ps1 -IncludePerformance -IncludeChatPreflight -Provider auto
```

## 3. Record real manual/physical gates

Copy the schema example:

`docs/MANUAL_RELEASE_EVIDENCE.example.json`

to the private path:

`.astra/release/manual-gates.json`

A manual gate may be `PASS` only when a corresponding real evidence file exists under `.astra/`.

Required manual gates:

- `automation-approval-stop`;
- `sonor-graph-memory`;
- `browser-humanoid-performance`;
- `full-system-approved-actions`;
- `emergency-stop`;
- `windows-install-update-reinstall`.

## 4. Generate the Phase 20 report

```powershell
npm run release:core-report
```

The tool automatically discovers the latest known private artifacts when explicit paths are not supplied.

Outputs:

- `.astra/release/core-release-report-*.json`;
- `.astra/release/core-release-report-*.md`.

The Markdown report contains exactly:

- COMPLETED
- VERIFIED
- CONNECTED
- REQUIRES USER LOGIN
- REQUIRES PHYSICAL TEST
- NOT IMPLEMENTED
- SECURITY STATUS
- PERFORMANCE STATUS
- TEST STATUS
- RELEASE STATUS

Allowed release status remains:

- `READY`
- `READY WITH EXTERNAL CONFIGURATION REQUIRED`
- `BLOCKED`

A nonzero exit code with `BLOCKED` is intentional so automation cannot silently treat an incomplete core release as ready.
