# NVIDIA JARVIS Model Mesh for ASTRA

ASTRA uses NVIDIA Build/NIM as an optional remote reasoning mesh rather than one monolithic model.

## Current mesh

| Profile | Model | ASTRA role |
| --- | --- | --- |
| Chief | `nvidia/nemotron-3-ultra-550b-a55b` | hardest planning, architecture, strategy, long-context reasoning |
| Deep | `z-ai/glm-5-3` | coding/research/long-horizon agentic reasoning |
| Fast | `nvidia/nemotron-3.5-lightning-30b-a3b` | routine conversation and efficient sub-agent work |
| Vision | `z-ai/glm-5-3-flash` | multimodal/image reasoning when real visual content is supplied |

The router is deterministic and policy-bounded. It does not let an LLM choose its own permissions.

NVIDIA Build currently exposes these models through trial/free prototype endpoints, but availability, quotas, and terms can change. ASTRA therefore treats the mesh as optional rather than guaranteed-free infrastructure.

## Why this is more JARVIS-like

A JARVIS-style assistant should not spend the same model budget on every request. ASTRA selects a specialist profile:

```text
actual visual payload -> Vision / GLM-5.3 Flash
developer/github/research or code-heavy task -> Deep / GLM-5.3
complex planning/business/trading/long request -> Chief / Nemotron Ultra
short routine request -> Fast / Nemotron Lightning
otherwise -> Chief
```

Codex remains the engineering executor. NVIDIA remains reasoning/chat only.

## Hosted endpoint

`https://integrate.api.nvidia.com/v1`

ASTRA permits that exact HTTPS host for hosted NVIDIA traffic. Loopback HTTP/HTTPS remains allowed for self-hosted NIM.

Lookalike remote hosts, embedded URL credentials, query strings, and fragments are rejected.

## Configuration

Create an NVIDIA Build API key and store it only in local `.env.local`:

```env
ASTRA_NVIDIA_ENABLED=true
NVIDIA_API_KEY=<YOUR_LOCAL_SECRET>
ASTRA_NVIDIA_URL=https://integrate.api.nvidia.com/v1

ASTRA_NVIDIA_MODEL_CHIEF=nvidia/nemotron-3-ultra-550b-a55b
ASTRA_NVIDIA_MODEL_DEEP=z-ai/glm-5-3
ASTRA_NVIDIA_MODEL_FAST=nvidia/nemotron-3.5-lightning-30b-a3b
ASTRA_NVIDIA_MODEL_VISION=z-ai/glm-5-3-flash

ASTRA_NVIDIA_ROUTER_MODE=auto
ASTRA_NVIDIA_THINKING=true
ASTRA_NVIDIA_AUTO_FALLBACK=false
ASTRA_NVIDIA_INCLUDE_MEMORY=false
```

Never commit the key.

`ASTRA_NVIDIA_MODEL` remains a compatibility override for the Chief profile only.

## Router modes

Default:

`ASTRA_NVIDIA_ROUTER_MODE=auto`

For diagnosis or benchmarking, it may be pinned to one profile:

- `chief`
- `deep`
- `fast`
- `vision`

Pinning changes only the reasoning model. It does not change ASTRA permissions.

## Privacy defaults

- NVIDIA provider: OFF by default.
- NVIDIA AUTO fallback: OFF by default.
- Local/Sonor/project memory sent to NVIDIA: OFF by default.
- Explicit NVIDIA mode sends the user request plus bounded ASTRA policy/skill context.
- Private memory is added only when `ASTRA_NVIDIA_INCLUDE_MEMORY=true`.

## Execution boundary

NVIDIA is reasoning/chat only.

Choosing NVIDIA and pressing EXECUTE does not grant file, shell, GitHub, email, calendar, browser mutation, or other external side effects. Real actions remain behind ASTRA Tool Runtime / Codex / Hermes permission floors and scoped approval.

Model reasoning and suggested tool calls are never authorization.

## Multimodal truth boundary

The Vision profile exists now, but ASTRA only routes to it when the runtime truthfully marks that a real visual payload has been supplied.

Camera/image/screen metadata alone is not treated as image content. Until the ASTRA multimodal transport carries actual pixels, the Vision model is configured and health-checked but is not falsely claimed as active perception.

## Runtime status

ASTRA status verifies:

1. NVIDIA URL passes the exact-host/loopback rule;
2. hosted NVIDIA has `NVIDIA_API_KEY`;
3. `/models` returns a bounded structured response;
4. all four configured mesh models are listed.

If any profile disappears, the mesh reports unavailable rather than silently substituting a different remote model.

## Target-PC activation

Repository CI validates routing with a local NIM-compatible fixture.

Real hosted readiness remains unverified until a valid API key is stored privately on the target PC and live runtime status confirms the full mesh.
