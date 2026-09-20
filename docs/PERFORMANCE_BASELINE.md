# ASTRA Performance Baseline — Phase 16

> Fill with measured values only. Never invent benchmark numbers.

## Measurement harness

Repository-side instrumentation is available through:

```powershell
npm run perf:runtime
```

Default behavior is read-only and loopback-only:

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
--output <json-path>
```

The harness rejects non-loopback URLs. It does not execute tools, external actions, paid cloud, shell actions, or file writes through ASTRA.

Ollama measurement records timing only:

- response headers;
- first ASTRA SSE event;
- `provider.selected` event when present;
- final ASTRA result.

It does not persist the chat response text.

Generated `.astra/performance/*.json` files are private runtime artifacts and stay gitignored.

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

Browser/GPU measurements still require the real browser diagnostics for:

- GPU;
- Browser;
- Display resolution / DPR;
- Humanoid FPS;
- CPU/GPU utilization;
- browser memory;
- Command Center render behavior.

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
