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


## Authenticated GitHub transport

Phase 7B keeps external GitHub actions behind the same Tool Runtime:

```text
Strategist
  ↓
toolId + bounded toolInput
  ↓
Tool Runtime
  ↓
permission / policy gate
  ↓
AstraGitHubTransport
  ↓
GhCliGitHubTransport (default local provider)
  ├─ gh auth status
  ├─ git push + remote-ref verification
  ├─ gh pr create + URL verification
  └─ gh run list (read-only CI state)
```

The default GitHub provider is not considered configured merely because `gh` is installed. `gh auth status --hostname github.com` must succeed.

External writes remain Level 3:
- `github.push`;
- `github.pull-request.open`.

CI reads remain Level 1:
- `github.ci.status`.

### Tool-aware planning

Plan steps may contain:
- `toolId`;
- bounded JSON `toolInput`.

The model is given the runtime tool catalog. A tool id is still revalidated by the executor; model output is not authority. The executor also pins the plan to its resolved Project Registry project and rejects cross-project tool redirection.

Tool Runtime completion still requires `verified=true`.

Phase 7B does not bypass approval. Current normal execute approval remains the safe-local Level-2 path, so Level-3 GitHub writes wait until the scoped Level-3 approval flow is implemented.


## Scoped Level-3 approval

Phase 7C separates ordinary safe-local execution from external-action authorization.

```text
validated plan
   ↓
preflight permission scan
   ├─ Level 0–2 → normal safe-local approval path
   ├─ Level 3 → READY/policy check → one-time challenge
   └─ Level 4 → blocked
                         ↓
                 explicit UI approval
                         ↓
           input hash + token validation
                         ↓
             exact stored plan restored
                         ↓
         exact approved step ID only
                         ↓
              Tool Runtime executes
```

A Level-3 token:
- expires after five minutes;
- is process-local and single-use;
- is bound to the exact user input and exact stored plan;
- authorizes one exact Level-3 step only;
- cannot authorize Level-4;
- is not rendered to the user;
- does not bypass Tool Runtime policy/provider availability.

If a later step also needs Level 3, execution stops there and ASTRA creates a new challenge for that exact step.

Approval requests expose only safe scope metadata. File contents, PR bodies, auth tokens and other secrets are not included in the visible approval scope.

When a scoped token is submitted, ASTRA skips model replanning and restores the exact challenged plan before execution.


## Public research / browser runtime

Phase 5B/6B closes the previous Researcher gap with two read-only layers:

```text
Researcher / Strategist
        ↓
research.web (Level 1)
        ↓
AstraResearchTransport
        ↓
local SearXNG search
        ↓
bounded search results
        ↓
browser public-page fetch
        ↓
S1 / S2 / S3 + URL + extracted evidence + provenance
        ↓
Ollama reasoning / final synthesis
```

Native `browser.fetch` is always registered as a Level-1 public read tool. It does not provide search; it only reads an explicit public URL.

`research.search` and `research.web` are registered dynamically. The default provider is `SearXngResearchTransport`, and they become READY only when:
1. `ASTRA_SEARXNG_URL` is an explicit loopback endpoint; and
2. the endpoint answers a real bounded health search.

`research.web` searches first and safely fetches only a small bounded source set. Each source carries a stable per-result source ID, public URL, fetch timestamp and provenance metadata. Page text is marked untrusted and is never authority for tool calls.

The browser layer performs DNS resolution itself, rejects private/reserved addresses, pins the connection to the validated address, revalidates redirects and rejects HTTPS downgrade redirects. This prevents the Researcher from becoming a general LAN/localhost fetch primitive.

Research plan steps run through the same executable Tool Runtime and emit real `tool.started/tool.completed/tool.failed` lifecycle events. Missing search configuration fails truthfully rather than fabricating research.


## Business specialist runtime

Phase 8 keeps one shared `business` execution agent but makes the visible Finance, Sales, Marketing, Ops, Editor and Analytics roles functional through input-selected skill contracts.

```text
user business goal
      ↓
Business route
      ↓
base business-analysis skill
      +
matching specialist skill
      ├─ finance-analysis
      ├─ sales-support
      ├─ marketing-strategy
      ├─ ops-workflow
      ├─ editor-quality
      └─ analytics-interpretation
      ↓
local reasoning / bounded plan
      ↓
deterministic tool when quantitative
      ├─ business.finance.metrics
      └─ analytics.summary
```

The specialist visual node is derived from the selected skill ID, so real skill lifecycle can light Finance/Marketing/Editor/etc rather than presenting all Business work as Ops.

### Finance

`business.finance.metrics` is a Level-1 read/no-side-effect tool. Its completion means ASTRA verified the arithmetic over supplied numbers. It does not mean the accounting inputs were audited.

Missing COGS is not converted to zero. Metrics requiring COGS remain null. Optional fixed/other/tax costs omitted from input are explicitly disclosed when treated as zero for the requested arithmetic.

### Analytics

`analytics.summary` accepts bounded structured records and computes deterministic descriptive statistics. Source labels are preserved. Descriptive changes/trends are not treated as proof of cause.

### Sales / Marketing / Ops / Editor

These are implemented as local analysis/drafting skills. Their READY state never implies:
- CRM mutation;
- email/message sending;
- ad/social publishing;
- supplier actions;
- database writes;
- desktop automation.

Those capabilities require separate registered integrations/tools and their own permission/approval paths.


## Communication and cloud-file integration boundary

Phase 9 routes external account services through `AstraIntegrationTransport`.

```text
Planner / Chief
   ↓
canonical integration tool id
   ↓
Tool Runtime
   ↓
permission + policy gate
   ↓
AstraIntegrationTransport
   ↓
real provider (only when configured)
```

Default runtime state is `NOT_CONFIGURED`. A provider may expose only the exact capabilities it actually supports. Reads are Level 1. CRM writes, calendar mutation, email draft/send, and Drive upload are Level 3 external writes and therefore require the existing scoped approval path.

A provider result must include verified completion. An unverified success claim is rejected by ASTRA.


## Design and Social execution boundary

Phase 10 separates content/brief reasoning from real provider actions.

```text
Social/Design intent
   ↓
Business specialist skill
   ├─ Social drafting / content plan (reasoning)
   └─ Design visual brief (reasoning)
            ↓ when a real asset/action is requested
       Tool Runtime
            ↓
      Level-3 approval
            ↓
  AstraCreativeTransport
            ↓
 verified configured provider
```

`design.image.generate`, `design.image.edit`, `social.publish`, and `social.schedule` are Level-3 external actions. They remain `NOT_CONFIGURED` without a provider and may not claim success without verified provider evidence.


## Controlled Computer Agent boundary

Phase 11 deliberately does not expose arbitrary shell execution.

```text
Computer intent
   ↓
Planner
   ↓
canonical Computer tool
   ↓
Tool Runtime permission/policy gate
   ↓
WindowsComputerTransport
   ├─ tasklist read
   └─ fixed-allowlist app launch
```

The adapter is OFF by default. `computer.process.list` is Level 1/read. `computer.app.launch` is Level 2/local-write and also requires the shell policy allow flag because it starts a local process.

The app-launch allowlist is fixed in code. Arbitrary paths and command strings are rejected by design.

The global AbortSignal cancels in-flight Computer operations. A successfully completed app launch is not automatically reversed; STOP is cancellation, not transactional rollback.


## Multimodal input provenance boundary

Phase 12 unifies provenance and consent metadata without adding hidden visual capture.

```text
typed text / browser voice / gesture-triggered voice
              ↓
        AstraRuntime
              ↓
trusted enum/boolean inputContext
              ↓
      loopback API parser
              ↓
          Brain context
              ↓
provider sees source metadata + explicit NO VISUAL PIXELS boundary
```

Accepted message sources are currently `text` and `voice`. Gesture and camera are metadata describing the local control path when open-palm starts the microphone. No camera frame is serialized.

`visualContentProvided` must be false. Image/screen modalities are rejected until a real visual payload contract and explicitly configured provider/tool exist.

This prevents metadata from becoming a prompt-injection channel: fields are bounded enums/booleans rather than free-form strings.


## Command Center MAX runtime truth model

Phase 13 separates persistent capability readiness from transient execution state.

```text
Brain status()
   ↓
18-node base capability snapshot
   ↓
Command Center
   +
live SSE Brain/tool/approval lifecycle
   ↓
transient node overlay
   ↓
ReasoningWeb + Agent Overview + operational panel
```

Base state comes from provider/tool availability. Transient execution state comes only from real lifecycle events.

Examples:
- `agent.started` / `tool.started` → ACTIVE;
- `approval.requested` → WAITING_APPROVAL;
- `agent.blocked` → BLOCKED;
- `tool.failed` / `plan.step.failed` → ERROR;
- `response.ready` resets transient states to the latest server base snapshot.

A provider-unavailable event alone does not mark a node failed because ASTRA may continue through a valid fallback provider.

The ReasoningWeb roster now receives the runtime state for each node. Legacy visual placement remains, but static visual `live` flags are no longer authority for capability readiness.
## Automation scheduling safety foundation

Phase 14A introduces a pure scheduling/safety layer without starting a hidden background service.

```text
Automation definition
      ↓
schedule validation
      ↓
deterministic due occurrence
      ↓
permission ceiling
  ├─ Level 0–1 → eligible for unattended run
  ├─ Level 2–3 → WAITING_APPROVAL for this run
  └─ Level 4   → rejected
      ↓
future Phase 14B scheduler worker
      ↓
existing Brain / Planner / Tool Runtime
```

Current code lives in `lib/automation/`.

The layer intentionally does not persist jobs or execute tools yet. It only decides whether a bounded scheduled occurrence is due and whether the existing permission model allows that occurrence to proceed. This prevents a future scheduler from becoming an alternate path around ASTRA approvals.

Safety constants currently enforce a one-hour minimum interval, a 30-day maximum interval, and a 30-minute maximum per-run runtime. Durable storage and the worker must remain private/local and must preserve global STOP cancellation.
## Private automation store

Phase 14B adds persistence only after Phase 14A validation:

```text
private .astra/automations.json
          ↓
bounded file-size check
          ↓
strict schema normalization
          ↓
duplicate-id rejection
          ↓
Phase 14A schedule + permission validation
          ↓
validated automation definitions
```

Malformed storage fails closed and returns zero definitions. The default store is private local data and remains excluded from Git through the existing `.astra/` boundary. No background scheduler is started by the store module itself.
## Automation queue planning

Phase 14C1 adds a bounded selection layer between validated storage and the future executor:

```text
validated definitions
      ↓
deterministic due evaluation
      ↓
bounded queue plan
  ├─ Level 0–1 → ready (max 4/tick)
  ├─ Level 2–3 → waiting approval
  └─ disabled/future → not queued
      ↓
future cancellable runner
```

The queue planner is intentionally pure and emits no runtime telemetry. Lifecycle event types are contracts only until a real runner performs work.
## Read-only automation runner

Phase 14C2 adds the first real execution boundary:

```text
private validated store
      ↓
bounded queue plan
      ↓
Level 0/1 only
      ↓
durable occurrence claim
      ↓
serial injected executor
      ↓
timeout / global STOP
      ↓
real automation.* lifecycle
```

The runner is manually invoked; it does not create a hidden scheduler service. Claim-before-execute intentionally prefers at-most-once behavior over automatic retry after a process crash. Approval-gated Level 2/3 jobs remain outside the executor path.
## Automation loopback control plane

Phase 14D1 adds a local control plane without creating a public service:

```text
ASTRA UI / trusted local client
        ↓
/api/automation
        ↓
existing loopback/origin/sec-fetch guard
        ↓
x-astra-client + JSON for mutations
        ↓
bounded mutation parser
        ↓
serialized private store mutation
```

The server owns durable timestamps and preserves `lastRunAt` when a definition is edited. New definitions default to paused unless explicitly enabled.

Automation lifecycle contracts also bridge into the existing Brain event model:

```text
real automation lifecycle
        ↓
automationEventToBrainEvent()
        ↓
visualNode = Ops
        ↓
Command Center runtime overlay
```

No telemetry is fabricated merely because a definition exists. Only emitted runtime events may change the Ops node transient state.
## Scheduled approval-resume

Phase 14D2 intentionally reuses the existing Brain execution/approval pipeline:

```text
due Level 2/3 occurrence
        ↓
explicit local occurrence approval
        ↓
durable occurrence claim
        ↓
server-generated occurrence-specific Brain input
        ↓
Brain execute(requirePlan=true)
        ↓
bounded plan
   ├─ within ceiling → execute
   ├─ Level 3 tool → existing scoped Level-3 approval
   └─ above automation ceiling → BLOCKED
```

Level-3 resume sends the same occurrence-specific Brain input plus the existing approval token. Because the existing token is bound to the input hash and stored plan, it cannot be reused for a different automation id/time/goal input.

No new permanent approval store is introduced. Level 4 remains unavailable to automation.
## Automation live stream

Phase 14D3A mirrors the existing Brain SSE model for approved automation occurrences:

```text
trusted local POST
      ↓
/api/automation/run/stream
      ↓
executeApprovedAutomationOccurrence()
      ├─ automation.* events
      └─ Brain / plan / tool / approval events
      ↓
SSE brain events
      ↓
final result | error
```

The request AbortSignal is the cancellation boundary. No independent scheduler process is started by this endpoint.
## Automation events in ASTRA Runtime

Phase 14D3B1 keeps one browser event/cancellation path:

```text
automation SSE
    ↓
AstraRuntime
    ├─ shared request AbortController
    ├─ brainEvents
    ├─ brainTrace
    └─ brainStreaming
          ↓
deriveCapabilityRuntimeMap()
          ↓
Ops node / Command Center
```

There is no automation-specific event bus. The additional `automationStreaming` boolean exists only so UI controls can identify that the shared active request is an automation occurrence.
