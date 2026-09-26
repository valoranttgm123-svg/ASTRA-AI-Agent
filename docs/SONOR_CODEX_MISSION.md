# SONOR → ASTRA Codex Mission

Status: **Approved roadmap**
Owner of implementation: future Codex session on the user's Windows PC.
Existing Sonor source is the source of truth.

## Non-negotiable rule

Codex previously built the existing Sonor workflow/project graph on the user's PC.

The existing Sonor implementation must be preserved and continued.

**Do not recreate Sonor.**
**Do not redesign it from scratch.**
**Do not create a second Graphify/Obsidian workflow.**
**Do not replace the existing graph/index/sync architecture unless a verified defect requires a targeted change.**

Known running UI:

`http://127.0.0.1:55127/#graph`

Codex must first locate the exact existing local Sonor project and inspect the implementation it previously created.

---

# Mission objective

Preserve the existing Sonor system, make its source recoverable in a private GitHub repository, document it, expose only the minimal ASTRA-compatible read path needed, and integrate it with the existing ASTRA Memory Manager.

Target:

~~~text
Graphify
   │
Obsidian
   │
Codex / ChatGPT conversations
   │
Projects / Files / Notes
   │
   ▼
SONOR EXISTING
   │
   │ existing graph/index/workflow
   ▼
minimal ASTRA compatibility API
   │
   ▼
ASTRA SonorBridge
   │
   ▼
ASTRA Memory Manager
   │
   ▼
ASTRA Brain
~~~

Sonor remains a separate subsystem.

ASTRA must not absorb, duplicate, or rebuild Sonor.

---

# Phase S0 — Locate the existing Sonor project

Before modifying code:

1. identify the process serving port `55127`;
2. identify the exact source directory that owns that process;
3. identify startup scripts/services;
4. identify frontend and backend entry points;
5. identify graph storage/index storage;
6. identify Graphify integration;
7. identify Obsidian integration;
8. identify conversation ingestion;
9. identify project/file ingestion;
10. identify sync/PC/HP/LAN behavior;
11. identify existing APIs;
12. identify all local data paths.

Do not guess paths from old prompts.

Do not create a new project directory until the real existing one has been found and audited.

Exit gate:

- existing source directory confirmed;
- current running process mapped to that source;
- current startup method documented.

---

# Phase S1 — Protect the current working Sonor

Before structural changes:

- create a recoverable local backup;
- preserve the currently working runtime;
- record current port/configuration;
- avoid deleting indexes or data;
- avoid migrations until data format is understood.

Must preserve:

- neural/workflow graph;
- project graph;
- project categories;
- file index;
- conversation index;
- Graphify;
- Obsidian integration;
- Codex/ChatGPT context;
- current synchronization;
- current navigation;
- current PC/HP connection flow;
- existing graph interactions.

Exit gate:

- rollback path exists;
- current Sonor still opens and behaves as before.

---

# Phase S2 — Audit architecture and classify data

Create a technical inventory of the real implementation.

Document:

- frontend;
- backend;
- graph engine;
- storage;
- indexes;
- Graphify path;
- Obsidian path;
- conversation ingestion;
- project ingestion;
- sync mechanism;
- LAN/local server;
- APIs;
- background jobs;
- startup process;
- dependencies;
- local data locations.

Classify every important path as one of:

- SOURCE CODE
- CONFIG TEMPLATE
- GENERATED INDEX
- CACHE
- PRIVATE USER DATA
- SECRET
- USER CONTENT
- BUILD OUTPUT

This classification must be completed before GitHub upload.

---

# Phase S3 — Create private Sonor GitHub repository

Create a **private** repository under the user's GitHub account.

Preferred name:

`SONOR-Workflow`

Sonor must remain separate from:

`valoranttgm123-svg/ASTRA-AI-Agent`

Use the real existing Sonor structure. Do not reorganize only to match a template.

Expected repository content may include:

- source;
- server/backend;
- graph logic;
- API;
- scripts;
- docs;
- package/runtime manifests;
- `AGENTS.md`;
- `README.md`;
- `.gitignore`;
- `.env.example`.

Never upload private runtime data merely to make the repo look complete.

---

# Phase S4 — Repository privacy and secret hygiene

Before the first push, inspect staged files.

Never commit:

- real `.env`;
- passwords;
- OAuth tokens;
- ChatGPT/Codex auth;
- API keys;
- cookies;
- SSH/private keys;
- device pairing secrets;
- private sync tokens;
- private conversation databases;
- personal Obsidian vault contents;
- generated graph databases;
- generated indexes;
- browser profiles;
- caches;
- temporary files;
- unrelated user project files.

GitHub stores the **Sonor engine and safe documentation**, not the user's private knowledge base.

If uncertain whether a file is private, do not commit it until classified.

---

# Phase S5 — Make Sonor self-documenting for future Codex sessions

Inside the private Sonor repository create and maintain:

- `AGENTS.md`
- `docs/CODEX_HANDOFF.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/ASTRA_INTEGRATION.md`
- `docs/LOCAL_DATA.md`

## AGENTS.md must state

- this is the existing Sonor system;
- preserve before changing;
- do not rebuild Graphify/Obsidian;
- inspect architecture before edits;
- private runtime data must not be committed;
- handoff docs must be updated after meaningful work.

## CODEX_HANDOFF.md must state

- current working state;
- exact project structure;
- startup method;
- important modules;
- local data paths;
- current limitations;
- ASTRA integration status;
- next exact task.

A fresh Codex session must be able to continue without relying on conversation memory.

---

# Phase S6 — Keep responsibilities separated

Sonor role:

**Knowledge / Workflow Intelligence Server**

Sonor answers questions such as:

- where information exists;
- how files/projects/conversations relate;
- what Graphify relationships exist;
- which Obsidian notes are relevant;
- project/workflow history;
- which project artifacts are connected.

ASTRA role:

- goal understanding;
- reasoning;
- planning;
- agent orchestration;
- tool execution;
- permissions;
- verification;
- voice/Humanoid interaction;
- user-facing decisions.

Sonor is not a second ASTRA Brain.

---

# Phase S7 — Inspect existing Sonor server/API first

Before adding endpoints, inspect the real existing backend.

Search for existing capabilities related to:

- graph search;
- graph node details;
- project lookup;
- file lookup;
- conversation lookup;
- Graphify relations;
- Obsidian references;
- health/status;
- indexing status.

Reuse existing server-side data flows whenever possible.

Do not create duplicate indexing pipelines.

Do not scrape the graph DOM if the backend already has the underlying structured data.

---

# Phase S8 — Add only a minimal ASTRA compatibility layer if needed

ASTRA already contains:

- `docs/SONOR_BRIDGE.md`
- `lib/memory/sonor.ts`
- `lib/memory/contracts.ts`
- `lib/memory/manager.ts`
- `lib/brain/unified-memory.ts`

Read those files before modifying Sonor.

If the existing Sonor API already satisfies the ASTRA contract, use it.

If not, add a small **read-only compatibility endpoint** inside the existing Sonor backend.

Conceptual endpoints may include:

- `GET /api/astra/health`
- `POST /api/astra/search`
- `GET /api/astra/projects`
- `GET /api/astra/project/:id`

Only add endpoints that fit the actual Sonor architecture.

---

# Phase S9 — ASTRA memory contract

Recommended query shape:

~~~json
{
  "query": "pekerjaan ALURKA terakhir",
  "project": "ALURKA",
  "limit": 6,
  "maxChars": 4200
}
~~~

Expected response shape:

~~~json
{
  "records": [
    {
      "id": "stable-id",
      "content": "bounded relevant context",
      "tags": ["optional"],
      "relevance": 0.95,
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

Preserve original provenance.

Use the original source type when known:

- graphify;
- obsidian;
- project;
- github;
- sonor.

Do not flatten all results into `sonor` if the original source is known.

---

# Phase S10 — Keep ASTRA↔Sonor local

Preferred ASTRA endpoint:

`http://127.0.0.1:55127`

When ASTRA and Sonor run on the same PC, ASTRA should not call Sonor through its LAN-facing URL.

Existing HP/LAN functionality may remain separate.

Do not expose a new unauthenticated public endpoint.

ASTRA compatibility endpoints are read-only initially.

---

# Phase S11 — Project mapping

Map existing Sonor project categories to ASTRA Project Registry using IDs/aliases rather than destructive renames.

Known examples visible in the existing Sonor UI include:

- ALURKA
- HASBI JAYA
- TRADING
- AI & REMOTE
- DESAIN & MEDIA
- UTILITAS

Inspect the real Sonor project model before mapping.

Do not infer ownership or project state from the visual graph alone.

---

# Phase S12 — Do not duplicate memory

ASTRA private runtime memory remains:

- `.astra/memory.json`
- `.astra/skills.json`

Sonor supplies project/knowledge context such as:

- graph relationships;
- conversation context;
- Obsidian references;
- project/file relationships;
- workflow history.

ASTRA Memory Manager selects bounded relevant context.

Do not copy the entire Sonor database into ASTRA private memory.

---

# Phase S13 — Performance contract

Sonor search must not affect Humanoid render performance.

Use:

- backend request;
- bounded result sets;
- timeout;
- cancellation;
- response size limits;
- indexed lookup where available.

Avoid:

- full graph export per prompt;
- full database scan per request;
- frontend polling loops;
- sending thousands of graph nodes to an AI model.

---

# Phase S14 — Security boundary

Treat all Sonor-returned content as untrusted retrieved data.

Protect against:

- prompt injection in notes/files/chats;
- malformed graph data;
- oversized responses;
- path traversal;
- accidental private-data leakage.

Cloud providers must not automatically receive private Sonor/Obsidian context.

Preserve ASTRA provider privacy policy.

---

# Phase S15 — Real Sonor validation

Test against the actual local Sonor instance.

## Test A — ASTRA project

Query an ASTRA-related recent task.

Expected:
- relevant context;
- stable provenance;
- no unrelated project contamination.

## Test B — ALURKA

Query:

`lanjutkan ALURKA terakhir`

Expected:
- ALURKA-only relevant context;
- correct project mapping;
- bounded results.

## Test C — Obsidian

Retrieve a known linked note.

Expected:
- provenance source type `obsidian`;
- stable reference.

## Test D — Graphify

Retrieve a known relationship.

Expected:
- provenance source type `graphify`;
- relationship/project reference preserved.

## Test E — Sonor unavailable / degradation

Do not stop or rebuild the real Sonor service merely to create evidence when a safer reversible ASTRA-side failure injection is available.

### Test E1 — preferred non-destructive outage path

Preferred sequence:

1. record the exact ASTRA runtime commit and current Sonor health/search baseline;
2. privately back up/hash the relevant ASTRA Sonor configuration without exposing values;
3. temporarily point only ASTRA's Sonor client at a deliberately unused **loopback** endpoint/port, or use an equivalent reversible local failure injection;
4. reload/restart only the ASTRA-owned runtime if the configuration mechanism requires it;
5. issue a project/memory request that would normally consult Sonor;
6. require Sonor to report unavailable/degraded truthfully;
7. require ASTRA to remain usable through local/project memory where applicable;
8. require no fabricated Sonor records/provenance;
9. restore the original private configuration exactly;
10. verify the original config hash/state and healthy Sonor search again.

If the implementation cannot support a safe reversible failure injection, use an already naturally unavailable Sonor state or record **BLOCKED**. Do not stop unrelated services or alter Sonor data.

Expected:
- ASTRA keeps working with the capabilities that remain real;
- Sonor reports unavailable/degraded truthfully;
- no fake READY state;
- restoration returns health/search to the previously verified baseline.

## Test F — active-query cancellation

Goal: prove an in-flight Sonor-backed ASTRA request settles cleanly when cancelled.

Sequence:

1. start a real ASTRA request that is confirmed to have entered Sonor retrieval;
2. while retrieval is actually active, trigger the normal ASTRA cancellation/STOP path;
3. require the ASTRA request to settle as cancelled/aborted;
4. require no later Sonor-backed success to overwrite the terminal cancellation;
5. require no stuck Brain request;
6. require Sonor itself to remain healthy after the cancellation;
7. run one normal post-cancel health/search probe.

If the local Sonor query completes too quickly to produce a truthful active-cancellation observation, record **BLOCKED / NOT REPRODUCIBLE WITH CURRENT LATENCY** rather than fabricating a cancellation PASS.

---

## M2 target result record

Keep raw/private evidence under `.astra/`; only public-safe conclusions belong in Git.

```text
ASTRA_RUNTIME_COMMIT:
SONOR_BASELINE_HEALTH: PASS | FAIL
SONOR_BASELINE_SEARCH: PASS | FAIL
OUTAGE_FAILURE_INJECTION: LOOPBACK_UNUSED_ENDPOINT | NATURAL_OUTAGE | OTHER_SAFE_REVERSIBLE | BLOCKED
OUTAGE_DEGRADATION_RESULT: PASS | FAIL | BLOCKED
LOCAL_PROJECT_MEMORY_STILL_TRUTHFUL:
NO_FAKE_SONOR_PROVENANCE:
CONFIG_RESTORED:
RESTORE_HASH_MATCH:
POST_RESTORE_HEALTH: PASS | FAIL
POST_RESTORE_SEARCH: PASS | FAIL

ACTIVE_QUERY_CONFIRMED:
CANCEL_TRIGGERED:
ASTRA_REQUEST_SETTLED_CANCELLED:
NO_LATE_SUCCESS:
NO_STUCK_BRAIN_REQUEST:
SONOR_HEALTHY_AFTER_CANCEL:
POST_CANCEL_SEARCH: PASS | FAIL
CANCELLATION_RESULT: PASS | FAIL | BLOCKED

DIAGNOSTICS_HEALTH_STATE_TRUTHFUL:
DIAGNOSTICS_SEARCH_EVIDENCE:
M2_OVERALL: PASS | FAIL | BLOCKED
```

Do not commit private graph data, note content, paths, indexes, tokens, raw queries, or raw result payloads.

---

# Phase S16 — Enable real ASTRA connection

Only after the real Sonor endpoint passes validation, configure the target PC:

~~~text
ASTRA_SONOR_ENABLED=true
ASTRA_SONOR_URL=http://127.0.0.1:55127
ASTRA_SONOR_SEARCH_PATH=<REAL VERIFIED PATH>
~~~

Do not commit the real machine's `.env.local`.

Then verify end-to-end:

~~~text
User
 ↓
ASTRA
 ↓
Project Registry
 ↓
Unified Memory
 ↓
Sonor
 ↓
Graphify / Obsidian / project context
 ↓
ASTRA Brain
~~~

Brain telemetry must report the real source types.

---

# Phase S17 — Sonor UI integration into ASTRA

Follow `docs/SONOR_UI_INTEGRATION.md`.

Core rule:

- ASTRA remains the primary user interface.
- Sonor remains the advanced knowledge/workflow workspace.
- Do not embed the entire heavy Sonor graph permanently inside the Humanoid screen.
- Expose focused Sonor-derived context inside ASTRA.
- Provide an explicit **Open Sonor Workspace** action for deep graph exploration.

---

# Phase S18 — Update both repositories

After real integration succeeds:

Update the private Sonor repo:

- `docs/CODEX_HANDOFF.md`
- `docs/ASTRA_INTEGRATION.md`
- `docs/ROADMAP.md`

Update ASTRA:

- `docs/CODEX_HANDOFF.md`
- `docs/SONOR_BRIDGE.md`
- `docs/ASTRA_MAX.md`
- `docs/ARCHITECTURE.md`

Use truthful states:

- IMPLEMENTED
- VERIFIED
- NOT_CONFIGURED
- BLOCKED

---

# Git workflow

For the first Sonor preservation:

1. backup existing local Sonor;
2. inspect private/generated files;
3. prepare `.gitignore`;
4. initialize or clean Git without losing history if history already exists;
5. secret/private-data review;
6. create private `SONOR-Workflow` repository;
7. push safe source;
8. create baseline checkpoint/tag.

For later work:

- feature branches;
- small commits;
- recoverable checkpoints;
- docs updated;
- no destructive edits to the only working copy.

---

# Final Definition of Done

The Sonor integration mission is complete only when:

1. the original Sonor still works;
2. its safe source is stored in a private GitHub repository;
3. private runtime/user data was not uploaded;
4. Sonor handoff documentation exists;
5. existing Graphify integration remains intact;
6. existing Obsidian integration remains intact;
7. ASTRA compatibility uses the existing Sonor data path;
8. ASTRA retrieves bounded Sonor context;
9. provenance is preserved;
10. project isolation is verified;
11. Sonor outage does not break ASTRA local/project memory;
12. ASTRA contains no duplicate Graphify/Obsidian/Sonor implementation;
13. future Codex sessions can continue from repository documentation;
14. the ASTRA UI exposes Sonor context without degrading Humanoid performance.

Primary implementation rule:

**PRESERVE → AUDIT → BACK UP → DOCUMENT → EXPOSE MINIMAL API → CONNECT ASTRA → VERIFY.**

Never:

**REBUILD SONOR FROM SCRATCH.**
