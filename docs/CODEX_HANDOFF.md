# ASTRA Codex Handoff

## 2026-09-20 — Phase 9 communication/cloud integration contracts

Implemented on `astra/phase9-communication-cloud-integrations`:

- provider-neutral `AstraIntegrationTransport`;
- canonical CRM, Calendar, Email and Drive tool catalog;
- read operations are Level 1;
- account/cloud mutations are Level 3 external writes;
- default runtime exposes every integration truthfully as `NOT_CONFIGURED`;
- a provider may make only the exact capabilities it reports become `READY`;
- provider results require `verified=true`; claimed success without verification is rejected;
- planner permission floors cover integration reads/writes;
- Brain feature status exposes aggregate integration readiness;
- Command Center CRM/Calendar/Email/Drive nodes read live runtime status rather than inherited static labels;
- capability nodes are now `partial`, not `planned`: the adapter exists, but real account/provider configuration is still required;
- regression tests cover selective capability exposure, Level-1 reads, Level-3 approval/policy gates, unverified provider rejection, planner floors, and truthful node state.

Canonical tool IDs:
- `crm.search`
- `crm.note.add`
- `calendar.list`
- `calendar.event.create`
- `calendar.event.update`
- `email.search`
- `email.read`
- `email.draft.create`
- `email.send`
- `drive.search`
- `drive.read`
- `drive.upload`

Important truth:
This milestone does not claim Gmail, Google Calendar, Drive, or any CRM is already connected inside the ASTRA local runtime. Real transports/OAuth remain external configuration. The architecture is now ready to accept verified providers without changing planner/approval semantics.

Next milestone after merge:
**Phase 10 — Design + Social**, using the same provider-neutral pattern and keeping publish/generation actions truthful and permission-gated.

## 2026-09-20 — Phase 8 Business Skills checkpoint

This branch turns six legacy business nodes into truthful ASTRA capabilities without adding fake external integrations.

Implemented:
- intent-selected Business specialist skills:
  - Finance;
  - Sales;
  - Marketing;
  - Ops;
  - Editor;
  - Analytics;
- Business always loads a base truth/safety skill, then only the specialist skill(s) whose bounded trigger matches the current user input;
- local skill JSON may optionally define bounded `triggers` while remaining agent-scoped;
- `skill.selected` lifecycle points at the real specialist visual node instead of always lighting Ops;
- business-specific router terms select the shared Business execution agent while ordinary calendar/email requests still route Communication;
- `business.finance.metrics`:
  - native Level-1 deterministic calculation;
  - revenue or unit-derived revenue;
  - COGS or unit-derived COGS;
  - gross/net profit;
  - gross/net margin;
  - markup;
  - average selling price;
  - contribution per unit;
  - break-even units;
  - missing COGS is never silently treated as zero;
  - omitted optional fixed/other/tax cost zero-assumptions are explicitly returned;
- `analytics.summary`:
  - native Level-1 deterministic structured-data tool;
  - bounded records/fields;
  - count/missing/sum/mean/min/max/median;
  - first/last/delta/delta percent;
  - provenance/source label retained;
  - descriptive statistics do not claim causal explanation;
- quantitative business prompts with numbers trigger planning so Strategist can select deterministic Finance/Analytics tools;
- planner tool permission floor for both tools is Level 1;
- Phase 8 nodes now have implemented contracts:
  - Finance / Analytics use native tools plus explanation;
  - Sales / Marketing / Ops / Editor provide analysis/drafting only;
  - external CRM/send/publish/database actions remain separate approval-gated integrations;
- Brain status exposes live Business readiness based on a real reasoning provider plus READY deterministic tools;
- Command Center Phase 8 nodes use that runtime state instead of static optimism.

Security/truth boundary:
- no customer, POS, accounting, supplier, campaign, or pipeline data is invented;
- a draft is not a sent message;
- a campaign plan is not a published campaign;
- an Ops checklist is not a desktop/system action;
- Analytics statistics are not causal proof;
- Finance arithmetic verifies calculations, not completeness/correctness of the supplied source data.

Next milestone after merge:
**Phase 9 — Communication / Cloud-file integrations**: CRM, Calendar, Email, Drive must remain NOT_CONFIGURED until real connected adapters exist; read operations and external writes must have separate permission contracts.

Sonor remains untouched.

## 2026-09-20 — Phase 5B real Research / Browser checkpoint

This branch closes the remaining bounded-orchestrator Researcher gap without modifying Sonor.

Implemented:
- `browser.fetch` native Level-1 read tool:
  - explicit public http/https URLs only;
  - no URL credentials;
  - localhost/private/reserved/metadata/LAN address blocking;
  - DNS resolution is validated before connection and the connection is pinned to that address;
  - redirect destination is revalidated;
  - HTTPS downgrade redirect is blocked;
  - bounded textual/JSON/XML response only;
  - response bytes, redirects and extracted text are capped;
  - output includes public URL, final URL, title, timestamp and provenance;
- provider-neutral `AstraResearchTransport`;
- default `SearXngResearchTransport`:
  - only an explicit loopback `ASTRA_SEARXNG_URL` is accepted;
  - real bounded health search is required before READY;
- `research.search` Level-1 read tool;
- `research.web` Level-1 source-backed composite:
  - search;
  - fetch a small bounded source set;
  - S1/S2/S3 source IDs;
  - provenance and fetch timestamps;
  - source text marked untrusted;
- bounded `kind=research` plan steps now invoke `research.web` through Tool Runtime instead of hard-failing;
- planner knows browser/research tools are Level 1;
- planner is instructed to follow research with evidence synthesis and source-ID citations;
- local Ollama reasoning is explicitly told to treat browser/research content as untrusted evidence, never instructions;
- Brain status exposes truthful research readiness;
- Researcher overview uses runtime research status rather than claiming static availability;
- Tool Runtime supports dependency injection for deterministic research integration tests.

Regression coverage:
- private/LAN/metadata/documentation/tunnel address blocks;
- public IPv4/IPv6 allow cases;
- browser.fetch loopback refusal;
- loopback-only SearXNG config and health verification;
- source IDs/provenance/untrusted evidence;
- real tool lifecycle;
- bounded orchestrator `kind=research` execution through an injected real Tool Runtime;
- planner Level-1 floors for research/browser.

Runtime truth:
- explicit `browser.fetch` is available without SearXNG;
- general search/research remains NOT_CONFIGURED until local SearXNG is actually reachable;
- no cloud search API or hidden key is assumed.

Next milestone after merge:
**Phase 8 — Business Skills** (Finance, Sales, Marketing, Ops, Editor, Analytics) using real skill contracts, deterministic calculations/data analysis where possible, and local-model reasoning only where verification does not require an external action.

Sonor remains untouched and delegated to its existing mission.

## 2026-09-20 — Phase 7C scoped Level-3 approval checkpoint

This branch closes the core approval gap for external GitHub actions without touching Sonor.

Implemented:
- one-time process-local Level-3 approval challenges in `lib/brain/approvals.ts`;
- cryptographically random token, 5-minute TTL, bounded pending registry;
- challenge is bound to the exact user input hash + exact stored `AstraPlan`;
- approval scope exposes only safe metadata (projectId/branch/remote/base/head/title/path/script/limit), never file contents, PR body, secrets or credentials;
- tokens are single-use even when validation fails;
- the second approval request reuses the stored plan and does not ask the planner/model to generate a new plan;
- normal `approved=true` remains Level-2 safe-local only;
- Level-3 external action requires an explicit scoped challenge;
- Level-4 remains unavailable through the normal UI and is rejected before any plan step runs;
- preflight occurs before plan execution so ASTRA does not perform local work and only later surprise the user with an external-action approval;
- a Level-3 challenge is issued only when the requested tool is genuinely READY and external-action policy permits it;
- Level-3 approval is exact-step, not blanket permission:
  - approving `github.push` does not also approve `github.pull-request.open`;
  - if another Level-3 step is reached, ASTRA issues a new one-time challenge;
- executor accepts scoped step IDs only for Level-3 and never for Level-4;
- API/SSE request parsing forwards bounded `approvalToken`;
- Brain lifecycle includes `approval.requested` and `approval.granted`;
- ASTRA Console shows an explicit amber Level-3 panel with safe scope + expiry and separate APPROVE LEVEL 3 / CANCEL actions;
- approval tokens are never rendered in the UI;
- voice input/new chat cancels the visible pending confirmation rather than auto-approving it.

Regression coverage added for:
- single-use token semantics;
- message/input binding;
- safe scope redaction;
- READY/policy preflight checks;
- Level-4 precedence;
- exact-step Level-3 execution;
- second Level-3 step requiring another approval;
- malformed HTTP approval tokens.

Important runtime truth:
GitHub Level-3 actions still require `ASTRA_ALLOW_EXTERNAL_ACTIONS=true` and an authenticated READY GitHub transport. Approval does not make an unavailable provider available.

Phase 7 core architecture is now complete enough for target-PC validation. Remaining Phase 7 production validation:
1. on the target Windows PC confirm `gh auth status`;
2. register the real ASTRA project workspace in Project Registry;
3. exercise a safe real branch → scoped edit → verification → commit → Level-3 push → Level-3 PR → CI read;
4. record the real result before declaring the target-PC workflow production validated.

Next roadmap milestone after merge:
**Real Research / Browser capability** to close the remaining Phase 5 delegation gap, while target-PC Phase 7 validation can be performed separately.

Sonor remains untouched and delegated to the existing Codex/Sonor mission.

## 2026-09-20 — Phase 7B authenticated GitHub transport + tool-aware planner checkpoint

This branch adds the provider/auth boundary required to finish the external half of the Files/GitHub production flow.

Implemented:
- `lib/tools/github.ts` defines a provider-neutral `AstraGitHubTransport`;
- default local provider is `GhCliGitHubTransport`;
- GitHub tools become READY only when:
  1. GitHub CLI exists; and
  2. `gh auth status --hostname github.com` succeeds;
- no GitHub token is accepted in planner/tool input and provider diagnostics redact recognizable token/Bearer patterns;
- `github.push`:
  - Level 3 external write;
  - verifies current local branch;
  - restricts remote URL to GitHub;
  - uses shell-free git push;
  - verifies remote ref with `git ls-remote`;
- `github.pull-request.open`:
  - Level 3 external write;
  - uses fixed `gh pr create` arguments;
  - success requires a verified github.com PR URL;
- `github.ci.status`:
  - Level 1 read;
  - reads bounded GitHub Actions run JSON through `gh run list`;
- Tool Runtime dynamically replaces static NOT_CONFIGURED GitHub placeholders only when the transport reports authenticated availability;
- Brain status now reports dynamic GitHub push/PR/CI availability;
- Strategist plans may carry structured `toolId` + bounded JSON `toolInput`;
- planner receives the truthful runtime tool catalog and is instructed not to invent tool ids or treat unavailable tools as READY;
- registered tool-id permission floors override generic agent floors (for example local Git status remains Level 1 even though the visual agent is GitHub);
- bounded orchestrator executes structured tool steps through Tool Runtime;
- a plan scoped to one project cannot redirect its structured tool call to a different project;
- Ollama may remain the reasoning/planning provider while real registered Tool Runtime handlers perform approved actions; only unstructured side-effecting prose actions remain blocked.

Verified by fixture tests:
- structured planner tool ids/inputs survive normalization;
- local structured tool plan executes through Brain with Ollama as reasoning provider;
- authenticated GitHub fixture exposes READY push/PR/CI;
- push is blocked below Level 3;
- push is blocked when external-action policy is off;
- Level-3 + external-action policy permits the verified fixture push/PR;
- CI remains Level-1 read;
- unavailable/unauthed transport remains NOT_CONFIGURED and never calls external handlers.

Truthful runtime limitation:
**This repository implementation does not prove that the target Windows PC is currently authenticated with GitHub CLI.** On that PC the GitHub tools will remain NOT_CONFIGURED until `gh auth status` passes.

Phase 7 remains not fully production-complete until:
1. Level-3 scoped approval is exposed through the ASTRA UI/API flow;
2. the real target PC validates branch → edit → tests/build → commit → push → PR → CI;
3. CI success is incorporated as a verification step for the full workflow.

Sonor is not modified by this milestone.

Next roadmap task after this merge:
**Phase 7C — scoped Level-3 approval + end-to-end GitHub workflow verification**, then real Research/browser capability to close remaining Phase 5 gaps.

## 2026-09-20 — Phase 7A scoped Files + local Git checkpoint

This branch implements the safe local half of the Files/GitHub production workflow.

Implemented:
- centralized project path safety in `lib/projects/paths.ts`;
  - registered workspace containment;
  - lexical + realpath containment;
  - sensitive-name/segment blocking;
  - supported text-extension allowlist;
  - safe existing-file and writable-target resolution;
- existing project-context memory loader now reuses the same path guard;
- `project.file.read` (Level 1/read):
  - exact path only;
  - registered workspace only;
  - bounded text read;
  - SHA-256 returned for optimistic write precondition;
- `project.file.write` (Level 2/local write):
  - exact safe target only;
  - bounded content;
  - existing files require `expectedSha256` from a prior read;
  - stale hash blocks overwrite;
  - exact read-back verification after write;
- bounded shell-free process helper (`spawn`, `shell:false`, fixed commands/args, cancellation, output cap);
- real local Git tools:
  - `project.git.status` — Level 1;
  - `project.git.diff-file` — Level 1, one explicit safe file;
  - `project.git.create-branch` — Level 2;
  - `project.git.stage-files` — Level 2, explicit safe paths only;
  - `project.git.commit` — Level 2, revalidates every staged path and verifies a new HEAD;
- `project.verify.npm-script` — Level 2/shell-gated, allowlist only: test/typecheck/lint/build;
- `github.push` and `github.pull-request.open` exist as Level-3 external actions but remain `NOT_CONFIGURED` with no handler/provider.

End-to-end fixture coverage:
`read → SHA-guarded write → git diff → branch → stage → npm test → commit → verify HEAD/status`
runs in a temporary Git repository, not the real user project.

Security notes:
- no recursive filesystem scan;
- no arbitrary shell command input;
- sensitive files such as .env/private keys remain blocked;
- local commit refuses unsafe/deleted staged paths;
- GitHub external actions remain blocked until an authenticated provider is explicitly connected.

Phase 7 is **partial**, not complete. Next:
1. merge this checkpoint after CI;
2. add a provider-neutral authenticated GitHub transport for push/PR/CI reads behind Level 3;
3. wire planner/orchestrator tool selection so validated plan steps can invoke these exact tool IDs/inputs instead of relying on prose;
4. verify a real branch → safe edit → tests/build → commit → push → PR → CI workflow on the target PC.

Sonor is not modified by this milestone.

## 2026-09-20 — Phase 6A executable Tool Runtime checkpoint

This branch converts the existing Tool Registry from metadata-only into a real permission-gated execution runtime.

Implemented:
- `lib/tools/executor.ts` — shared executable Tool Registry with:
  - availability checks;
  - approved permission-level gate before handler invocation;
  - ASTRA policy gate;
  - timeout;
  - cancellation;
  - bounded input/output;
  - real `tool.started/tool.completed/tool.failed` lifecycle;
  - completed results are rejected unless the handler returns `verified: true`;
  - side-effecting tools must support cancellation;
- `lib/tools/native.ts` — first real native tool: `project.context.search`;
  - READ / Level 1 only;
  - reuses the scoped Project Registry loader;
  - reads only explicitly registered docs/importantFiles;
  - keeps workspace containment, realpath, sensitive-file and no-directory-scan protections;
- `lib/tools/runtime.ts` — native + optional MCP registrations share one executor/policy boundary;
- `lib/tools/mcp.ts` — transport-injected MCP adapter contract:
  - does not discover or connect to arbitrary servers automatically;
  - MCP tools exist only when a real transport is explicitly injected;
  - provider success still passes through ASTRA permission/verification/runtime boundaries;
- bounded plan inspection now attempts the native project-context tool and streams real tool lifecycle into Brain/Command Center;
- Brain status reports native READY tool count and explicitly says MCP is not configured unless a transport is injected.

Verified by tests:
- native tool returns only registered ALURKA project context and never reads unlisted/outside/.env fixture data;
- permission and policy blocking occur before handler invocation;
- unverified completion claims are converted to failure;
- MCP fixture discovery/call executes through the exact same runtime;
- real Brain bounded-plan project inspection emits `tool.started` and `tool.completed` on the Drive visual node.

Truthful limitation:
**No production MCP transport/server is connected by this checkpoint.** Do not report MCP READY in the user's runtime. The fixture proves the adapter/runtime contract only.

Next roadmap work:
1. merge Phase 6A after CI;
2. Phase 7 — Files + GitHub production flow using executable Tool Registry;
3. add real Research/browser tooling to finish remaining Phase 5 coverage;
4. then expand communication/cloud tools under Level 3 approvals.

Sonor is not modified by this milestone.

## 2026-09-20 — Phase 5A bounded Chief orchestrator checkpoint

This branch adds real bounded plan execution on top of the validated Phase 4 Strategist plan.

Implemented:
- `lib/planner/executor.ts` executes validated plan steps sequentially according to dependencies;
- per-step permission gates stop before invoking the handler;
- bounded retries, per-step timeout, cancellation, dependency checks and output caps are enforced centrally;
- only a real handler result may produce `plan.step.completed`;
- Level 3/4 steps cannot be silently covered by the normal one-click safe-local approval path;
- planner permission floors are now agent-aware: GitHub/Communication/Business tool actions floor at Level 3, Trading tool actions at Level 4, and obvious high-impact titles floor at Level 4;
- `lib/brain/plan-executor.ts` supplies real current handlers:
  - Memory → unified Memory Manager;
  - Reason → local Ollama;
  - engineering/files/computer read-only inspection → Codex when available, otherwise bounded registered Memory/Project context;
  - safe local developer/files/computer tool action → Codex execution marker path when explicitly permitted;
  - verification → new Codex read-only VERIFICATION MODE with required completion marker;
  - Research → truthfully fails until a real research/browser tool is connected;
  - explicit approval checkpoint → waits for approval;
- complex `astraBrain.execute()` requests now use the bounded plan orchestrator; simple requests keep the existing one-shot execution path;
- real `plan.step.started/progress/completed/failed`, `plan.completed`, and `plan.cancelled` events are streamed only from actual executor state.

Important limitations:
- Phase 5 is not fully complete because real Research/browser execution is still absent;
- real MCP/tool handlers from Phase 6 remain pending;
- Level 3/4 scoped approval UI is not implemented yet;
- Sonor remains untouched by this milestone and stays delegated to the existing local Sonor/Codex mission.

Next roadmap work:
1. validate/merge this Phase 5A checkpoint;
2. implement Phase 6 executable Tool Registry handlers + MCP boundary;
3. add a real Research/browser tool and complete remaining Phase 5 delegation coverage;
4. then proceed to Phase 7 Files + GitHub production flow with verification.

## 2026-09-20 — Phase 4A real Strategist planner checkpoint

This branch implements the first real model-backed Strategist planning path without enabling autonomous plan execution.

Implemented:
- `lib/planner/generator.ts` detects explicit/multi-action goals that genuinely benefit from planning;
- Strategist uses the existing local Ollama adapter to request a structured JSON plan;
- every model-produced draft is parsed/validated and then normalized through the existing `createBoundedPlan()` safety contract;
- permission floors are conservative: reasoning 0, read/inspect/research/verify 1, local tool action 2, approval 3; the model cannot lower these floors;
- generated plans are attached to the Brain envelope;
- successful generation emits a real `plan.created` event on the Strategist visual node;
- no `plan.step.*` completion/progress events are emitted because Phase 5 execution/orchestration is not implemented yet;
- planner failure degrades gracefully and does not block the normal ASTRA chat/provider turn;
- Sonor is not modified by this milestone.

Next roadmap task after this checkpoint:
**Phase 5 — Agent Orchestrator / bounded plan executor.**
It should consume only validated `AstraPlan` steps, delegate to real existing agents/providers/tools, enforce permission/approval/cancellation/timeout/retry boundaries, emit real step lifecycle events, and verify outcomes. Do not fake step completion.

## 2026-09-20 — Sonor preservation + ASTRA UI roadmap approved

Authoritative Sonor continuation documents:
- `docs/SONOR_CODEX_MISSION.md` — preserve the existing local Sonor, audit it, back up its safe source to a private `SONOR-Workflow` repository, reuse its Graphify/Obsidian/data pipelines, expose only a minimal ASTRA compatibility API if needed, and verify the real runtime before enabling ASTRA.
- `docs/SONOR_UI_INTEGRATION.md` — ASTRA remains the everyday UI; Sonor is the advanced knowledge/workflow workspace. ASTRA should show focused Sonor-derived project context, provenance, source states and a bounded relationship subgraph, with an explicit **Open Sonor Workspace** action for the full graph.

Critical rule for future Codex sessions:
**Do not recreate, re-platform, or redesign Sonor from scratch. Codex built the current Sonor on the user's PC; locate and inspect that exact existing project first, then continue it.**

When local PC access is available, the next Sonor-specific work is:
1. locate the exact source/process serving `127.0.0.1:55127`;
2. create a recoverable backup;
3. audit source vs private/generated/runtime data;
4. preserve the safe engine source in a private GitHub repo named preferably `SONOR-Workflow`;
5. document architecture/handoff inside that repo;
6. inspect and reuse existing Sonor APIs/data paths;
7. add only the smallest read-only ASTRA compatibility endpoint if necessary;
8. validate real ALURKA/ASTRA/Graphify/Obsidian queries;
9. configure ASTRA's existing SonorBridge only after the real endpoint passes validation.

## 2026-09-20 — scoped registered project context checkpoint

Phase 3 project context now has a real read-only loading path:
- `lib/projects/context.ts` reads only paths explicitly listed in a resolved project's `docs` / `importantFiles`;
- every target must remain inside the registered `workspace` after both lexical resolution and `realpath` resolution;
- there is no recursive directory scan;
- `.env`, credentials/secrets, SSH/GPG paths, certificate/private-key formats and unsupported/binary extensions are rejected;
- per-file size and file-count limits are configurable;
- accepted files enter the existing Memory Manager with provenance source type `project`;
- Brain unified memory can combine local memory + registered project files + Sonor without special-case prompt concatenation.

This does **not** grant arbitrary filesystem access. Project identification alone still cannot read files that are not explicitly registered.

## 2026-09-20 — real Memory lifecycle telemetry checkpoint

This branch adds real retrieval telemetry emitted by the Memory Manager itself:
- `memory.search.started`
- `memory.source.queried`
- `memory.graph.matched`
- `memory.context.selected`
- `memory.search.completed`

The events are generated from actual source queries/selections, streamed through Brain SSE during retrieval, and retained in the final Brain trace. Do not replace them with UI-only animation.

## 2026-09-20 — Sonor workflow graph bridge checkpoint

The user already has a Codex-built Sonor workflow/project graph running locally at `http://127.0.0.1:55127/#graph`.

Do not rebuild Graphify or Obsidian inside ASTRA. Sonor is the existing aggregation layer for Graphify relations, Obsidian-linked notes, projects/files, and Codex + ChatGPT context.

Implemented on the ASTRA side:
- `lib/memory/sonor.ts` — strict loopback-only Sonor `AstraMemorySource`;
- `lib/brain/unified-memory.ts` — local memory + Sonor through the existing Memory Manager;
- Brain context now consumes unified memory;
- `.env.example` includes disabled-by-default Sonor settings;
- `docs/SONOR_BRIDGE.md` defines the ASTRA-compatible provenance contract;
- tests cover loopback safety, response validation, manager integration, and Brain context consuming Sonor/Graphify records.

Important limitation: the actual Sonor source/API is local to the user's PC and is not present in the connected GitHub repositories. The real endpoint path/schema still needs inspection on that PC. Do not claim the user's Sonor runtime is connected until that production-PC check succeeds.

Next local task when Codex access is available:
1. inspect Sonor source/network layer at port 55127;
2. locate an existing server-side graph/search API, or add a small read-only ASTRA compatibility endpoint;
3. configure `ASTRA_SONOR_SEARCH_PATH`;
4. run ASTRA + Sonor end-to-end using a real ALURKA/ASTRA project query;
5. verify provenance, project isolation, cancellation, bounds, and real memory lifecycle events.

## 2026-09-20 — pre-Codex-limit ASTRA MAX foundation checkpoint

Stable `main` now includes the implementation checkpoints below. Do not rebuild them.

Merged checkpoints:
- PR #57 — Phase 0/1 baseline + canonical truthful 18-node capability registry.
- PR #58 — Phase 2 Memory Intelligence foundation: provenance/source contracts + bounded multi-source manager.
- PR #59 — Phase 3 Project Registry foundation: explicit local registry + project resolution + `project.selected` Brain context/event.
- PR #60 — Phase 4 Planner safety foundation: bounded steps/retries/timeouts/dependencies/permission contracts; **no autonomous execution**.
- PR #61 — Phase 6 Tool Registry metadata foundation: provider-neutral, permission-aware, **non-executing** tool definitions.

Current stable main before this documentation checkpoint:
`968ecebae6166bcfbae1fa5f7e9e0f0e337b0ea6`

What is genuinely working now:
- 18 Command Center nodes have one canonical capability registry and truthful default states;
- unimplemented integrations show `NOT_CONFIGURED` instead of fake ONLINE;
- local memory retrieval preserves provenance/project/privacy/relevance/confidence;
- multi-source memory manager can rank, dedupe, isolate projects, bound context, survive failed sources and cancel;
- explicitly registered projects can be resolved by id/name/alias/recent activity without scanning arbitrary folders;
- Brain envelope can report selected project and memory source types;
- planner data is safety-bounded before future execution;
- tool metadata cannot claim unsafe permission levels or READY status without a provider.

Not live yet — do not claim otherwise:
- Graphify/Obsidian/Sonor adapters;
- scoped loading of project docs/workspaces into Brain context;
- model-generated Strategist plans;
- multi-step plan executor;
- real multi-agent orchestration beyond current routing;
- executable Tool Registry handlers;
- MCP;
- real browser/research tools;
- Gmail/Calendar/Drive/CRM connectors;
- Windows Computer Agent;
- autonomous/background execution.

Next Codex work, in order:
1. Finish Phase 2 live memory-source adapters for Graphify + Obsidian (Sonor optional) using `AstraMemorySource`; preserve local/read-only defaults and provenance.
2. Emit real `memory.search.started/source.queried/context.selected/search.completed` events around actual retrieval.
3. Finish Phase 3 by loading only scoped registered project context through approved Files/Drive paths; project identification alone is not file access.
4. Implement Phase 4 real Strategist/Planner generation through a permitted provider, normalized by `createBoundedPlan`.
5. Implement Phase 5 Chief orchestration using real plan steps and truthful agent lifecycle.
6. Connect Phase 6 tool handlers/MCP behind the existing registry, permission levels, approval UI, cancellation and verification.
7. Continue the remaining ASTRA MAX and JARVIS-Class roadmap in `docs/ASTRA_MAX.md`.

Every merged foundation above passed production build, unit/integration tests, typecheck, lint and dependency audit in ASTRA CI.

## 2026-09-20 — ASTRA MAX Phase 2 memory foundation checkpoint

The provider-neutral Memory Intelligence foundation is implemented and validated on `astra/astra-max-memory-foundation`.

Completed:
- provenance/source contracts in `lib/memory/contracts.ts`;
- local-memory retrieval now returns provenance, project, privacy, relevance and confidence while keeping the old bounded text/entry interface compatible;
- Brain envelope reports retrieved memory source types;
- `lib/memory/manager.ts` provides bounded multi-source ranking, dedupe, project isolation, cancellation and graceful source-failure handling;
- event type contracts exist for future real memory lifecycle telemetry;
- automated tests cover local provenance, Brain source reporting, multi-source isolation, dedupe and cancellation.

Important limitation: Graphify, Obsidian and Sonor are **not connected yet**. Do not report them as live. They should plug into the new `AstraMemorySource` contract later.

Next safe foundation work: **Phase 3 Project Registry**. It must read only explicitly registered project metadata and must not scan arbitrary user directories.

## 2026-09-20 — ASTRA MAX Phase 0–1 implementation checkpoint

Phase 0 and Phase 1 are implemented on `astra/astra-max-production` and validated by CI.

Completed:
- baseline locked from stable `main` `15ed870f...` with recoverable pre-MAX backup;
- canonical 18-node capability registry added at `lib/agent/capabilities.ts`;
- Brain visual-node routing now uses the canonical registry;
- Command Center roster and overview use the same registry;
- unimplemented/unconfigured skills/integrations show `NOT_CONFIGURED` instead of misleading ONLINE status;
- registry invariants are covered by automated tests;
- build, tests, typecheck, lint and dependency audit passed.

Next automatic task: **Phase 2 — Memory Intelligence foundation**. Add provider-neutral provenance/source contracts while preserving bounded local-memory retrieval. Live Graphify/Obsidian integration should follow those contracts and must remain local/read-only by default until explicitly configured.

## 2026-09-20 — JARVIS-Class continuation approved

The ASTRA MAX mission now continues beyond the core release through **Phase 21–30 JARVIS-Class Expansion** in `docs/ASTRA_MAX.md`.

Phase 20 is a core release gate, not the final stop. After it is stable, Codex should continue automatically through always-on voice, identity/trust/secrets, screen/vision context, proactive event engine, durable background tasks, episodic memory/context fusion, secure multi-device presence, self-diagnostics/recovery/offline mode, skill/IoT expansion, and final JARVIS-Class integration/reliability validation.

Do not interpret “JARVIS-Class” as permission for hidden surveillance, unrestricted autonomy, or fictional/impossible capability claims. All existing ASTRA permission, privacy, truthful telemetry, verification, loopback/local-first and emergency-stop rules remain in force.

Ultimate roadmap stop condition: Phase 30 and its verified final status.

## 2026-09-20 — ASTRA MAX continuation approved

The approved continuation mission is now `docs/ASTRA_MAX.md`.

Codex must treat that document as the production roadmap from the current stable Brain V1 / V15 / V13 state through the final ready-to-use release. Do not rebuild completed foundations. Continue the phases sequentially, commit recoverable checkpoints, validate each milestone, and keep this handoff plus `docs/ASTRA_ROADMAP.md` and `docs/ARCHITECTURE.md` updated.

Key product decision:
- all 18 ReasoningWeb nodes must become truthful real capabilities, skills, tools/integrations, or explicit unavailable/not-configured states;
- no fake ONLINE agents, fake tool work, fake telemetry, or fake success;
- Graphify + Obsidian/Sonor memory intelligence is included in the roadmap, followed by Project Registry, Planner/Orchestrator, Tool Registry/MCP, Files/GitHub, business specialists, communication integrations, Design/Social, Computer Agent, multimodal/voice, Command Center MAX, automation, hardening, release candidate, Windows ready-to-use, and final release;
- Codex should continue automatically milestone-to-milestone and stop only when a genuine external action (OAuth/login/device permission/high-impact approval) requires the user.

Current stable baseline before ASTRA MAX implementation: `main` at or newer than `9aaa2b2`.

For the complete mission, read `docs/ASTRA_MAX.md` before implementation.

## 2026-09-19 — Brain V1 local release verification

- B1–B8 implementation is complete in `astra/brain-v1-complete`.
- Production UI was verified at `http://127.0.0.1:3017` with zero browser console errors.
- Ollama `0.34.2` + `qwen3.5:4b` completed a short local chat. Extended thinking is disabled by default for responsive chat. Ollama tool execution remains intentionally unavailable until trustworthy provider telemetry exists.
- Codex CLI `0.155.0`, using the existing ChatGPT login, completed both a read-only project query and a per-request approved write with exact content verification. This PC's managed requirements reject `workspace-write`, so local execution uses the explicit danger-mode opt-in while external actions/cloud remain disabled.
- Hidden logon tasks `ASTRA-Agent` and `ASTRA-Ollama` plus an `ASTRA` desktop shortcut were installed and verified. Both services remain loopback-only.
- Sonor/Graphify/Obsidian integration is intentionally the next stage. Hermes remains disabled. Physical microphone input was not verified by browser automation.

This file is the short operational context for Codex. For the full history, read `docs/ASTRA_CONVERSATION_HISTORY.md`.

Last updated: 2026-09-19

## Current project state

Brain V1 foundation B1–B8 is implemented on feature branch `astra/brain-v1-complete`:
- cancellable streaming API and real event bus;
- Hermes guarded by gateway review and one-use approval;
- explicit Ollama/Codex selection with exact Ollama model enforcement;
- Codex CLI engineering adapter, disabled until an allowed CLI/login is verified;
- bounded project memory and explicit save;
- Codex/Hermes execution delegation and permission gates;
- real Command Center status/timeline;
- shared Humanoid/Brain lifecycle;
- 12 security/integration tests plus build/typecheck/lint/audit CI.

Runtime facts must remain distinct from code readiness. On 2026-09-19, the Codex desktop binary could not be launched directly from WindowsApps. An isolated official Codex CLI 0.155.0 was then installed under `D:\ASTRA-Tools`; its existing ChatGPT login and one read-only ASTRA task were verified. This machine-level path is intentionally not committed. Sonor memory integration is the next stage after this branch is stable.

Repository:
- `valoranttgm123-svg/ASTRA-AI-Agent`

Current stable architecture:
- ASTRA Humanoid V13
- gesture control: PINCH / OPEN PALM / FIST
- loud synthesized shockwave SFX + presence layer
- GPU particle renderer
- image-driven approved artwork
- real mic/speech state wiring
- camera index-finger head tracking
- runtime `stopInteraction()` for real cancellation
- ASTRA Brain Adapter + real event trace
- Hermes primary local gateway + Ollama fallback
- local durable Memory/Skills
- Codex CLI engineering specialist
- central tool/side-effect permission policy
- optional paid cloud guard, OFF by default
- Command Center provider/feature telemetry

V13:
- PR #41 merged to `main`
- backup: `backup/humanoid-v12.1.3-before-v13-gesture-control`

## V13 implementation summary

Existing MediaPipe worker:
- `components/lab/handTracker.worker.ts`
- model: existing MediaPipe Hand Landmarker
- no new model added.

Gesture detection:
- PINCH;
- OPEN PALM;
- FIST.

Stabilization:
- three stable inference frames for gesture;
- two neutral frames to release;
- ~900 ms cooldown;
- same HIGH/LOW worker cadence as index tracking.

Gesture actions:
- PINCH → replay assembly;
- OPEN PALM → begin listening/mic;
- FIST → `runtime.stopInteraction()`.

Runtime stop action:
- abort in-flight request;
- stop/abort recognition;
- cancel speechSynthesis;
- clear agent;
- set runtime/avatar to IDLE.

UI:
- GESTURES ON/OFF;
- stable gesture indicator;
- last action;
- pinch ratio;
- extended finger count;
- existing camera head tracking remains available.

## Humanoid current architecture

Important files:
- `components/lab/HumanoidLabV9.tsx`
- `components/lab/AstraGpuParticles.tsx`
- `components/lab/useFingerTracking.ts`
- `components/lab/handTracker.worker.ts`
- `components/AstraRuntime.tsx`

Approved art:
- `public/assets/astra-humanoid/astra-idle-v1.webp`

Renderer:
- React Three Fiber / Three.js;
- two active particle draw passes;
- custom GPU vertex/fragment shader;
- HIGH DPR 1.5;
- MSAA OFF;
- sRGB;
- NoToneMapping.

GPU shader currently handles:
- head yaw/pitch;
- chest/breathing;
- assembly;
- state energy;
- voice energy;
- luminance lift;
- round point shaping;
- final shockwave.

## Current SFX

Shockwave SFX is synthesized with Web Audio API.

Layers:
- low core pulse;
- electric rise;
- filtered noise;
- low impact;
- mid-frequency presence layer.

V12.1.3 added:
- stronger pre-limiter gain;
- DynamicsCompressor limiter;
- post-limiter output gain;
- TEST SFX button.

If TEST SFX is silent, check browser/Windows output routing before increasing gain again.

## Approved Brain direction

See `docs/ASTRA_BRAIN_V1.md`.

Target:

```text
Humanoid / Chat / Mic / Gesture
        ↓
ASTRA Runtime / Event Bus
        ↓
ASTRA Brain Adapter
        ↓
Hermes Agent
   ├─ Ollama local
   ├─ Codex engineering
   ├─ Memory
   ├─ Skills
   └─ Tools / MCP
        ↓
Command Center real-time events
```

Paid cloud:
- optional;
- OFF by default;
- requires both `ASTRA_CLOUD_ENABLED=true` and `ASTRA_ALLOW_PAID_CLOUD=true`;
- never silently used.

Brain provider order:
- engineering/GitHub: Codex → Hermes → Ollama → explicit cloud → routing-only;
- other routes: Hermes → Ollama → explicit cloud → routing-only.

Private memory:
- default file `.astra/memory.json`;
- gitignored;
- not sent to Codex/cloud unless explicitly enabled.

## Command Center rule

The existing graph/dashboard should become a real ASTRA Command Center.

Do not animate fake work.

It should react to real events such as:
- `agent.started`;
- `agent.completed`;
- `tool.started`;
- `tool.completed`;
- `task.progress`;
- `brain.response.ready`;
- errors/cancellations.

Humanoid should consume high-level state.
Command Center should consume detailed Brain/runtime activity.

## Performance history / constraints

The user repeatedly reported lag and dark/unclear particles.

Major fixes already done:
- CPU per-particle motion moved to GPU;
- subset buffer sync removed;
- two draw passes only;
- MSAA removed;
- fullscreen CSS blur/backdrop-filter removed;
- software renderer diagnostics added;
- particle clarity and luminance remapped in shader.

Do not casually reintroduce:
- per-frame full particle CPU loops;
- many synchronized geometries;
- fullscreen blur over animated Canvas;
- extra particle renderers;
- high additive overdraw.

Optimize architecture before lowering HIGH quality.

## User-approved development rules

- preserve approved artwork;
- no replacement/generated humanoid art unless explicitly asked;
- use recoverable backup branches;
- CI must pass before merge;
- keep GitHub docs updated for future Codex sessions;
- no secrets committed;
- prefer local/free components before paid cloud;
- direct implementation is preferred over lengthy speculation.

## Next work after Brain V1

Brain V1 architecture is implemented. Do not rebuild these layers from scratch.

Next work:
1. validate/tune V13 gesture thresholds on the target camera only if real camera tests need it;
2. configure local `.astra/memory.json` / `.astra/skills.json` when private context is desired;
3. verify Codex CLI availability/auth on the target Windows machine;
4. configure Hermes-side MCP/tool permissions to match ASTRA's policy flags;
5. add provider-native `tool.started/tool.completed` telemetry only when Hermes/Codex exposes trustworthy events;
6. add explicit UI approval flows before enabling destructive side effects;
7. keep paid cloud OFF unless the user deliberately opts in;
8. continue performance/UX work without degrading HIGH Humanoid quality.

## Local validation

Development:

```powershell
cd C:\WINDOWS\system32\ASTRA-AI-Agent
git checkout main
git pull origin main
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

Production:

```powershell
npm run build
npm run start
```
