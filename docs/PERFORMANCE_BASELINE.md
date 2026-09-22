# ASTRA Performance Baseline — Phase 16

> Fill with measured values only. Never invent benchmark numbers.

## Measurement harness

Repository-side instrumentation is available through:

```powershell
npm run perf:runtime
```

Default behavior is read-only and loopback-only:

- verifies `/api/agent` reports a clean runtime build from the same Git commit as the checkout;
- probes `/api/agent`;
- probes `/api/automation`;
- probes `/api/automation/service`;
- collects 10 timing samples per endpoint;
- records cold, overall P50/P95, and warm summary;
- writes JSON to `.astra/performance/`;
- does **not** run an LLM turn by default.

To deliberately measure local Ollama inference through the real ASTRA SSE path:

```powershell
npm run perf:runtime -- --ollama-turns 3
```

Optional flags:

```text
--base <loopback-url>
--samples <1-100>
--timeout-ms <250-120000>
--ollama-turns <0-20>
--output <path-under-.astra/performance>
```

The harness rejects non-loopback URLs. Runtime evidence output is also confined to `.astra/performance/`: absolute or relative `--output` paths that escape that private directory are rejected, and symlinked private output directories/files are refused. It does not execute tools, external actions, paid cloud, shell actions, or file writes through ASTRA.

Ollama measurement records timing only:

- response headers;
- first ASTRA SSE event;
- `provider.selected` event when present;
- final ASTRA result.

It does not persist the chat response text.

Generated `.astra/performance/*.json` files are private runtime artifacts and stay gitignored. Release-grade runtime evidence is captured only from a clean Git working tree, requires the running ASTRA build attestation to match that commit both before measurements begin and again after they finish, and is rejected if the runtime build changes, `HEAD` changes, or the tree becomes dirty before the capture completes.

### Baseline population rule

Do not copy harness numbers into this document unless the harness was actually run on the target machine/environment being described.

Node-side runtime harness results can fill:

- Date/time;
- Commit;
- Windows version;
- CPU;
- RAM;
- Node;
- Brain status latency;
- Automation status latency;
- optional Ollama ASTRA-stream latency.

Browser/Humanoid evidence capture tooling is available in the real Humanoid V15 UI:

1. open `/lab/humanoid` (or the Humanoid overlay);
2. set `QUALITY HIGH`;
3. select/trigger the required state;
4. click `PERF CAPTURE`.

Private evidence is written to `.astra/performance/browser-*.json` and includes frame/FPS timing, viewport/DPR, GPU identity, optional browser JS heap, particle/state metadata, long-task counts, and error/warning counts without persisting message text.

### Main UI evidence probe

Repository instrumentation is available for the two non-Humanoid UI rows that were previously missing a capture path.

Open the normal ASTRA page with:

`http://127.0.0.1:3017/?perf=1`

The opt-in `PERF UI` panel can capture:

- `MAIN IDLE`;
- `COMMAND CENTER` — the capture is rejected unless real ASTRA activity is observed;
- `AUTOMATION PANEL` — the real Automation panel must stay open throughout capture.

The probe records structured frame/error/activity counters only. It does not persist prompts, responses, microphone transcripts, approval tokens, or console message text. Evidence is bound to the same clean running-build commit at capture start and completion and stored under `.astra/performance/ui-*.json` with `releaseVerdict = NOT_EVALUATED`.

This instrumentation does not fill the table automatically; target-browser execution and review remain required.

Real execution is still required for:

- actual target GPU/browser/display values;
- Humanoid HIGH measurements in each required state;
- browser console review outside the capture window;
- CPU/GPU utilization if collected by external OS/browser diagnostics;
- Command Center active render behavior using the main UI evidence probe;
- Automation panel open render behavior using the main UI evidence probe.

## Test environment

| Field | Value |
| --- | --- |
| Date/time | PENDING |
| Commit | PENDING |
| Windows version | PENDING |
| CPU | PENDING |
| GPU | PENDING |
| RAM | PENDING |
| Browser | PENDING |
| Node | PENDING |
| Ollama | PENDING |
| Model | PENDING |
| Display resolution / DPR | PENDING |

## Humanoid / UI measurements

| Scenario | FPS | CPU | Memory | Console | Notes |
| --- | ---: | ---: | ---: | --- | --- |
| Idle HIGH | PENDING | PENDING | PENDING | PENDING | |
| LISTENING | PENDING | PENDING | PENDING | PENDING | |
| THINKING | PENDING | PENDING | PENDING | PENDING | |
| SPEAKING | PENDING | PENDING | PENDING | PENDING | |
| Assembly | PENDING | PENDING | PENDING | PENDING | |
| Shockwave | PENDING | PENDING | PENDING | PENDING | |
| Command Center active | PENDING | PENDING | PENDING | PENDING | |
| Automation panel open | PENDING | PENDING | PENDING | PENDING | |

## Runtime latency

| Path | Cold | Warm | P50 | P95 | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| Brain status | PENDING | PENDING | PENDING | PENDING | |
| Local memory | PENDING | PENDING | PENDING | PENDING | |
| Project context | PENDING | PENDING | PENDING | PENDING | |
| Sonor | PENDING | PENDING | PENDING | PENDING | Only when configured |
| Ollama first response | PENDING | PENDING | PENDING | PENDING | |
| Ollama final response | PENDING | PENDING | PENDING | PENDING | |
| Codex status | PENDING | PENDING | PENDING | PENDING | |
| Command Center event render | PENDING | PENDING | PENDING | PENDING | |
| Automation status | PENDING | PENDING | PENDING | PENDING | |

## Performance rules

- Preserve approved Humanoid HIGH quality.
- Do not reduce particle count/visual quality as the first optimization.
- No per-frame full particle CPU rewrite.
- No duplicate renderer.
- No fullscreen blur/backdrop-filter regression.
- Keep event/history lists bounded.
- Measure before/after every performance change.
- Record regressions even when average FPS improves.

## Exit gate

Phase 16 is PASS only when:

- measurements are real and reproducible;
- no release-blocking console error exists;
- Humanoid HIGH quality is preserved;
- no meaningful regression is introduced by Brain/Memory/Automation/Command Center;
- any remaining bottleneck is documented with evidence.
