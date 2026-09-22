# ASTRA ↔ Sonor Bridge

Status: **LIVE TARGET-PC BRIDGE VALIDATED on 2026-09-22. Existing Sonor/Graphify/Obsidian remains the authoritative local knowledge system; ASTRA consumes it read-only over loopback.**

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

The verified target-PC search path is `/api/astra/search`. The health endpoint is `/api/astra/health`. Keep both on loopback only.

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

## Target-PC validation — 2026-09-22

The real local Sonor source/network layer was inspected on the target PC and the existing implementation was preserved rather than rebuilt.

Verified runtime contract:

- health: `GET http://127.0.0.1:55127/api/astra/health`;
- search: `POST http://127.0.0.1:55127/api/astra/search`;
- health reported `readOnly=true`, `ready=true`, and `cloudAutomatic=false`;
- ASTRA uses `ASTRA_SONOR_ENABLED=true`, loopback URL `http://127.0.0.1:55127`, and `ASTRA_SONOR_SEARCH_PATH=/api/astra/search`;
- a real project-scoped ASTRA request queried local memory, project context, and Sonor;
- Sonor returned 6 bounded records;
- 4 returned records were graph-backed;
- the selected context preserved source types `project`, `obsidian`, and `graphify`;
- Ollama then completed the final ASTRA response, proving the path `ASTRA → Memory Manager → Sonor → Graphify/Obsidian → Ollama` end-to-end.

The ASTRA status/detail defect that prefixed a healthy Ollama status with an unrelated Hermes `fetch failed` message was fixed in PR #187 and merged to `main`.

## Truthful runtime state

As of 2026-09-22:

- Sonor UI exists and the server-side read-only ASTRA bridge is live on the target PC;
- ASTRA Sonor bridge code is configured and exercised against the real endpoint;
- provenance-aware Graphify/Obsidian records are reaching the Brain context;
- end-to-end reasoning through local Ollama completed successfully;
- the existing Sonor project remains authoritative and must not be duplicated.

Still pending for the broader MEM-X preservation mission:

- establish a safe private backup/remote for the Sonor source if the owner wants repository backup;
- keep runtime/user datasets, private notes, indexes, secrets, caches, and generated output out of public GitHub;
- add explicit failure/cancellation evidence only if required by the release gate.

Do **not** scrape the visual graph DOM as the primary integration because the verified server-side bridge exists.


## Authoritative continuation documents

Before touching the user's real Sonor project, read:

- `docs/SONOR_CODEX_MISSION.md` — preserve/audit/private-backup/integrate mission.
- `docs/SONOR_UI_INTEGRATION.md` — approved ASTRA UI treatment.

The local Sonor implementation is the source of truth. These documents intentionally tell Codex to inspect and continue that implementation rather than creating a replacement.
