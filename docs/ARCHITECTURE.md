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


## Scoped project context

A resolved Project Registry entry is metadata until ASTRA explicitly loads registered context.

The read-only loader in `lib/projects/context.ts` is intentionally narrow:

```text
Project Registry match
      ↓
registered workspace
      ↓
docs / importantFiles only
      ↓
containment + realpath + sensitive-file checks
      ↓
bounded text read
      ↓
AstraMemorySource(sourceType=project)
      ↓
Memory Manager
      ↓
Brain
```

It never recursively scans the workspace. Relative and absolute entries are accepted only when their final real path stays inside the registered workspace. Sensitive credential/key/env paths and unsupported/binary extensions are skipped. Content remains read-only and provenance-backed.


## Strategist / Planner

Phase 4A adds real local model-backed planning without automatic execution.

```text
User goal
   ↓
Project + bounded Memory context
   ↓
shouldGeneratePlan()
   ↓
local Ollama Strategist request
   ↓
strict JSON parser
   ↓
permission floors
   ↓
createBoundedPlan()
   ↓
AstraPlan in Brain envelope
   ↓
plan.created event
```

The model output is never trusted as executable state. `createBoundedPlan()` remains the authoritative safety boundary for step count, retry, timeout, dependency and permission bounds.

Phase 4A emits only `plan.created` because no plan step has executed yet. `plan.step.started/progress/completed/failed` are reserved for Phase 5 when a real bounded executor/orchestrator exists.

Planner failure is non-fatal: ASTRA may continue the normal provider response without a plan rather than fabricating one.


## Bounded Chief Orchestrator

Phase 5A executes only validated `AstraPlan` objects.

```text
Validated AstraPlan
      ↓
permission gate
      ↓
dependency-ready step
      ↓
bounded timeout / retry / cancellation
      ↓
real step handler
      ├─ Memory Manager
      ├─ Ollama reasoning
      ├─ Codex read-only inspection
      ├─ Codex safe local execution when permitted
      └─ Codex evidence-producing verification
      ↓
real step result
      ↓
plan.step.* telemetry
      ↓
next dependency-ready step
```

The executor never marks a step completed from model prose alone. A handler must explicitly return a completed outcome. Missing Research/browser or MCP/tool capability fails or waits truthfully.

A normal explicit execute approval authorizes only the safe-local path used by this phase. Higher-impact Level 3/4 steps remain blocked/waiting for stronger scoped approval rather than inheriting that approval.

### Codex verification mode

Codex now supports a dedicated read-only verification request. It must run allowed inspection/verification commands and return the same explicit `ASTRA_EXECUTION_STATUS` marker used for evidence-sensitive execution. A textual opinion without that marker does not pass a verification step.


## Executable Tool Runtime

Phase 6A adds one shared runtime for native and future MCP tools:

```text
Brain / bounded plan
       ↓
Tool Registry metadata
       ↓
permission level gate
       ↓
ASTRA policy gate
       ↓
timeout / cancellation / bounded I/O
       ↓
real handler
       ↓
verified result required
       ↓
tool.started / tool.completed / tool.failed
       ↓
Command Center
```

A handler may not create a successful tool event merely by returning prose. `status=completed` is accepted only with `verified=true`.

### Native project context tool

`project.context.search` is the first native READY tool. It is Level 1/read-only and delegates to the existing scoped project-context loader. It cannot recursively scan the workspace or bypass registered-file/sensitive-path boundaries.

### MCP boundary

`lib/tools/mcp.ts` defines an injected transport interface. ASTRA does not auto-connect unknown MCP servers and does not mark MCP tools READY without an explicit transport instance. Discovered MCP definitions and calls still pass through the same Tool Registry permission/policy/verification executor.

The current repository includes fixture-backed MCP contract tests, **not a configured production MCP server**.


## Scoped Files and local Git workflow

Phase 7A builds local project operations on the executable Tool Runtime:

```text
registered Project Registry workspace
        ↓
central path safety
        ↓
project.file.read
        ↓
SHA precondition
        ↓
project.file.write
        ↓
read-back verification
        ↓
git diff / branch / stage
        ↓
allowlisted npm verification
        ↓
local commit + new-HEAD verification
```

File operations never scan arbitrary directories. Existing-file replacement requires a hash obtained from a prior read, preventing silent overwrite of a file that changed in between.

Local Git commands use fixed executables/argument patterns with `shell:false`, bounded output and cancellation. Staging accepts explicit safe file paths only; commit revalidates the complete staged set before running.

External GitHub actions are deliberately separate:
- `github.push` — Level 3, NOT_CONFIGURED;
- `github.pull-request.open` — Level 3, NOT_CONFIGURED.

A future authenticated GitHub transport must pass through the same Tool Runtime and approval boundary before those actions can become READY.
