# NVIDIA MAX Integration Track for ASTRA

Status: **Approved architecture + repository foundation**
Verified against NVIDIA Build / NeMo documentation: **2026-09-22**

This document is the canonical NVIDIA expansion plan for ASTRA. It consolidates the NVIDIA model, skills, blueprint, retrieval, voice, vision, safety, and evaluation work into one track so future ChatGPT/Codex sessions continue instead of redesigning from scratch.

## Product rule

NVIDIA extends ASTRA. It does not replace ASTRA Brain, Sonor, Codex, Hermes, Tool Runtime, or ASTRA permissions.

Authority remains:

```text
User intent
  ↓
ASTRA Brain / Planner
  ↓
NVIDIA reasoning / research / retrieval / perception / safety (when configured)
  ↓
ASTRA Tool Runtime + permission ceiling + approval
  ↓
real side effect
```

No NVIDIA model, blueprint, skill, guardrail, or learned workflow may raise its own permission level.

## Final target architecture

```text
USER
  ↓
ASTRA Humanoid / Runtime / Event Bus
  ↓
ASTRA Brain
  ├─ NVIDIA JARVIS Model Mesh
  │    ├─ Chief: Nemotron 3 Ultra 550B A55B
  │    ├─ Deep: GLM-5.3
  │    ├─ Fast: Nemotron 3.5 Lightning 30B A3B
  │    └─ Vision: GLM-5.3 Flash
  │
  ├─ Research
  │    └─ NVIDIA AI-Q
  │
  ├─ Memory
  │    ├─ Sonor / Graphify / Obsidian (canonical)
  │    └─ NeMo Retriever / RAG (retrieval acceleration)
  │
  ├─ Documents
  │    └─ OCR / layout / table extraction → retrieval → Sonor
  │
  ├─ Voice
  │    └─ VAD/EOU + ASR + reasoning + TTS
  │
  ├─ Vision
  │    └─ MediaPipe + DeepStream + VSS + VLM
  │
  ├─ Skills
  │    └─ NVIDIA Skill Hub (official catalog discoverable, max relevant subset active)
  │
  ├─ Hermes
  │    └─ NemoClaw learned/reusable governed workflows
  │
  ├─ Codex
  │    └─ NVIDIA official coding/ops skills for implementation work
  │
  ├─ Safety
  │    └─ NeMo Guardrails + Nemotron Content Safety
  │
  └─ Quality
       └─ NeMo evaluation / RAG eval / RAG perf / red-team evidence
```

## Existing completed baseline

Already merged before this track:

- NVIDIA hosted NIM provider with strict hosted-host validation;
- adaptive JARVIS Model Mesh;
- Chief / Deep / Fast / Vision deterministic routing;
- NVIDIA execution blocked from direct side effects;
- NVIDIA memory forwarding OFF by default;
- NVIDIA AUTO fallback OFF by default;
- target-PC key handling and autonomous-first credential rules;
- zero-touch ready-to-use Codex delivery contract.

Do not rebuild these unless a real regression is reproduced.

## Repository foundation in this track

The repository now contains:

- `lib/nvidia/catalog.ts` — canonical integration registry;
- `lib/nvidia/skill-hub.ts` — bounded on-demand core skill manifest and recommendation layer;
- `tests/nvidia-max-framework.test.ts` — authority/routing/framework invariants.

The Skill Hub foundation is advisory only. It does not install or execute skills and therefore cannot bypass Tool Runtime.

## Core NVIDIA skills

The initial curated core set is:

- `aiq-research`
- `aiq-deploy`
- `rag-blueprint`
- `nemo-retriever`
- `rag-eval`
- `rag-perf`
- `nemotron-retrieval-recipes`
- `deepstream-dev`
- `deepstream-import-vision-model`
- `nemotron-speech`
- `nemotron-policy-generator`
- `skill-card-generator`
- `data-designer`
- `nemotron-customize` (specialized, not always-core)

The official NVIDIA skill catalog remains discoverable instead of eagerly injecting every skill into every prompt. Only a bounded relevant subset should be activated for one task.

## Why the full catalog is not eagerly loaded

The correct design is:

```text
Official NVIDIA Skill Catalog
  ↓
discover
  ↓
rank for current intent/agent
  ↓
select small bounded subset
  ↓
verify installed/available state
  ↓
ASTRA permissions
  ↓
use
```

Do not put hundreds of unrelated skill instructions into every model context. That increases noise, maintenance cost, dependency surface, and tool ambiguity.

## Integration phases

### NVA-0 — NVIDIA governance foundation

Repository work:

- canonical subsystem registry;
- canonical skill manifest;
- max-three default skill recommendation;
- no direct execution authority;
- roadmap/recovery/handoff integration;
- tests and CI.

Exit gate:

- build/test/typecheck/lint/audit green;
- PR merged;
- docs identify the exact next NVA task.

### NVA-1 — Skill Hub discovery + local installation registry

Codex repository work:

- create a provider-neutral NVIDIA skill catalog adapter;
- do not scrape HTML during normal ASTRA requests;
- use an explicit cached/private catalog snapshot or supported NVIDIA mechanism;
- store installed-skill metadata under private `.astra/`;
- record source/version/checksum/provenance when available;
- distinguish `available`, `installed`, `disabled`, `incompatible`;
- keep max active skill count bounded;
- add install/update/remove dry-run planning before any mutation;
- mutations require ASTRA permission/approval.

Target-PC work:

- install only the approved core set first;
- validate Codex-native skill placement/mechanism against the real Codex version;
- verify no secret enters skill files.

Exit gate:

- discovery, selection, provenance, install-state truth, rollback, and permission tests pass.

### NVA-2 — AI-Q Research backend

Codex repository work:

- add provider-neutral AI-Q adapter contract;
- health/status endpoint abstraction;
- bounded concurrent researcher count;
- request timeout/cancellation;
- provenance/citation result contract;
- no direct execution side effects;
- safe fallback to existing ASTRA research when AI-Q is unavailable.

Target-PC/external work:

- deploy/reach a real AI-Q backend using official supported workflow;
- run shallow/deep research evidence tests;
- benchmark quality/latency.

Exit gate:

- real source-backed result, cancellation, outage, malformed response, and fallback tests pass.

### NVA-3 — NeMo Retriever / RAG under Sonor

Hard rule: **Sonor remains canonical memory.**

Codex repository work:

- finish real Sonor audit first;
- define a Retriever source/adapter compatible with ASTRA Memory Manager;
- preserve project/privacy/provenance metadata;
- retrieval/reranking results are evidence, never authority;
- no arbitrary filesystem indexing;
- explicit registered sources only;
- cancellation and unavailable degradation.

Target-PC work:

- inspect real Sonor API/schema;
- connect Retriever/RAG to an approved subset;
- verify ALURKA/project isolation;
- run `rag-eval` and `rag-perf` only against real configured service.

Exit gate:

- Sonor + Retriever retrieval is source-linked, bounded, project-safe, cancellable, and measurably useful.

### NVA-4 — Document Intelligence

Codex repository work:

- provider-neutral document extraction contract;
- immutable original-file policy;
- bounded pages/file size/output;
- OCR/layout/table provenance;
- extraction result enters retrieval only after validation;
- explicit unsupported-type behavior.

Target-PC work:

- select available OCR/parser models supported by actual hardware/service;
- representative scan/PDF/table tests.

Exit gate:

- source-to-extraction-to-retrieval chain is reproducible and does not corrupt originals.

### NVA-5 — Always-On Voice

Maps primarily to ASTRA Phase 21.

Codex repository work:

- voice transport contract separated from provider;
- VAD/EOU state events;
- ASR partial/final transcript events;
- TTS start/stop events;
- barge-in/interrupt cancellation;
- STOP is authoritative;
- no claim of microphone privacy unless transport is actually local.

Target-PC work:

- real microphone permission;
- actual Nemotron Speech/Voice Agent transport;
- latency/jitter/interruption measurements;
- fallback when speech backend fails.

Exit gate:

- real audio proves LISTENING → THINKING → SPEAKING → IDLE and interruption works.

### NVA-6 — Vision / DeepStream / VSS

Maps primarily to ASTRA Phase 23.

Codex repository work:

- actual visual payload transport contract;
- no `visualContentProvided=true` without pixels/frames;
- frame/source provenance;
- bounded sampling and retention;
- opt-in camera/screen permission;
- cancellation/STOP;
- DeepStream/VSS adapters remain read-only perception.

Target-PC work:

- actual camera/video;
- hardware-compatible pipeline;
- object/tracking/Q&A evidence;
- performance measurement.

Exit gate:

- no fake perception; all displayed vision state comes from real frames and real provider results.

### NVA-7 — NemoClaw for Hermes

Maps to Phases 25 and 29.

Codex repository work:

- learned workflow candidate contract;
- learned skills begin disabled/reviewable;
- provenance to source workflow/corrections;
- bounded inputs/outputs;
- revocation/versioning;
- cannot raise permission level;
- ASTRA Tool Runtime remains executor.

Target-PC work:

- validate with real Hermes version/runtime;
- capture repeated safe workflow and replay under identical/lower authority.

Exit gate:

- learned workflow is reproducible, reviewable, revocable, and permission-safe.

### NVA-8 — NeMo Guardrails + Content Safety

Maps to Phases 22 and 28.

Codex repository work:

- guardrails are defense in depth, never authorization;
- provider-neutral guardrail result contract;
- input/retrieval/tool/output categories;
- PII redaction and injection-detection evaluation;
- fail-closed only where policy explicitly requires it;
- telemetry must not leak blocked secret material.

Target-PC/external work:

- select compatible guardrail deployment;
- evaluate latency/false-positive/false-negative tradeoffs;
- validate content-safety model availability.

Exit gate:

- regression matrix proves ASTRA permissions remain final authority and guardrails improve safety without silently changing tool permissions.

### NVA-9 — NeMo Evaluation / Quality Lab

Maps to Phases 28 and 30.

Codex repository work:

- reproducible evaluation manifest tied to exact Git commit/runtime identity;
- RAG quality, latency, provider quality, safety, tool-policy, voice, and vision suites;
- results under private evidence path;
- evaluation cannot self-select `READY`.

Target-PC work:

- run representative benchmark suite;
- record hardware/provider context;
- compare before/after evidence for optimizations.

Exit gate:

- Phase 30 final release consumes reproducible evaluation evidence.

## Cost / deployment policy

Preference order:

1. existing free endpoint or already-authorized service;
2. local/open model when hardware is sufficient;
3. hosted free/prototyping endpoint;
4. optional paid service only with explicit owner policy.

Do not make ASTRA availability depend on a single temporary free endpoint.

## Security invariants

- no API keys in GitHub;
- hosted credentials stay local;
- exact-host validation for remote providers;
- no remote skill/model becomes execution authority;
- Sonor is not duplicated;
- no automatic broad filesystem ingestion;
- no visual/audio capture without the configured consent boundary;
- no learned Hermes skill grants itself trust;
- NeMo Guardrails supplements ASTRA permissions;
- release READY requires real target-PC evidence.

## Recovery rule

New ChatGPT/Codex sessions must read:

1. current `main` + CI;
2. `AGENTS.md`;
3. `docs/SESSION_RECOVERY.md`;
4. `docs/ASTRA_WORKLOG.md`;
5. `docs/CODEX_PROGRESS_TRACKER.md`;
6. latest `docs/CODEX_HANDOFF.md`;
7. `docs/CODEX_NEXT_MISSION.md`;
8. this file.

Do not create a second NVIDIA roadmap.

## Immediate next work after NVA-0

Repository-side work can continue with **NVA-1 Skill Hub discovery/install-state contract** while target-PC gates remain blocked.

The existing core release target-PC sequence still has priority when real PC access is available:

`Phase 14 validation → MEM-X → Phase 16 → Phase 17 → Phase 19 → Phase 20`.

NVIDIA expansion must not be used to fake or bypass those release gates.

## Implementation checkpoint — NVA-1 repository contract

The repository-side NVA-1 state/cache contract is implemented on branch `feature/nvidia-skill-hub-state`:

- `lib/nvidia/skill-catalog-cache.ts`
  - provider-neutral injected discovery contract;
  - no runtime HTML scraping;
  - private bounded catalog snapshot;
  - duplicate/schema validation;
  - symlink rejection;
  - cancellation-aware refresh;
- `lib/nvidia/skill-state.ts`
  - private truth-state registry;
  - `available / installed / disabled / incompatible`;
  - version/checksum/source/timestamps;
  - dry-run install/update/disable/enable/remove plans;
  - Permission Level 2 requirement for local mutation;
  - symlink-safe bounded persistence;
- `tests/nvidia-skill-state.test.ts`
  - validation, persistence, merge truth, dry-run mutation, cancellation, and symlink tests.

This does not install NVIDIA skills yet. Real installation/update/remove requires the actual supported NVIDIA/Codex mechanism on the target PC and must be recorded truthfully in the private registry.

After NVA-1 repository merge, the next independent repo-side task is **NVA-2 AI-Q provider-neutral adapter contract**. Target-PC NVA-1 validation remains a Codex task when the real PC is available.
