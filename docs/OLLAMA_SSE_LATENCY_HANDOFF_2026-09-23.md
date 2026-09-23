# Ollama / Next SSE Latency Handoff — 2026-09-23

This is the durable handoff for the current ASTRA responsiveness investigation.
Do **not** restart this diagnosis from zero.

## Current repository state

- Main after reverting the failed streaming transport experiment:
  `04667ec5f464547aa19b7377b8c01a265a267d4b`
- PR #209 was merged, measured on the target PC, and proved to be a regression.
- PR #210 reverted `lib/brain/ollama.ts` exactly to the pre-#209 implementation.
- PR #210 CI #577 passed before merge.
- Target worktree: `D:\ASTRA-Worktrees\release-validation`
- Target UI: `http://127.0.0.1:3017/`
- Humanoid lab: `http://127.0.0.1:3017/lab/humanoid`
- Ollama model: `qwen3.5:4b`
- Target Ollama is CPU-only.

## Proven facts

### Raw Ollama is healthy

Target-PC raw Ollama measurement:

- first token: **681 ms**
- total: **11,488 ms**
- output chars: 485
- `ollama ps`: `qwen3.5:4b`, 3.1 GB, 100% CPU, context 4096

Earlier raw warm measurements also produced roughly 0.35–0.85 s first-token latency.

### Pre-#209 ASTRA adapter was fast outside Next

Direct `chatWithOllama()` probe using the pre-#209 implementation:

- first token: **448 ms**
- total: **9,132 ms**
- chunks: 61
- output chars: 311

Therefore the local Ollama endpoint, selected model, prompt construction, and core adapter path were not the source of the original ~30 s SSE first-token delay.

### Non-SSE ASTRA request was much faster than SSE

Explicit Ollama request to `/api/agent`:

- HTTP 200
- total: **6,450 ms**
- provider: `ollama`
- state: `completed`

### Original SSE latency problem

Explicit Ollama through `/api/agent/stream` before #209:

- request.received: 14 ms
- policy.applied: 21 ms
- provider.selected ollama: 39 ms
- agent.started: 40 ms
- first token: **29,482 ms**
- total: **37,171 ms**

This proves routing/context setup itself was fast. The large delay occurred after Ollama was selected and before the first streamed token reached the client.

A Humanoid run in the same area also showed first-token latency in the ~21–30 s range.

## Separate AUTO routing issue

Target `.env.local` contains:

```
ASTRA_AUTO_PROVIDER=codex
```

For the lightweight prompt `Jelaskan apa itu API dalam 2 kalimat.`, AUTO did:

- request.received: 14 ms
- policy.applied: 21 ms
- Codex selected: 22 ms
- Codex unavailable: 3,305 ms
- Ollama selected: 3,307 ms

So AUTO wastes ~3.3 s trying Codex first for this lightweight chat. Treat this as a separate issue from the Ollama SSE delay.

## Failed experiment — PR #209

PR #209 replaced the local Ollama streaming fetch path with Node `http.request` in an attempt to bypass the Next.js patched fetch path.

CI passed, but target-PC evidence after deploying
`fcd2610fa22195201c3b3b4dab4ca134c88a0e87` proved a regression.

Humanoid / ASTRA SSE:

- first token: **21,245 ms**
- total: **22,922 ms**

Direct post-#209 `chatWithOllama()`:

- first token: **11,586 ms**
- total: **21,548 ms**
- chunks: 59
- output chars: 344

Raw Ollama immediately afterward:

- first token: **681 ms**
- total: **11,488 ms**

Conclusion: the Node `http.request` transport did not solve the problem and introduced a direct-adapter regression. Do not reintroduce this approach without new evidence.

## Revert — PR #210

PR #210 restored `lib/brain/ollama.ts` exactly to the pre-#209 version.

- CI run #577: **SUCCESS**
- merged main: `04667ec5f464547aa19b7377b8c01a265a267d4b`

## Cold-load cause confirmed after the revert

After PR #210 was installed on the target PC, the first explicit Ollama SSE turn produced:

- first token: **10,996 ms**
- total: **19,311 ms**

Immediately before a second run, `ollama ps` showed `qwen3.5:4b` still resident with about three minutes remaining. The immediate warm SSE retest then produced:

- first token: **238 ms**
- total: **7,043 ms**

This is strong target-PC evidence that model residency/cold loading is the dominant source of the intermittent 10–30 s first-token delay. Ollama's documented default residency is five minutes; ASTRA previously did not send an explicit `keep_alive`.

The next measured fix is therefore to send a bounded/configurable Ollama `keep_alive` on ASTRA chat requests, defaulting to 30 minutes. This does not change provider routing or model selection. A later startup preload may still be useful for eliminating the very first cold turn after Ollama/Windows startup, but that is a separate optimization and should be measured independently.

## Next diagnostic step

Do **not** make another speculative transport rewrite.

Instrument the production Next.js path with temporary bounded timing telemetry around these exact boundaries:

1. entry into the Ollama provider call;
2. `listInstalledModels` / `/api/tags` start and end;
3. immediately before the `/api/chat` request;
4. response headers received;
5. first NDJSON bytes received from Ollama;
6. first parsed Ollama content token;
7. first `onToken` callback to Brain;
8. first SSE token written by `/api/agent/stream`.

The goal is to determine whether the missing seconds are:

- before the Ollama request;
- waiting for response headers;
- waiting for the first NDJSON chunk;
- inside parsing/callback delivery;
- or inside the outer Next SSE response.

Persist timings only. Do not persist prompt or response text.

## Working rule

- Measure on the target PC first.
- Fix one proven bottleneck at a time.
- No speculative provider/transport PRs.
- Do not reopen broad historical audits without new evidence.
- Preserve `.env.local`, `.astra`, Sonor data, and private runtime evidence.
- Do not upload keys or private target-PC data.

## Provider strategy after Ollama is healthy or genuinely exhausted

Do not assume Ollama must be the primary provider. After this path is either fixed or proven not worth more time, benchmark the same lightweight prompt through:

- Ollama
- NVIDIA FAST
- Codex
- Hermes
- AUTO

Compare at minimum:

- routing time;
- first-token latency;
- total latency;
- result quality / task suitability.

ASTRA should use the fastest appropriate provider for each task. Ollama remains valuable as a local/offline fallback if another provider is materially faster.

## Stop condition

If timing instrumentation isolates a platform/runtime limitation that cannot be corrected safely without disproportionate work, preserve the evidence in this document and hand the remaining implementation to Codex rather than looping on the same transport experiment.
