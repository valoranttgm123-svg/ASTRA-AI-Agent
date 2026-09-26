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

## Deterministic target execution sequence — M3

Run this sequence on one pinned target/browser environment. Record **PASS | FAIL | BLOCKED** per sub-gate. Never fabricate measurements for a state that cannot be physically/technically exercised.

### M3-0 — environment/build pin

Record before measuring:
- exact repository/runtime commit;
- clean-tree/build attestation;
- Windows version;
- CPU/GPU/RAM;
- browser/version;
- Node version;
- display resolution/DPR;
- Ollama/model;
- whether software rendering is detected.

If the runtime/build identity changes during capture, discard the affected evidence.

### M3-1 — runtime/status latency baseline

Run the loopback runtime harness without LLM turns first.

Require:
- Brain status samples;
- Automation status/service samples;
- cold + warm/P50/P95 values;
- evidence file under `.astra/performance/`;
- same clean commit before/after capture.

### M3-2 — local Ollama stream latency

When Ollama is healthy, run the harness with bounded `--ollama-turns`.

Require:
- first SSE/event timing;
- provider-selected timing where present;
- final response timing;
- no response text persisted;
- same build/commit at start and completion.

If Ollama is unavailable, record **BLOCKED/UNAVAILABLE** rather than inventing latency.

### M3-3 — six required Humanoid HIGH captures

Capture exactly:
1. IDLE;
2. LISTENING;
3. THINKING;
4. SPEAKING;
5. Assembly;
6. Shockwave.

Rules:
- resolved quality must be HIGH;
- normal runtime states must be real, not synthetic;
- LISTENING requires the owner's actual microphone session;
- SPEAKING requires actual enabled speech output;
- missing physical-device/state evidence stays BLOCKED;
- each capture must carry clean start/end runtime provenance.

### M3-4 — main UI captures

Using `/?perf=1` capture:
- MAIN IDLE;
- COMMAND CENTER with real ASTRA activity observed;
- AUTOMATION PANEL while the real panel remains open.

Do not substitute Humanoid-lab captures for these UI paths.

### M3-5 — console / renderer review

Review:
- browser console outside the capture windows;
- window errors/unhandled rejections;
- software-renderer flags;
- release-blocking WebGL/renderer issues;
- any recurring warning that indicates a real functional/performance defect.

Record the conclusion without copying sensitive console content into public Git.

### M3-6 — populate measured baseline

Only after the real captures exist:
- fill the environment table;
- fill Humanoid/UI measurements;
- fill runtime latency values;
- reference private evidence paths/IDs without committing their contents.

### M3-7 — evidence-backed optimization loop

Only when measurements show a concrete bottleneck:
1. record the before measurement;
2. identify one bounded cause;
3. apply one focused fix;
4. repeat the same measurement on the same class of environment;
5. compare before/after;
6. preserve HIGH visual quality first.

Do not create speculative performance work merely because a metric looks imperfect.

### M3-8 — release bundle

After all six required HIGH captures exist on the same clean commit, run:

`npm run release:browser-bundle`

PASS requires the bundle validator to accept every required scenario and provenance check. Individual captures alone do not satisfy the Phase-20 browser/Humanoid gate.

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
