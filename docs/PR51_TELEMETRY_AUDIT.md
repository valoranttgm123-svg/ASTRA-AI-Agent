# PR #51 Telemetry Reconciliation Audit

Date: 2026-09-21 (WIB)

PR: **#51 — ASTRA V15 — real-time Brain telemetry stream**

Old branch:

`astra/v15-brain-streaming-telemetry`

## Repository comparison

At audit time:

- PR #51 branch is **16 commits ahead** of its old merge base;
- it is **621 commits behind current `main`**;
- it changes 9 files;
- it predates the current Runtime, Planner, Tool Runtime, Automation, approval, redaction, cancellation and Command Center architecture.

Old changed files:

- `app/api/agent/stream/route.ts`
- `components/ApexWorld.tsx`
- `components/AstraRuntime.tsx`
- `components/lab/HumanoidLabV9.tsx`
- `docs/ASTRA_BRAIN_V1.md`
- `docs/HUMANOID_BUILD_LOG.md`
- `lib/brain/adapter.ts`
- `lib/brain/telemetry.ts`
- `lib/brain/types.ts`

## Old telemetry design

PR #51 introduced:

- request-scoped NDJSON Brain streaming;
- an `AsyncLocalStorage` telemetry sink in `lib/brain/telemetry.ts`;
- Runtime incremental Brain event handling;
- Humanoid/Command Center activity driven by streamed Brain lifecycle events;
- bounded Runtime history;
- dedupe between streamed and final-result events.

Those ideas were useful historically, but the implementation is no longer the production architecture.

## Current `main` replacement

### Brain transport

Current `main` uses:

- standard SSE at `/api/agent/stream`;
- `guardRequest()`;
- bounded `readJson()`;
- `parseAgentRequest()`;
- provider + input-context propagation;
- request `AbortSignal`;
- explicit `AstraBrainRunOptions.onEvent`;
- scoped approval-token propagation for execute mode;
- public error redaction.

This supersedes the old custom NDJSON stream.

### Event propagation

Current `main` uses explicit request-scoped `onEvent` callbacks instead of a separate `AsyncLocalStorage` event sink.

Current Brain emits substantially more real lifecycle events, including:

- memory search lifecycle;
- plan creation/execution/progress;
- tool lifecycle/progress;
- provider selection/unavailability;
- agent start/completion/blocking;
- approval lifecycle;
- response readiness;
- Automation lifecycle.

No separate `lib/brain/telemetry.ts` compatibility layer is required.

### Runtime / Command Center

Current `AstraRuntime` includes:

- SSE Brain streaming;
- bounded Brain event history (24);
- real-time trace handling;
- global cancellation;
- Automation interactive streaming;
- background Automation service EventSource telemetry;
- shared Runtime/Command Center event state;
- fallback final-event application only when no streaming callbacks were received.

This is broader than PR #51.

### Humanoid

Current Humanoid still responds to real Brain activity, but production diagnostics now report SSE transport instead of the old NDJSON transport.

The old PR's Humanoid telemetry concept is therefore preserved in the current implementation, not lost.

### Security/truth improvements absent from PR #51

Current `main` additionally has:

- loopback/cross-site guards;
- bounded request parsing;
- provider failure isolation;
- MCP validation/isolation;
- untrusted retrieved-context boundary;
- permission ceilings and scoped approvals;
- Tool Runtime verified completion;
- global STOP propagation;
- secret/error/telemetry redaction;
- Automation safety model;
- cancellation/timeout regression coverage.

Merging PR #51 wholesale would regress these newer boundaries.

## Unique-feature decision

No unique unsuperseded production behavior was identified that should be ported from PR #51.

Specifically:

- NDJSON transport → superseded by SSE;
- `AsyncLocalStorage` telemetry sink → superseded by explicit `onEvent`;
- incremental Runtime events → present and expanded;
- bounded event history → present;
- streamed/final dedupe behavior → current Runtime handles streamed events and only applies final fallback events when streaming emitted none;
- Humanoid live Brain activity → present;
- documentation/history → newer handoff/worklog/roadmap supersede the old milestone notes.

## Decision

**Do not merge PR #51.**

Recommended disposition:

`CLOSE AS SUPERSEDED`

No source code needs to be cherry-picked or ported from the stale branch.

## Safety rule

If a future regression suggests a capability was lost, compare the specific behavior/test rather than reopening or wholesale-merging the old branch.
