# Ollama prompt prefill refinement — 23 September 2026

Baseline installed clean build: `3fa89e5e2b396056234016c5dfeab617aebada43`
(PR #213, main CI #584 SUCCESS). Keep-alive and startup preload were active.
The model was resident before this measurement; no service/model was unloaded.

Actual `/api/agent/stream`, same lightweight two-sentence API question:

| Provider selection | First token | Total | Observation |
| --- | ---: | ---: | --- |
| Ollama, first measured turn | 10,618 ms | 18,536 ms | Real result |
| Ollama, warm repeat 1 | 336 ms | 6,783 ms | Real result |
| Ollama, warm repeat 2 | 267 ms | 8,044 ms | Real result |
| AUTO | 6,737 ms | 6,773 ms | Existing explicit AUTO preference selected Codex |
| Codex | 6,245 ms | 6,282 ms | Real result |
| NVIDIA | no token | 60,012 ms | Bounded request timed out; not ready from this test |

A direct adapter boundary trace with a fresh general-question prefix isolated
another cause beyond model loading. Full prompt: 2,598 characters / 552 tokens,
40 cached; model load **3.5 ms**, uncached prompt evaluation **6,822 ms**, first
token **6,901 ms**. Identical repeat: 548 cached, prefill 255 ms, first token
286 ms. Tags took 34 ms. This is direct-adapter evidence, not instrumentation
inside Next; it explains why model residency alone cannot guarantee a fast turn.
Ollama defines these timing fields in its [chat API](https://docs.ollama.com/api/chat).

The focused correction passes the existing verified lightweight-context decision
to Ollama. Only this no-project/no-memory/no-action path uses a short stable
assistant prefix with explicit no-tools/no-visual-access/no-authority boundaries.
Trusted input metadata is retained; the full specialist, policy and untrusted
retrieval context remains unchanged for project work. Provider choice, model,
transport, keep-alive, preload, token limit and execution permissions do not change.

Direct-adapter first-prefix measurement after the correction: 478 characters /
108 prompt tokens (0 cached), first token 2,691 ms, prompt evaluation 2,387 ms.
Identical repeat: first token 333 ms. This is a measured improvement, not a
guarantee or physical voice validation. Private timing artifacts contain no
prompt or response text. Next: clean-build SSE/browser remeasurement, then
continue the remaining release gates.

The older full target-PC collection at `a50d9ba` failed chat preflight and final
attestation; it must not be labeled a completed current-build release gate.
