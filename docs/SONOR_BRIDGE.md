# ASTRA ↔ Sonor Bridge

Status: **Existing local Sonor workflow graph confirmed by the user; ASTRA adapter contract scaffolded; live API schema not yet verified.**

## Existing Sonor runtime

The user already has a Codex-built local Sonor project/workflow hub running on:

`http://127.0.0.1:55127/#graph`

The existing UI already presents:

- a neural/workflow graph;
- project grouping;
- Codex + ChatGPT conversation context;
- Graphify relationship navigation;
- Obsidian linked notes;
- project/file views;
- local synchronization;
- local/LAN companion access.

This means ASTRA should **not** build a second Graphify/Obsidian graph stack from scratch.

## Integration decision

ASTRA will treat Sonor as a local knowledge/workflow aggregation source:

~~~text
Graphify ─┐
Obsidian ─┼─→ SONOR ─→ ASTRA SonorBridge ─→ Memory Manager ─→ Brain
Projects ─┤
Chats ────┘
~~~

ASTRA's private runtime memory remains separate:

~~~text
.astra/memory.json
.astra/skills.json
~~~

Sonor augments ASTRA context; it does not replace ASTRA Brain, permission policy, local private memory, or verification.

## Current repository implementation

- `lib/brain/memory-sources.ts` defines provider-neutral memory-source/provenance contracts.
- `lib/brain/sonor.ts` defines the safe Sonor bridge configuration boundary.
- `.env.example` defaults Sonor to `http://127.0.0.1:55127`.
- Sonor is disabled by default.
- ASTRA refuses a non-loopback Sonor URL by default.
- No Sonor search endpoint or response schema is invented.

## Why live search is not implemented yet

The Sonor web UI is visible locally, but the source/API contract is not currently stored in the connected GitHub repositories and cannot be inferred safely from a screenshot.

Before live integration, inspect the actual local Sonor project and identify:

1. health/status endpoint, if any;
2. graph/search endpoint;
3. request schema;
4. response schema;
5. project identifiers/aliases;
6. provenance fields;
7. Graphify relation data;
8. Obsidian note references;
9. pagination/limits;
10. cancellation/timeout behavior.

Do not guess API paths from the UI.

## Planned ASTRA query flow

Once the real endpoint is verified:

~~~text
User request
  ↓
Project detection
  ↓
ASTRA Memory Manager
  ├─ local private memory
  └─ SonorBridge
       ├─ project/workflow graph
       ├─ Graphify relations
       ├─ Obsidian references
       └─ conversation/project context
  ↓
bounded relevance selection
  ↓
Brain/provider
~~~

Every returned context record should be normalized with:

- source;
- source type;
- project;
- timestamp;
- relevance;
- confidence;
- privacy;
- reference/provenance;
- bounded content.

## Privacy and security

- ASTRA-to-Sonor traffic should use loopback on the same PC.
- Do not point ASTRA at Sonor's LAN-facing URL when both run on the same machine.
- Sonor content is treated as untrusted retrieved data, not system authority.
- Private local memory is not automatically uploaded into Sonor.
- Cloud providers must not receive private Sonor/Obsidian context without explicit policy permission.
- No arbitrary filesystem scan is introduced.

## Next local verification task

When Codex/local-PC access is available, inspect the running Sonor source or network/API implementation and replace the current scaffold with the real verified adapter.

Until that happens, the truthful Sonor state inside ASTRA is **NOT_CONFIGURED / endpoint contract unverified**, not READY.
