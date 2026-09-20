# ASTRA Performance Baseline — Phase 16

> Fill with measured values only. Never invent benchmark numbers.

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
