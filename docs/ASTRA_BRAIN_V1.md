# ASTRA Brain V1 — Architecture Decision

Status: **Approved foundation / not fully implemented yet**

## Goal

Build ASTRA as a local-first personal AI agent that remains useful without paid API usage, while keeping paid cloud models available as an explicit second-line option when they are genuinely needed.

## Architecture

```text
ASTRA UI / HUMANOID / VOICE
            |
            v
      ASTRA BRAIN ADAPTER
            |
            v
        HERMES AGENT
     /        |        \
    v         v         v
 OLLAMA     CODEX    OPTIONAL CLOUD
 LOCAL      PLUS       PROVIDERS
    \         |         /
     \        |        /
      MEMORY / SKILLS / TOOLS
```

## Provider priority

### Priority 1 — no additional API charge

1. **Ollama local**
   - default model layer;
   - local/private tasks;
   - general chat and intent classification;
   - structured output and lightweight reasoning;
   - remains available when cloud providers are unavailable.

2. **Codex through the user's existing ChatGPT/Codex access**
   - specialist for software engineering;
   - repository inspection;
   - terminal work;
   - code editing;
   - tests/builds;
   - review and verification.

This path should use the already-authorized Codex/ChatGPT workflow where possible instead of silently creating usage on a separate paid API account.

### Priority 2 — free/included provider capacity

Free or included model/provider capacity may be used when available, but ASTRA must treat rate limits and availability as non-guaranteed.

### Priority 3 — paid cloud, optional

Examples:
- OpenAI API;
- Anthropic/Claude API;
- OpenRouter or another compatible provider.

Paid providers are **OFF by default**.

ASTRA must not silently escalate a task to paid inference. A paid route requires an explicit user opt-in or a future configurable spending policy.

## Hermes role

Hermes Agent is the preferred orchestration layer for V1 because it can provide the reusable agent loop around:
- memory;
- skills;
- tools;
- MCP;
- scheduling;
- sub-agent delegation;
- provider routing.

ASTRA must not couple the frontend directly to Hermes internals.

## ASTRA Brain Adapter

ASTRA owns a stable adapter boundary:

```ts
interface AstraBrain {
  chat(input: string): Promise<unknown>;
  execute(task: unknown): Promise<unknown>;
  cancel(): Promise<void>;
  status(): Promise<unknown>;
}
```

Initial implementation target:

```text
AstraBrain
    |
    v
HermesBrainAdapter
```

Future alternatives can be added without rebuilding the UI:

```text
AstraBrain
 |- HermesBrainAdapter
 |- NativeBrainAdapter
 |- OpenAIBrainAdapter
 |- OtherProviderAdapter
```

## Routing policy

Suggested initial routing:

```text
general/private/simple work
  -> Ollama local

software engineering / repo / build / tests
  -> Codex specialist

task exceeds local/Codex route
  -> ask before paid cloud escalation
```

## Cost guard

Required before paid cloud integration:

- paid providers disabled by default;
- no paid-provider fallback without permission;
- visible provider selection in diagnostics;
- record which provider handled a task;
- add configurable spending limits before unattended paid execution.

## Security rules

- API keys and OAuth tokens never ship in browser/client bundles.
- Secrets stay server-side or in provider-specific secure local storage.
- ASTRA UI talks to the server-side brain adapter, not directly to paid providers.
- Tool actions with meaningful side effects should have explicit permission policy.
- Local Ollama remains the privacy-preferred path for sensitive local work.

## Planned implementation order

1. Finish V11.1 real interaction state wiring.
2. Add Hermes local service/adapter.
3. Connect Ollama as the default local model.
4. Route existing `/api/agent` through the brain adapter.
5. Add memory and skills.
6. Add Codex as the engineering specialist.
7. Add MCP/tools and permission controls.
8. Add paid cloud providers as disabled-by-default optional routes.

## Non-goals for V1

- No automatic paid failover.
- No browser-side provider secrets.
- No dependency on a single model vendor.
- No requirement for Claude/OpenAI API billing to make ASTRA useful.
