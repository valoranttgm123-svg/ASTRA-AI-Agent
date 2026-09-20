# ASTRA ↔ Sonor Bridge

Status: **Bridge foundation implemented. Existing Sonor UI confirmed. Real local Sonor endpoint contract still requires verification on the target PC.**

## Existing Sonor

The user already has a Codex-built Sonor project/workflow hub running locally at:

`http://127.0.0.1:55127/#graph`

The existing UI already presents:

- neural/workflow graph;
- project groupings including ALURKA, HASBI JAYA, TRADING, AI & REMOTE, DESAIN & MEDIA, and UTILITAS;
- Codex + ChatGPT conversation context;
- Graphify relationship navigation;
- Obsidian linked notes;
- project/file context;
- synchronization and LAN companion access.

Therefore ASTRA must **not** build a duplicate Graphify/Obsidian stack.

## Integration decision

~~~text
Graphify ─┐
Obsidian ─┼─→ SONOR ─→ ASTRA Sonor Memory Source ─→ Memory Manager ─→ Brain
Projects ─┤
Chats ────┘
~~~

ASTRA private runtime memory remains separate:

~~~text
.astra/memory.json
.astra/skills.json
~~~

Sonor augments ASTRA context. It does not replace Brain, permission policy, project isolation, verification, or local private memory.

## Implemented ASTRA side

- `lib/memory/contracts.ts` — existing provider-neutral memory/provenance contract.
- `lib/memory/manager.ts` — existing bounded multi-source ranking/dedupe/project isolation.
- `lib/memory/sonor.ts` — Sonor memory-source adapter.
- `lib/brain/unified-memory.ts` — combines local memory and Sonor through the same manager.
- `lib/brain/adapter.ts` — Brain context now uses the unified memory path.
- `.env.example` — Sonor configuration, disabled by default.
- tests validate:
  - loopback-only Sonor URL;
  - strict provenance-aware response parsing;
  - configured endpoint behavior;
  - Memory Manager integration;
  - Brain context consuming Sonor/Graphify records.

## Safety defaults

`ASTRA_SONOR_ENABLED=false`

Default local URL:

`http://127.0.0.1:55127`

ASTRA rejects non-loopback Sonor URLs by default. The user-facing LAN Sonor address should not be used by ASTRA when both services run on the same PC.

The search path is intentionally blank until the real local Sonor endpoint is verified.

## ASTRA-compatible bridge contract

When a verified endpoint is configured, ASTRA sends:

~~~json
{
  "query": "user query",
  "project": "optional resolved project",
  "limit": 6,
  "maxChars": 4200
}
~~~

The endpoint must return:

~~~json
{
  "records": [
    {
      "id": "record-id",
      "content": "bounded context",
      "tags": ["optional"],
      "relevance": 0.9,
      "confidence": 0.9,
      "provenance": {
        "source": "sonor-workflow-graph",
        "sourceType": "graphify",
        "project": "ALURKA",
        "timestamp": "2026-09-20T00:00:00Z",
        "privacy": "project_local",
        "reference": "stable-reference"
      }
    }
  ]
}
~~~

Allowed provenance source types already supported by ASTRA include:

- local;
- project;
- graphify;
- obsidian;
- github;
- sonor.

This lets Sonor preserve the original Graphify/Obsidian source instead of flattening all context into an opaque blob.

## What still requires local inspection

The connected GitHub repositories do not currently contain the Sonor source, and this environment cannot open the user's `127.0.0.1:55127`.

On the target PC, inspect the actual Sonor source/network layer and determine:

1. whether an API already exists;
2. existing search/graph endpoint paths;
3. current request/response schema;
4. project IDs/aliases;
5. Graphify provenance fields;
6. Obsidian note/reference fields;
7. pagination and limits;
8. cancellation/timeout behavior.

Preferred outcome:

- adapt an existing Sonor endpoint to the ASTRA-compatible contract; or
- add a small read-only compatibility endpoint inside Sonor.

Do **not** scrape the visual graph DOM as the primary integration if a server-side data source exists.

## Truthful runtime state

Until a real Sonor endpoint on the target PC is inspected and configured:

- Sonor UI exists;
- ASTRA Sonor bridge code exists;
- Sonor is **not yet claimed as live/READY** in the user's actual runtime.

Once the endpoint is configured and the production PC test passes, update this document and `docs/CODEX_HANDOFF.md`.


## Authoritative continuation documents

Before touching the user's real Sonor project, read:

- `docs/SONOR_CODEX_MISSION.md` — preserve/audit/private-backup/integrate mission.
- `docs/SONOR_UI_INTEGRATION.md` — approved ASTRA UI treatment.

The local Sonor implementation is the source of truth. These documents intentionally tell Codex to inspect and continue that implementation rather than creating a replacement.
