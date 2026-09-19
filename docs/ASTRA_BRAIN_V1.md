# ASTRA Brain V1 — Architecture Decision

Status: **Brain V1 implementation complete — Brain Adapter + Event Bus + Command Center trace + Hermes/Ollama + durable local Memory/Skills + Codex engineering specialist + permission policy + explicit optional cloud guard**

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
7. ✅ Add durable local memory retrieval and skills.
8. ✅ Add Codex CLI as the engineering specialist.
9. ✅ Add ASTRA permission policy for tools/side effects.
10. ✅ Add paid cloud as an explicit disabled-by-default optional route.

## Brain V1 completion details

### Durable local Memory

Implemented in `lib/brain/memory.ts`.

Default private file:

```text
.astra/memory.json
```

The `.astra/` directory is gitignored. ASTRA never commits the user's private memory database.

Memory format:

```json
[
  {
    "id": "project-note",
    "text": "Private project context to retrieve when relevant.",
    "tags": ["project", "context"],
    "updatedAt": "2026-09-19"
  }
]
```

Retrieval is local keyword relevance ranking with entry/character caps. No vector database or paid embedding API is required for V1.

### Skills

Implemented in `lib/brain/skills.ts`.

V1 includes built-in route-specific skills for:
- orchestration;
- engineering/repository work;
- research;
- memory retrieval;
- files;
- computer operations;
- communication;
- business;
- trading safety.

Optional private/local custom skills can be stored in:

```text
.astra/skills.json
```

They are loaded only for the matching routed specialist.

### Codex engineering specialist

Implemented in `lib/brain/codex.ts`.

Engineering/GitHub routes now try the locally authenticated Codex CLI before Hermes/Ollama.

Default execution:

```text
codex exec --json --ephemeral --skip-git-repo-check --sandbox read-only --cd <workspace>
```

Properties:
- uses the existing local Codex/ChatGPT authentication;
- does not require an OpenAI API key in ASTRA;
- defaults to read-only;
- workspace writes are possible only when both `ASTRA_CODEX_SANDBOX=workspace-write` and `ASTRA_ALLOW_FILE_WRITE=true`;
- ASTRA watches the JSONL stream for the final `agent_message` / `turn.completed`;
- private ASTRA memory is excluded from Codex by default and requires `ASTRA_CODEX_INCLUDE_MEMORY=true`.

### Permission policy

Implemented in `lib/brain/policy.ts`.

Central flags:

```env
ASTRA_REQUIRE_APPROVAL=true
ASTRA_ALLOW_SHELL=false
ASTRA_ALLOW_FILE_WRITE=false
ASTRA_ALLOW_EXTERNAL_ACTIONS=false
ASTRA_ALLOW_PAID_CLOUD=false
```

The policy is:
- injected into provider instructions;
- hard-applied to Codex sandbox selection;
- hard-applied to paid-cloud eligibility;
- surfaced in Brain status/Command Center.

Hermes can host its own MCP/tool loop. ASTRA does not fabricate tool-level events that Hermes does not expose. Side-effect enforcement inside Hermes must also be configured on the Hermes/MCP side.

### Optional cloud

Implemented in `lib/brain/cloud.ts`.

Cloud is not part of the normal default path. It runs only when:

```env
ASTRA_CLOUD_ENABLED=true
ASTRA_ALLOW_PAID_CLOUD=true
```

and URL/key/model are all configured.

Private local memory is not sent to cloud unless:

```env
ASTRA_CLOUD_INCLUDE_MEMORY=true
```

### Provider order

For engineering/GitHub tasks:

```text
Codex CLI
  -> Hermes
  -> Ollama
  -> explicit cloud opt-in
  -> routing_only
```

For other tasks:

```text
Hermes
  -> Ollama
  -> explicit cloud opt-in
  -> routing_only
```

### Command Center telemetry

The real event path now includes:
- `request.received`;
- `router.selected`;
- `memory.loaded`;
- `skill.selected`;
- `policy.applied`;
- `provider.selected`;
- `provider.unavailable`;
- `agent.started`;
- `agent.completed`;
- `agent.blocked`;
- `response.ready`.

The Command Center displays provider state and feature readiness for Memory, Skills, Codex, Tools, and Cloud.

Tool-level `tool.started/tool.completed` events are intentionally not fabricated. They can be added when the execution provider exposes trustworthy tool telemetry.

## Non-goals for V1

- No automatic paid failover.
- No browser-side provider secrets.
- No dependency on a single model vendor.
- No requirement for Claude/OpenAI API billing to make ASTRA useful.

## Execution Mode V1

ASTRA now distinguishes reasoning/chat from real task execution.

UI semantics:

```text
SEND
  -> chat / analysis / planning
  -> does not grant write approval

EXECUTE TASK
  -> explicit per-request approval
  -> Brain Adapter calls the execution path
  -> local workspace tasks prefer Codex CLI in workspace-write mode
  -> non-local tool tasks can use Hermes when its tools/MCP are available
```

API request envelope:

```json
{
  "message": "fix the failing build",
  "mode": "execute",
  "approved": true
}
```

The approval flag is not enough by itself. Server-side permission policy remains the hard boundary.

For local repo/file execution, the effective Codex sandbox must be `workspace-write`. The repository includes a helper:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\enable-local-execution.ps1
```

The helper updates only local `.env.local` and enables:

```env
ASTRA_CODEX_ENABLED=true
ASTRA_CODEX_WORKDIR=<current ASTRA repo>
ASTRA_CODEX_SANDBOX=workspace-write

ASTRA_REQUIRE_APPROVAL=true
ASTRA_ALLOW_FILE_WRITE=true
ASTRA_ALLOW_SHELL=true
ASTRA_ALLOW_EXTERNAL_ACTIONS=false
ASTRA_ALLOW_PAID_CLOUD=false
```

This means:
- code/file changes inside the configured ASTRA workspace can run after the user presses `EXECUTE TASK`;
- shell commands used for local verification/builds are allowed;
- remote/external actions remain blocked;
- paid cloud remains blocked;
- `SEND` remains the normal safe chat path.

Disable local execution again with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\enable-local-execution.ps1 -Disable
```

### Execution routing

Local workspace routes:

```text
developer / github / files / computer
  -> Codex CLI workspace-write
  -> verify actual completion
  -> return executed result
```

If Codex is unavailable, ASTRA can attempt Hermes. For non-local actions, Hermes requires its own real tools/MCP configuration and ASTRA policy permission.

Ollama remains a reasoning/chat fallback and is intentionally not treated as an action executor because no external tools are attached to the Ollama fallback.

ASTRA returns `brain.execution = blocked` instead of pretending execution happened when:
- per-request approval is missing;
- Codex is read-only;
- required shell permission is disabled;
- no execution-capable provider is available.

The Command Center and Humanoid can surface `CHAT / EXECUTE` request mode and `EXECUTED / BLOCKED` state from the real Brain response.

## Humanoid event link

V14 connects the fullscreen Humanoid to the same Brain Event Bus already consumed by Command Center.

Shared source of truth:

```text
/api/agent
   |
   v
ASTRA Brain Adapter
   |
   +--> Brain lifecycle events
            |
            +--> ASTRA Runtime
                    |
                    +--> Command Center trace/nodes
                    |
                    +--> Humanoid Brain HUD + GPU event pulse
```

Humanoid visual events are derived only from real `AstraBrainEvent` records already present in the runtime. No tool-level telemetry is fabricated. When a provider returns lifecycle events only with its final response, the Humanoid displays those events after they are actually received instead of pretending they streamed during execution.

This preserves one event model for:
- provider selection;
- routing;
- memory retrieval;
- skills;
- policy;
- agent lifecycle;
- blocked/unavailable states;
- response readiness.

A future streaming telemetry stage can transport trustworthy incremental backend events through SSE/WebSocket without changing the Brain Event type contract.

## Real-time telemetry transport

V15 adds a request-scoped NDJSON transport without changing the stable Brain Adapter result contract.

```text
ASTRA Runtime
     |
     | POST /api/agent/stream
     v
request-scoped telemetry sink
     |
     v
ASTRA Brain Adapter
     |
     +--> request/router/context events
     +--> provider.selected
     +--> agent.started
     +--> provider.unavailable (real failure only)
     +--> agent.completed
     +--> response.ready
     |
     v
NDJSON packets -> Runtime -> Command Center + Humanoid
```

The sink uses Node `AsyncLocalStorage` so telemetry from concurrent requests remains request-local.

Each stream ends with the same `AstraBrainChatResult` envelope used by the normal JSON API. Runtime deduplicates final envelope lifecycle events against events already delivered incrementally.

Provider identity is carried structurally in `AstraBrainEvent.provider`; UI code does not infer provider state from labels.

This transport still does not fabricate tool-level events. If Hermes, Codex, or another execution provider later exposes trustworthy incremental tool telemetry, those events can be added to the existing stream contract.

