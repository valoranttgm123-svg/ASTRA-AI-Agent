# ASTRA Architecture

ASTRA keeps the original APEX-UI visual layer and adds a real agent runtime behind it.

## Layers

1. **Interface** — Next.js / React UI, orb, reasoning graph, command console.
2. **Runtime** — client state for idle, thinking, and speaking.
3. **Agent API** — `/api/agent` validates requests and hands them to the orchestrator.
4. **Orchestrator** — chooses the specialist agent and, later, the model/tool provider.
5. **Agents** — focused specialists such as Developer, Research, Files, GitHub, Business, and Trading.
6. **Tools** — future adapters for GitHub, filesystem, browser/search, email, calendar, database, and desktop control.
7. **Memory** — future short-term and durable project context. Private runtime data must not be committed.

## Current V1 flow

```text
User command
   ↓
AstraConsole
   ↓
POST /api/agent
   ↓
runAgent()
   ↓
keyword router
   ↓
specialist selected
   ↓
structured response
```

The client runtime also advances the existing orb visual from idle → thinking → speaking so the interface reacts to a real request lifecycle.

## Provider boundary

V1 intentionally contains no embedded API secrets and no hard-coded vendor dependency. A future provider adapter will live behind the orchestrator so cloud models or a local model can be swapped without rebuilding the UI.

Suggested future structure:

```text
lib/agent/
  orchestrator.ts
  roster.ts
  types.ts
  providers/
    local.ts
    cloud.ts
  tools/
    github.ts
    files.ts
    browser.ts
    email.ts
    calendar.ts
    computer.ts
  memory/
    short-term.ts
    durable.ts
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
