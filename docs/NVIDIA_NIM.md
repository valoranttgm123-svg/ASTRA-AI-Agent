# NVIDIA NIM Provider for ASTRA

ASTRA supports NVIDIA Build/NIM as an optional remote reasoning provider.

## Default model

`nvidia/nemotron-3-ultra-550b-a55b`

NVIDIA Build currently lists this model as a Free Endpoint for prototyping. It is a 561B-parameter hybrid MoE model with 1M context and is positioned for agentic reasoning, coding, planning, tool calling and long-context work.

Free endpoint availability and quotas are controlled by NVIDIA and may change. ASTRA therefore treats NVIDIA as an optional provider, not as a permanent guaranteed-free dependency.

## Hosted endpoint

`https://integrate.api.nvidia.com/v1`

ASTRA only permits that exact HTTPS host for hosted NVIDIA traffic. A loopback HTTP/HTTPS URL is also allowed for a locally self-hosted NIM.

Lookalike remote hosts, embedded URL credentials, query strings and fragments are rejected.

## Configuration

Create an NVIDIA Build API key and store it only in local `.env.local`:

```env
ASTRA_NVIDIA_ENABLED=true
NVIDIA_API_KEY=<YOUR_LOCAL_SECRET>
ASTRA_NVIDIA_URL=https://integrate.api.nvidia.com/v1
ASTRA_NVIDIA_MODEL=nvidia/nemotron-3-ultra-550b-a55b
ASTRA_NVIDIA_TIMEOUT_MS=90000
ASTRA_NVIDIA_STATUS_TIMEOUT_MS=3500
ASTRA_NVIDIA_AUTO_FALLBACK=false
ASTRA_NVIDIA_INCLUDE_MEMORY=false
```

Never commit the key.

## Privacy defaults

- NVIDIA provider: OFF by default.
- NVIDIA AUTO fallback: OFF by default.
- Local/Sonor/project memory sent to NVIDIA: OFF by default.
- Selecting NVIDIA explicitly sends the user request plus bounded trusted ASTRA policy/skill context.
- Private memory is added only when `ASTRA_NVIDIA_INCLUDE_MEMORY=true`.

## Routing

```text
AUTO
  engineering -> Codex when available
  otherwise   -> Hermes -> Ollama
  optional    -> NVIDIA only when ASTRA_NVIDIA_AUTO_FALLBACK=true
  final paid generic cloud -> only when its separate policy permits

NVIDIA
  -> Nemotron Ultra directly
  -> no silent Ollama/Hermes/Codex substitution
```

## Execution boundary

NVIDIA is reasoning/chat only in the current ASTRA integration.

Choosing NVIDIA and pressing EXECUTE does not grant external side effects. File changes, shell execution, GitHub writes, email/calendar mutations and other actions continue through ASTRA Tool Runtime/Codex/Hermes permission and approval paths.

This prevents a remote reasoning model from becoming an execution-policy bypass.

## Runtime status

ASTRA status checks:

1. the configured NVIDIA URL passes the strict host/loopback rule;
2. a hosted endpoint has `NVIDIA_API_KEY`;
3. `/models` returns a bounded structured response;
4. the configured model is actually listed.

If any check fails, NVIDIA remains unavailable rather than silently substituting another remote model.

## Target-PC activation

Repository CI verifies the integration with a local fixture. Real NVIDIA hosted readiness is not claimed until the user adds a valid API key on the target PC and the runtime status reports NVIDIA available.
