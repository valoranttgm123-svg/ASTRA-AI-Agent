# ASTRA Architecture

ASTRA is one integrated AI operating environment. The Humanoid, Brain, and Command Center are different views of the same runtime, not disconnected demos.

## Layers

1. **Interface / Humanoid** — Next.js / React UI, GPU particle Humanoid, chat, microphone, gesture input, voice playback.
2. **Runtime / Event Bus** — real interaction state, request cancellation, Brain provider/events/trace.
3. **Agent API** — `/api/agent` validates requests and delegates to the stable Brain Adapter.
4. **ASTRA Brain Adapter** — routing, context assembly, provider selection, permission policy, fallback behavior.
5. **Providers** — Hermes, Ollama, Codex CLI specialist, optional cloud.
6. **Memory / Skills** — local private memory plus built-in/private route skills.
7. **Tools / MCP** — execution delegated to permitted provider capabilities; side effects are policy-gated.
8. **Command Center** — visualizes real Brain/runtime events only.

## Current V1 flow

```text
USER
  ↓
Humanoid / Chat / Mic / Gesture
  ↓
ASTRA Runtime
  ↓
POST /api/agent
  ↓
ASTRA Brain Adapter
  ├─ keyword specialist router
  ├─ local Memory retrieval
  ├─ route Skills
  ├─ permission policy
  └─ provider selection
        ↓
   engineering/GitHub:
   Codex → Hermes → Ollama → explicit cloud → routing_only

   other routes:
   Hermes → Ollama → explicit cloud → routing_only
        ↓
Brain lifecycle events
  ├─ Runtime high-level state → Humanoid
  └─ detailed trace → Command Center
```

## Provider boundary

The frontend never contains provider secrets.

Server-side provider modules:

```text
lib/brain/
  adapter.ts
  types.ts
  policy.ts
  memory.ts
  skills.ts
  hermes.ts
  ollama.ts
  codex.ts
  cloud.ts
```

### Hermes

Primary local gateway/orchestrator. It can own its own tool/MCP loop. ASTRA passes the current permission policy in provider instructions, but Hermes-side MCP permissions must also be configured to enforce side effects inside Hermes.

### Ollama

Automatic local model fallback. It is a reasoning/chat path and must not claim external actions occurred when no tools are attached.

### Codex

Engineering/GitHub specialist using the local authenticated Codex CLI.

Default sandbox is read-only. Workspace writes are permitted only when file
write is enabled and a writable Codex sandbox is configured. Managed installs
that reject `workspace-write` may use `danger-full-access` only with the
additional `ASTRA_CODEX_ALLOW_DANGER_FULL_ACCESS=true` opt-in and shell
permission. Danger mode has no OS-enforced workspace boundary.

### Optional cloud

Disabled by default. It runs only when:
- `ASTRA_CLOUD_ENABLED=true`; and
- `ASTRA_ALLOW_PAID_CLOUD=true`; and
- URL/key/model are configured.

No silent paid escalation.

## Memory and Skills

Private runtime data lives outside Git:

```text
.astra/memory.json
.astra/skills.json
```

The entire `.astra/` directory is gitignored.

Memory is retrieved by lightweight local relevance scoring with strict size caps. Skills include committed built-ins plus optional private local extensions.

Private memory is excluded from Codex/cloud by default.

## Real event rule

Command Center must never animate fake work.

Current real Brain events include:
- `request.received`
- `router.selected`
- `memory.loaded`
- `skill.selected`
- `policy.applied`
- `provider.selected`
- `provider.unavailable`
- `agent.started`
- `agent.completed`
- `agent.blocked`
- `response.ready`

Tool-level events are added only when an execution provider exposes trustworthy tool telemetry.

## Approval / permission model

Read-only reasoning/inspection is the safe default.

Configured policy flags:
- `ASTRA_REQUIRE_APPROVAL`
- `ASTRA_ALLOW_SHELL`
- `ASTRA_ALLOW_FILE_WRITE`
- `ASTRA_ALLOW_EXTERNAL_ACTIONS`
- `ASTRA_ALLOW_PAID_CLOUD`

Meaningful side effects such as external messages, file writes/deletes, repository pushes/merges, database writes, remote control, and trade execution must remain disabled unless an explicit permitted path exists.


## Sonor workflow graph bridge

The user already has a local Sonor workflow/project graph at `http://127.0.0.1:55127/#graph`.

Sonor is treated as the existing aggregation layer for Graphify, Obsidian, projects/files, and conversation-derived context:

```text
Graphify / Obsidian / Projects / Chats
                  ↓
                Sonor
                  ↓
        AstraMemorySource (sonor)
                  ↓
           Memory Manager
                  ↓
                Brain
```

ASTRA uses `lib/memory/sonor.ts` and `lib/brain/unified-memory.ts`. Sonor is disabled by default and restricted to loopback. The real local Sonor endpoint must implement or adapt to the provenance-aware contract documented in `docs/SONOR_BRIDGE.md`.

Do not use the Sonor visual graph DOM as the primary data interface if a server-side data source is available.
