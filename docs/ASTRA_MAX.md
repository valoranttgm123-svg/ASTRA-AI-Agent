# ASTRA MAX — Production Roadmap

Status: **Approved continuation roadmap**
Baseline: latest stable `main` after Brain V1 / V15 streaming / V13 gesture safety fixes.
Primary implementation branch when work begins: `astra/astra-max-production`

## Mission

Continue ASTRA from the latest stable `main` until it becomes a complete, usable, local-first personal AI agent.

This is not a prototype-only mission. The end state should truthfully support:

- understanding a user goal;
- identifying the relevant project;
- retrieving relevant project memory and knowledge;
- planning bounded multi-step work;
- selecting real specialist agents;
- using approved tools and integrations;
- operating project files and repositories;
- researching and analyzing data;
- interacting with connected email/calendar/Drive/CRM capabilities when configured;
- performing approved Windows actions;
- verifying meaningful results;
- streaming real lifecycle telemetry to Command Center;
- preserving useful durable memory;
- remaining safe, cancellable, local-first, and usable every day.

## Do not rebuild completed foundations

Preserve the existing stable implementation:

- Brain V1;
- V15 SSE Brain telemetry;
- ASTRA Runtime / Event Bus;
- GPU Humanoid;
- approved ASTRA artwork;
- MediaPipe hand tracking;
- V13 gestures;
- Ollama provider;
- Codex CLI engineering provider;
- existing permission policy;
- existing performance optimizations;
- loopback-only server boundary.

Before changing code, Codex must read:

1. `AGENTS.md`
2. `docs/CODEX_HANDOFF.md`
3. `docs/ASTRA_ROADMAP.md`
4. `docs/ASTRA_PROJECT_MEMORY.md`
5. `docs/ASTRA_BRAIN_V1.md`
6. `docs/ARCHITECTURE.md`
7. `docs/HUMANOID_BUILD_LOG.md`
8. this file: `docs/ASTRA_MAX.md`

## Autonomous implementation rule

Codex should continue milestone-by-milestone without waiting for another planning prompt after each milestone.

After every milestone:

- run relevant tests;
- update documentation;
- commit a recoverable checkpoint;
- keep the feature branch healthy;
- continue to the next milestone.

Stop and ask the user only when a genuine external/user action is required, for example:

- OAuth/account login;
- missing credential or provider authorization;
- physical microphone/camera permission or device validation;
- external account consent;
- destructive/high-impact action requiring explicit approval.

Never claim a capability works unless it has actually been verified.

---

# Target architecture

~~~text
USER
  ├─ Text
  ├─ Voice
  ├─ Camera
  ├─ Gesture
  ├─ Image
  └─ Screen context
        ↓
ASTRA HUMANOID
        ↓
ASTRA RUNTIME / EVENT BUS
        ↓
ASTRA BRAIN
  ├─ Goal understanding
  ├─ Project detection
  ├─ Memory retrieval
  ├─ Knowledge graph
  ├─ Planner
  ├─ Agent orchestrator
  ├─ Permission engine
  └─ Provider router
        ↓
SPECIALIST AGENTS
        ↓
TOOLS / MCP / COMPUTER / CONNECTORS
        ↓
ACTION
        ↓
VERIFICATION
        ↓
RESULT
  ├─ MEMORY UPDATE
  ├─ COMMAND CENTER
  └─ HUMANOID RESPONSE
~~~

---

# Command Center — all 18 nodes must become truthful capabilities

The existing ReasoningWeb roster is retained, but a visual node may not pretend to be online.

Canonical states:

- `READY`
- `ACTIVE`
- `WAITING_APPROVAL`
- `BLOCKED`
- `OFFLINE`
- `NOT_CONFIGURED`
- `ERROR`

Every node must map to a real agent, skill, tool adapter, integration, or explicit unavailable state.

## Consultant / thinking nodes

### 1. Chief of Staff

Real coordinator.

Responsibilities:

- understand intent;
- identify project;
- retrieve context;
- decide whether planning is needed;
- choose the smallest capable specialist;
- coordinate multi-agent work;
- request permission;
- evaluate verification;
- produce final result.

Chief may never claim another agent executed work when it did not.

### 2. Memory

Real persistent project-aware memory.

Sources may include:

- `.astra/memory.json`;
- `.astra/skills.json`;
- project memory;
- Graphify;
- Obsidian;
- project docs;
- GitHub context;
- optional Sonor bridge.

Requirements:

- bounded relevance retrieval;
- provenance;
- recency;
- project isolation;
- privacy flags;
- controlled memory writes;
- no whole-database prompt dumping.

### 3. Strategist

Real planning/strategy specialist.

Capabilities:

- break goals into milestones;
- prioritize;
- identify dependencies;
- identify risks;
- roadmap planning;
- compare strategies.

Chief orchestrates. Strategist plans.

### 4. Researcher

Real research specialist.

Capabilities:

- web research;
- technical research;
- source comparison;
- documentation lookup;
- supplier/product research;
- source-backed summaries.

Must distinguish retrieved facts, inference, assumptions, and unknowns.

### 5. Finance

Dedicated business-finance capability, separate from Trading.

Capabilities:

- revenue analysis;
- cost analysis;
- pricing;
- margin;
- budgeting;
- business summaries;
- projections;
- POS/business analytics.

Default is analysis/read-only unless an approved integration explicitly supports writes.

### 6. Editor

Real writing/review specialist.

Capabilities:

- rewrite;
- proofreading;
- tone consistency;
- email/document review;
- marketing copy review;
- final quality gate.

## Doer nodes

### 7. Sales

Capabilities:

- lead follow-up;
- quotations;
- sales copy;
- pipeline analysis;
- reminders;
- CRM-backed customer context.

External sending requires approval.

### 8. Marketing

Capabilities:

- campaign planning;
- positioning;
- promotions;
- content ideas;
- marketing calendar;
- campaign evaluation.

Should support real delegation such as:

`Researcher → Strategist → Marketing → Design → Editor → Social`

when the task genuinely requires it.

### 9. Ops

Business operations specialist.

Capabilities:

- operations workflows;
- project coordination;
- supplier tasks;
- internal checklists;
- process troubleshooting;
- execution coordination.

### 10. Social

Social-media specialist.

Capabilities:

- captions;
- content calendar;
- reel/video scripts;
- platform formatting;
- publishing preparation.

Publishing must be backed by an authorized integration and approval.

### 11. Engineering

Technical engineering specialist distinct from Developer.

Capabilities may include:

- calculations;
- hardware/system diagnostics;
- manufacturing guidance;
- technical architecture;
- technical-file interpretation.

### 12. Design

Provider-neutral design capability.

Potential capabilities:

- image generation;
- image editing;
- resizing;
- visual brief generation;
- UI design tasks;
- asset preparation.

Never claim an asset was produced unless a real provider returned it.

### 13. Developer

Primary software-engineering specialist.

Preferred provider: Codex where available.

Capabilities:

- repository inspection;
- coding;
- debugging;
- refactoring;
- architecture;
- testing;
- build;
- review;
- deployment preparation.

## Tool / integration nodes

### 14. Analytics

Capabilities:

- CSV/JSON/structured-data analysis;
- POS analytics;
- trends;
- metrics;
- charts;
- anomaly detection;
- summaries.

Preserve data-source provenance.

### 15. CRM

Provider-neutral CRM abstraction.

Capabilities:

- customer search;
- lead/customer context;
- pipeline stage;
- follow-up history;
- notes.

Writes require approval.

### 16. Calendar

Capabilities:

- inspect schedule;
- availability;
- meeting context;
- event preparation;
- reminders.

Create/update/delete/respond actions require approval.

### 17. Email

Capabilities:

- search;
- read;
- summarize;
- classify;
- draft;
- follow-up detection.

Send/delete/archive/forward/modify operations require approval.

### 18. Drive

Capabilities:

- search;
- browse;
- read;
- retrieve project documents;
- controlled upload when permitted.

Drive is not unrestricted filesystem access.

---

# Memory Intelligence

Create a unified memory manager:

~~~text
Memory Manager
  ├─ ASTRA local memory
  ├─ Project memory
  ├─ Graphify
  ├─ Obsidian
  ├─ GitHub/project docs
  └─ optional Sonor
~~~

Memory results should preserve fields equivalent to:

- source;
- source type;
- project;
- timestamp;
- relevance;
- confidence;
- privacy;
- reference/provenance;
- content.

Required lifecycle events:

- `memory.search.started`
- `memory.source.queried`
- `memory.graph.matched`
- `memory.context.selected`
- `memory.search.completed`
- `memory.write.requested`
- `memory.write.completed`
- `memory.write.denied`

## Graphify

Use Graphify as a knowledge relationship layer, not as a replacement for ASTRA Brain.

Graph nodes may represent projects, repos, files, symbols, docs, tasks, decisions, entities, tools, people, and integrations.

No expensive Graphify work may run in the WebGL/render loop.

## Obsidian

Local vault bridge.

Default: **READ ONLY**.

Only explicitly configured vaults are accessible.

Do not scan arbitrary user directories.

Do not commit vault contents.

Do not send private vault context to cloud providers without explicit permission.

---

# Project Registry

Create an ASTRA Project Registry.

Each project should support fields equivalent to:

- id;
- name;
- aliases;
- workspace;
- repositories;
- docs;
- memory namespace;
- goals;
- status;
- current milestone;
- last activity;
- open tasks;
- important files;
- integrations.

Examples may include ASTRA, ALURKA, HASBI JAYA, TRADING, and future projects.

The goal is that a request such as “lanjutkan ALURKA terakhir” can resolve the correct project and context without reconstructing the entire history manually.

No arbitrary disk scanning.

---

# Planner and orchestrator

Implement a bounded planner with:

- maximum steps;
- maximum retries;
- timeouts;
- cancellation;
- permission checkpoints;
- explicit verification steps.

Required planner events:

- `plan.created`
- `plan.step.started`
- `plan.step.progress`
- `plan.step.completed`
- `plan.step.failed`
- `plan.completed`
- `plan.cancelled`

Avoid uncontrolled recursive autonomy.

---

# Tool Registry and MCP

Create a provider-neutral Tool Registry.

Each tool definition should include equivalent metadata:

- id;
- name;
- category;
- description;
- input schema;
- output schema;
- permission level;
- side-effect level;
- timeout;
- cancellation support;
- provider;
- availability.

Categories may include filesystem, shell, GitHub, research, browser, computer, email, calendar, drive, CRM, analytics, database, design, and MCP.

MCP flow:

~~~text
Brain
  ↓
Tool Registry
  ↓
Permission Engine
  ↓
MCP Adapter
  ↓
MCP Server
~~~

Inspect capabilities before use.

Treat MCP output as untrusted input.

Newly discovered tools do not receive execution permission automatically.

---

# Real execution capabilities

## Files

Scoped operations:

- search;
- read;
- compare;
- create;
- edit;
- rename;
- move;
- structured extraction.

Read access should be restricted to registered workspaces.

Writes require policy approval.

Deletes require stronger approval.

Protect system directories, credential stores, browser secrets, SSH private keys, secret env files, and token stores.

## GitHub

Support real workflows:

- inspect repositories;
- branches;
- commits;
- issues;
- pull requests;
- code search;
- create branch;
- edit;
- commit;
- open PR;
- monitor CI;
- inspect diff;
- verify remote state.

Push/merge remain approval-gated.

Never merge failing required CI.

## Computer Agent

Controlled Windows automation.

Potential capabilities:

- launch allowed applications;
- focus windows;
- inspect state;
- keyboard/mouse;
- screenshots;
- file dialogs;
- terminal workflows.

Default: **OFF**.

Require explicit permission and an application/workspace allowlist.

No hidden remote-control service, credential harvesting, or unrestricted admin autonomy.

## Voice and multimodal

Unify text, voice, camera, gestures, images, and optional screen context under the same ASTRA Runtime.

Natural voice lifecycle:

`LISTENING → TRANSCRIBING → THINKING → EXECUTING (if needed) → SPEAKING`

Support interruption/barge-in/cancel where technically available.

Never display LISTENING if speech recognition is unavailable.

Camera/screen interpretation must be opt-in.

## Automation

Add safe local scheduling architecture for read-only or approved workflows such as project summaries, CI monitoring, unfinished-task reminders, and backup verification.

Scheduled execution must obey the same permission model.

---

# Permission levels

## Level 0 — CHAT

Reasoning only.

## Level 1 — READ

Memory, project inspection, public research, repository reads, analytics.

## Level 2 — SAFE LOCAL ACTION

Project-scoped writes, tests/builds, approved local development actions.

## Level 3 — EXTERNAL ACTION

GitHub push/PR actions, email send, calendar modification, database writes, cloud upload.

Explicit approval required.

## Level 4 — HIGH IMPACT

Delete, privileged shell, security-sensitive actions, financial execution, live trading.

Strong explicit approval required.

ASTRA may never elevate its own permission level.

Approval UI should clearly show:

- requested action;
- agent;
- tool;
- target;
- reason;
- permission level;
- expected side effect.

Actions:

- `APPROVE ONCE`
- `DENY`
- `STOP TASK`

No broad permanent trust in this release.

---

# Emergency stop

One global cancellation path must stop:

- Brain request;
- Planner;
- active agent;
- provider;
- tool;
- shell;
- computer action;
- speech;
- queued task.

Existing FIST gesture may map to this global STOP.

A visible STOP control must also exist.

Cancellation must propagate end-to-end.

---

# Verification engine

A provider saying “done” is not proof.

Verify meaningful work.

Examples:

- Code: typecheck, tests, build, diff.
- File: re-read written output and compare expected content.
- GitHub: verify remote branch/commit/PR/CI.
- Calendar: re-read created/updated event.
- Email: verify provider result/draft/send state.
- Computer: inspect final application state.

Events:

- `verification.started`
- `verification.check`
- `verification.passed`
- `verification.failed`

---

# Command Center MAX

Command Center must visualize real system activity only.

Show:

- current goal;
- detected project;
- plan;
- active step;
- active agent/node;
- provider;
- memory sources;
- active tool;
- permission level;
- approval status;
- elapsed time;
- verification;
- failures;
- result.

Generic lifecycle events should include where appropriate:

- `agent.started`
- `agent.progress`
- `agent.completed`
- `agent.failed`
- `tool.started`
- `tool.progress`
- `tool.completed`
- `tool.failed`

Do not create fake events merely to animate nodes.

---

# Provider routing

Maintain local-first behavior.

Suggested policy:

General/private:
`Ollama → Hermes if configured → explicitly permitted cloud`

Engineering:
`Codex → Hermes → Ollama read/reasoning fallback`

Tool orchestration:
choose the provider that actually has the required capability.

Paid cloud stays **OFF by default** and may never be silently selected.

---

# Observability and security

Use structured local trace data such as:

- traceId;
- taskId;
- planId;
- agent;
- provider;
- tool;
- permission;
- duration;
- status;
- verification.

Never log passwords, API keys, OAuth secrets, tokens, or private credentials.

ASTRA must remain:

- local-first;
- loopback-only;
- same-origin;
- permission-gated;
- cancellable;
- secret-safe.

Protect against:

- prompt injection from web/files/repos;
- malicious memory entries;
- MCP/tool injection;
- path traversal;
- tool argument manipulation;
- hallucinated provider execution;
- privilege escalation.

Retrieved content is data, not system authority.

---

# Performance rule

Do not sacrifice Humanoid smoothness for agent processing.

Never put filesystem scanning, Graphify processing, memory ranking, MCP discovery, provider polling, or tool execution in the WebGL/render loop.

Prefer server-side, worker, async, and event-driven processing.

Optimize architecture before lowering HIGH visual quality.

---

# Roadmap to final release

## Phase 0 — Baseline lock

- update latest `main`;
- record starting commit;
- verify existing tests/build;
- create recoverable backup;
- create `astra/astra-max-production`.

Exit: current ASTRA still works.

## Phase 1 — Agent/capability normalization

Create the canonical mapping:

`Visual Node ↔ Agent ↔ Skill ↔ Tool ↔ Integration ↔ Runtime State`

Exit: no node reports READY/ONLINE without real registered capability.

## Phase 2 — Memory Intelligence

Implement unified memory, provenance, project isolation, bounded retrieval, Graphify abstraction, Obsidian adapter, privacy rules.

Exit: ASTRA retrieves correct context from multiple sources and exposes provenance.

## Phase 3 — Project Registry

Implement multi-project identity and context.

Exit: “lanjutkan ALURKA terakhir” resolves the correct registered project/context.

## Phase 4 — Strategist + Planner

Implement reliable bounded multi-step planning.

Exit: a multi-step plan can execute while every real step is observable.

## Phase 5 — Agent Orchestrator

Make Chief coordinate real specialists.

Minimum verified delegation: Memory, Research, Developer, Files, Business.

## Phase 6 — Tool Registry + MCP

Implement standard execution interface and policy boundary.

Exit: at least one native tool and one MCP-style capability execute through the same registry/policy model.

## Phase 7 — Files + GitHub production flow

Verified scenario:

`inspect → modify safe code → test → build → inspect diff → prepare commit/PR → verify`

Exit: end-to-end developer flow works.

## Phase 8 — Business skills

Activate Finance, Sales, Marketing, Ops, Editor, Analytics as real role-specific capabilities.

## Phase 9 — Communication + cloud-file integrations

Activate CRM, Calendar, Email, Drive when providers/accounts are configured.

Unconfigured nodes must show `NOT_CONFIGURED`, not fake online status.

## Phase 10 — Design + Social

Implement provider-neutral Design and Social.

Exit: a campaign workflow can truthfully coordinate Research → Strategist → Marketing → Design → Editor → Social.

## Phase 11 — Computer Agent

Implement controlled Windows actions.

Exit: one approved local application workflow works and global STOP cancels it.

## Phase 12 — Voice + Multimodal

Unify text/mic/gesture/camera/image/screen context under one runtime.

Separate automated verification from physical-device tests that require the user.

## Phase 13 — Command Center MAX

Make all displayed activity derive from real runtime events.

Exit: active nodes correspond to actual work, with no fake traces.

## Phase 14 — Automation

Implement safe scheduled workflows under the same permission model.

## Phase 15 — Security/failure hardening

Test provider outage, MCP outage, malformed outputs, malicious prompts/files, cancellation, network failure, Ollama unavailable, Codex unavailable, permission denial, and invalid project paths.

ASTRA must fail safely.

## Phase 16 — Performance pass

Measure and improve Humanoid FPS, memory retrieval latency, provider startup, Command Center update cost, browser console, and memory usage.

## Phase 17 — Full system test

Required scenarios:

A. “lanjutkan project terakhir saya dan jelaskan apa yang belum selesai”
Expected: Project + Memory + Chief.

B. “cek ASTRA, perbaiki error, test dan siapkan PR”
Expected: Chief + Developer + GitHub + verification.

C. “buat campaign ALURKA minggu depan”
Expected: Memory + Research + Strategist + Marketing + Design + Editor.

D. “cek jadwal saya dan siapkan email follow-up”
Expected when configured: Calendar + Email.

E. Trigger STOP during execution.
Expected: active work cancels cleanly.

## Phase 18 — Release Candidate

Create an ASTRA MAX release candidate only after:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm audit --audit-level=high`
- `git diff --check`

All required checks must pass.

## Phase 19 — Windows ready-to-use release

Improve installer/startup path:

`Install → ASTRA local service → Ollama → ASTRA UI → status self-check`

Verify Node/runtime, ASTRA build, Ollama, configured model, Codex availability, registered integrations, memory directory, and loopback binding.

## Phase 20 — Final release

Final release is allowed only when the Definition of Done below is met.

Use the next version consistent with established project versioning and document the release clearly.

---

# Final Definition of Done

ASTRA is READY TO USE only when this workflow is real:

User asks:

“ASTRA, lanjutkan project terakhir saya. Cari apa yang belum selesai, perbaiki yang bisa diperbaiki, test, lalu siapkan hasilnya.”

ASTRA must:

1. identify the goal;
2. identify the correct project;
3. retrieve relevant memory;
4. retrieve relevant graph/context;
5. inspect actual project state;
6. create a bounded plan;
7. select real agents;
8. select real tools/providers;
9. request approval where required;
10. execute permitted steps;
11. stream real progress;
12. verify meaningful results;
13. report failures truthfully;
14. present the final result;
15. update durable memory when appropriate;
16. leave recoverable project state.

Additional release requirements:

- Command Center reflects real work;
- Humanoid remains responsive;
- emergency STOP works;
- no fake agents;
- no fake tools;
- no fake telemetry;
- no fake success claims;
- no silent paid cloud;
- no uncontrolled destructive autonomy.

---

# Required final report

When all implementable phases are complete, document:

- **COMPLETED** — every working capability;
- **VERIFIED** — exact checks performed;
- **CONNECTED** — integrations successfully tested;
- **REQUIRES USER LOGIN** — services needing OAuth/account authorization;
- **REQUIRES PHYSICAL TEST** — mic/camera/device checks requiring the user;
- **NOT IMPLEMENTED** — anything genuinely unfinished;
- **SECURITY STATUS** — permission model and remaining risks;
- **PERFORMANCE STATUS** — Humanoid/runtime observations;
- **TEST STATUS** — test/build/audit summary;
- **RELEASE STATUS** — one of:
  - `READY`
  - `READY WITH EXTERNAL CONFIGURATION REQUIRED`
  - `BLOCKED`

Do not use READY unless core ASTRA functionality passes production validation.

---

# Documentation continuity

After every major milestone update:

- `docs/CODEX_HANDOFF.md`
- `docs/ASTRA_ROADMAP.md`
- `docs/ARCHITECTURE.md`
- this file, `docs/ASTRA_MAX.md`

The handoff must always state:

- latest completed milestone;
- current branch/commit;
- current blockers;
- test state;
- next automatic task.

A new Codex session should be able to continue without reconstructing project history from chat.

---

# Git strategy

Do not create one giant unreviewable commit.

Use recoverable milestone commits, for example:

- `feat(astra-max): normalize capability registry`
- `feat(memory): add unified memory sources`
- `feat(projects): add project registry`
- `feat(planner): add bounded execution planner`
- `feat(tools): add tool registry`
- `feat(mcp): add MCP adapter`
- `feat(files): add scoped file execution`
- `feat(github): add verified repository workflow`
- `feat(agents): activate business specialists`
- `feat(integrations): add communication adapters`
- `feat(computer): add permission-gated computer agent`
- `feat(command-center): wire real lifecycle nodes`
- `feat(security): harden execution boundaries`
- `test(astra-max): complete end-to-end validation`

Before merging meaningful implementation work:

- tests pass;
- typecheck passes;
- lint passes;
- build passes;
- audit passes;
- relevant integration checks pass;
- critical runtime flows are verified.

The priority is not the number of features. The priority is a truthful, useful, stable, fast, secure personal AI agent that is actually usable every day.
