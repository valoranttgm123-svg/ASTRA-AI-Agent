# ASTRA Brain V1 — Architecture Decision

Status: **Phase 3 implemented — Brain Adapter + Event Bus + Command Center trace + Hermes primary local gateway + Ollama automatic local fallback; Codex execution routing still pending**

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

### Phase 2 implementation status

Implemented in code:

- `lib/brain/types.ts` defines the stable `AstraBrain` interface, provider/status types, brain events, and chat result envelope;
- `lib/brain/adapter.ts` now prefers Hermes local execution and keeps the routing-only adapter as a safe fallback;
- `lib/brain/hermes.ts` is a server-only HTTP client for the Hermes local API server;
- Hermes chat uses the OpenAI-compatible `POST /v1/chat/completions` endpoint;
- Hermes health/status uses `GET /v1/capabilities`;
- no Hermes API key is ever sent to the browser;
- `/api/agent` POST now goes through the Brain Adapter instead of importing the orchestrator directly;
- `/api/agent` GET exposes current Brain Adapter status;
- ASTRA Runtime now exposes `brainProvider`, `brainEvents`, and `brainTrace`;
- Command Center `ReasoningWeb` is driven by the real backend route trace;
- the Command Center HUD displays recent Brain events;
- provider/execution state is explicit: successful Hermes turns report `hermes / executed`; if Hermes is unavailable, ASTRA attempts local Ollama; only if both are unavailable does it fall back to `routing_only`;
- Runtime loads Brain status on startup, so Command Center can show HERMES or ROUTING_ONLY before the first chat;
- Command Center traces are now built from real Brain lifecycle events such as `provider.selected`, `agent.started`, `agent.completed`, and `provider.unavailable`.

Current event path:

```text
User / Humanoid / Console
          |
          v
     ASTRA Runtime
          |
          v
     /api/agent
          |
          v
  ASTRA Brain Adapter
          |
          +--> route specialist
          |
          +--> Hermes local gateway
          |       |
          |       +--> /v1/chat/completions
          |       +--> Hermes tools/agent loop
          |
          +--> Ollama local fallback
          |
          +--> routing-only fallback
          |
          +--> Brain lifecycle events
                  |
                  +--> Runtime event bus
                  +--> Command Center node trace
```

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

## Hermes local gateway setup

ASTRA does not call Hermes from the browser. The Next.js server route calls the local Hermes gateway on the machine running ASTRA.

Hermes side (`~/.hermes/.env`):

```env
API_SERVER_ENABLED=true
API_SERVER_KEY=choose-a-local-key
```

Start Hermes:

```bash
hermes gateway
```

ASTRA side (`.env.local`):

```env
ASTRA_HERMES_ENABLED=true
ASTRA_HERMES_URL=http://127.0.0.1:8642
ASTRA_HERMES_API_KEY=choose-a-local-key
ASTRA_HERMES_MODEL=hermes-agent
ASTRA_HERMES_TIMEOUT_MS=45000
ASTRA_HERMES_STATUS_TIMEOUT_MS=1200
```

Behavior:

- if Hermes is reachable and authorized, ASTRA executes the routed turn through Hermes;
- if Hermes is stopped, times out, returns an error, or is disabled, ASTRA automatically attempts local Ollama;
- Ollama uses the configured model, or auto-selects the first installed local model when `ASTRA_OLLAMA_MODEL` is blank;
- only if both Hermes and Ollama are unavailable does ASTRA fall back to routing-only mode;
- fallback is intentionally non-destructive: the existing Humanoid, voice, Command Center, and router remain usable;
- browser CORS configuration is not required for this path because the browser talks only to `/api/agent`, not directly to Hermes;
- no real key belongs in GitHub. Only placeholder variables are committed in `.env.example`.

## Ollama local fallback setup

ASTRA talks to the Ollama HTTP server from the Next.js server process, never directly from the browser.

Install/start Ollama and make sure at least one model exists, for example:

```powershell
ollama list
ollama pull qwen2.5:3b
```

ASTRA side (`.env.local`):

```env
ASTRA_OLLAMA_ENABLED=true
ASTRA_OLLAMA_URL=http://127.0.0.1:11434
# Optional. Blank means auto-select first installed model.
ASTRA_OLLAMA_MODEL=
ASTRA_OLLAMA_TIMEOUT_MS=60000
ASTRA_OLLAMA_STATUS_TIMEOUT_MS=1200
```

Runtime order:

```text
Hermes available
  -> Hermes executes

Hermes unavailable + Ollama available
  -> Ollama executes local model turn

Hermes unavailable + Ollama unavailable
  -> routing_only / needs_provider
```

Important limitation:
- Ollama fallback currently provides local model reasoning/chat only;
- it does not yet own GitHub, shell, email, files, or MCP tools;
- tool execution remains planned for Hermes/Codex/MCP phases;
- ASTRA explicitly instructs the Ollama fallback not to claim external actions occurred.

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

1. ✅ Finish real interaction state wiring.
2. ✅ Add stable ASTRA Brain Adapter boundary.
3. ✅ Route existing `/api/agent` through the Brain Adapter.
4. ✅ Add Brain Event Bus and Command Center trace integration.
5. ✅ Add Hermes local service/adapter.
6. ✅ Connect Ollama as the automatic local model fallback.
7. ⏳ Add memory and skills.
8. ⏳ Add Codex as the engineering specialist.
9. ⏳ Add MCP/tools and permission controls.
10. ⏳ Add paid cloud providers as disabled-by-default optional routes.

## Non-goals for V1

- No automatic paid failover.
- No browser-side provider secrets.
- No dependency on a single model vendor.
- No requirement for Claude/OpenAI API billing to make ASTRA useful.
