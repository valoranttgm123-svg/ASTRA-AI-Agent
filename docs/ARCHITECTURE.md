# ASTRA Architecture

ASTRA keeps the original APEX-UI visual layer and adds a real agent runtime behind it.

## Layers

1. **Interface** — Next.js / React UI, orb, reasoning graph, command console.
2. **Runtime** — client state for idle, thinking, and speaking.
3. **Agent API** — loopback-only `/api/agent` validates, streams and cancels requests.
4. **Brain adapter** — chooses a specialist, retrieves context, selects an available provider and emits real events.
5. **Agents** — focused specialists such as Developer, Research, Files, GitHub, Business, and Trading.
6. **Tools** — built-in bounded read tools plus explicitly allowlisted MCP tools. Side effects use single-use approvals.
7. **Memory** — bounded documentation retrieval and opt-in private `.astra/memory/notes.jsonl`; never committed.

## Current V1 flow

```text
User command
   ↓
AstraConsole
   ↓
POST /api/agent
   ↓
Brain adapter
   ↓
specialist router + bounded memory
   ↓
Hermes / Ollama / Codex / direct tool
   ↓
NDJSON events + structured result
```

The client runtime also advances the existing orb visual from idle → thinking → speaking so the interface reacts to a real request lifecycle.

## Provider boundary

V1 contains no embedded secrets or automatic paid provider. Hermes and Ollama are loopback-only; Codex uses an already authenticated CLI and explicit per-task approval. A missing provider becomes `routing_only`, not a fake success.

Implemented structure:

```text
lib/brain/
  adapter.ts       provider and lifecycle coordinator
  hermes.ts        reviewed local gateway adapter
  ollama.ts        local model and read-only tool loop
  codex.ts         isolated Codex engineering adapter
  memory.ts        bounded retrieval and opt-in notes
  tools.ts         built-ins and MCP allowlist
  approvals.ts     single-use, task-bound approvals
  http.ts          local API boundary and validation
```

## Approval model

Read-only actions may run automatically when enabled. External or destructive actions should require explicit approval, including:

- sending email
- deleting or overwriting files
- shell/PowerShell commands with side effects
- Git push / merge
- database writes
- placing or closing trades
- shutting down or controlling a computer

The `.env.example` defaults these capabilities to disabled until configured.

The browser never receives provider keys, local filesystem roots, private memory paths, raw process errors, or model reasoning. Sonor integration is not part of this stage.
