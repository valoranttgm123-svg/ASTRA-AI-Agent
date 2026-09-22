# Diagnostics Provider Health Handoff — 2026-09-22

Active PR: **#178**
Branch: `feature/diagnostics-provider-health`

This slice exists to save Codex target-runtime tokens by completing safe repository wiring first.

Implemented:
- existing Ollama/Codex/NVIDIA/Hermes/Cloud status probes are registered in Diagnostics;
- Codex/Cloud status uses the same ASTRA permission policy;
- disabled providers become `not_configured`;
- enabled but unreachable providers become `unavailable`;
- Sonor is intentionally only `not_configured` or `unknown` until real search/health evidence exists;
- health checks execute concurrently and preserve deterministic result order;
- cancellation/redaction behavior remains intact;
- regression tests cover truth mapping, concurrency and Sonor no-fake-health behavior.

Codex later refines/completes:
- actual target-PC provider observations;
- real Sonor availability/search evidence;
- explicit internet/connectivity probe;
- Tool Runtime recovery execution;
- offline/degradation scenario J8 evidence.

Do not mark provider or Sonor readiness from repository CI alone.
