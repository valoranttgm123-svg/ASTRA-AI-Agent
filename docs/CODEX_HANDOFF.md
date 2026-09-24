# ASTRA Codex Handoff

## 2026-09-24 — post-remediation hardening active

ACTOR: ChatGPT
DATE: 2026-09-24
AREA: Computer Agent fail-closed boundaries
STATE: ACTIVE
BRANCH/PR: `fix/fail-closed-remote-read-config-root-20260924`
CHANGED:
- explicit remote read failure/unavailability blocks on the requested node instead of falling through to planner;
- node-registry root schema rejects secret-like/unknown fields;
- regression tests cover root secret and unsupported-root rejection.
BLOCKER:
- none repository-side; newest-head CI/merge still required.
NEXT:
- ChatGPT owns this focused PR through CI and merge;
- Codex continues target evidence only after the repository follow-up is merged.
DO NOT REPEAT:
- do not create a second remote-read path or registry format;
- preserve PR #233 architecture.


## 2026-09-24 — PR #233 merged; target validation resumes

ACTOR: ChatGPT
DATE: 2026-09-24
AREA: Computer Agent / SSH hardening / continuity
STATE: REPO_DONE_TARGET_PENDING
BRANCH/PR: #233
MERGE/COMMIT: `52135e16f4113460807ff9005a72ba7efc53d911`
CHANGED:
- explicit remote read-only node targeting is preserved;
- system-info timeout now safely exceeds SSH connect timeout;
- nested secret/unknown node fields fail closed;
- SSH node registry uses temp-validate-replace semantics;
- MEM-X/Sonor status and tracker duplication were synchronized;
- safe warning cleanup completed without changing approved humanoid artwork paths.
VALIDATED:
- PR #233 ASTRA CI SUCCESS;
- 459 tests / 457 pass / 0 fail / 2 Windows-only skips;
- build/typecheck/lint/dependency audit/diff check PASS;
- dependency audit: 0 vulnerabilities.
BLOCKER:
- physical SSH alias/name resolution and target evidence remain outside Git.
NEXT:
- install/update exact clean current main on target PC;
- verify runtime build identity;
- resolve verified SSH aliases and bootstrap the private node registry;
- run PC2-PC4 Owner Mode/admin/file/service/wrong-node/offline/STOP-KILL/multi-step evidence.
DO NOT REPEAT:
- do not recreate PR #233;
- do not rebuild multi-PC transport;
- do not redo PC1 Owner Mode;
- do not repeat broad Sonor retrieval/provenance validation.


## 2026-09-24 — audit remediation PR #233 handoff

ACTOR: ChatGPT
DATE: 2026-09-24
AREA: Computer Agent / SSH hardening / continuity
STATE: ACTIVE
BRANCH/PR: `fix/audit-followups-20260924` / #233
CHANGED:
- preserve explicit remote node in direct read-only Computer fast path;
- align system-info timeout with bounded SSH connection timing;
- recursively reject secret-like node config and unknown fields;
- temp-validate-replace private SSH registry writes;
- synchronize MEM-X/Sonor canonical status;
- deduplicate/normalize NVIDIA/JARVIS/recovery trackers;
- clean safe non-visual warnings and Humanoid V9 hook dependencies.
VALIDATED SO FAR:
- regression tests were added in-repo; newest-head CI must still pass before merge.
BLOCKER:
- physical PC2-PC4 and release evidence remains target-only and must use the post-merge exact clean build.
NEXT:
- ChatGPT owns PR #233 through CI/merge;
- Codex then installs/verifies exact current main and resumes real target evidence.
DO NOT REPEAT:
- do not create another Computer transport;
- do not redo the broad Sonor retrieval/provenance audit;
- do not start a competing fix while #233 is active.


## 2026-09-24 — full audit handoff

ACTOR: ChatGPT
DATE: 2026-09-24
AREA: whole-project audit / Computer / continuity / release readiness
STATE: ACTIVE
BRANCH/PR: docs/full-audit-20260924
CHANGED:
- added `docs/FULL_AUDIT_2026-09-24.md`;
- recorded repo defects, stale docs, duplicate tracker items, target-build drift and target-only gates.
VALIDATED:
- PR #217-#231 merged;
- no open PR/issues at audit start;
- latest #231 PR-head CI success;
- 457 tests / 455 pass / 0 fail / 2 Windows-only skips;
- npm audit 0 vulnerabilities.
BLOCKER:
- final target evidence must wait for focused repo follow-up fixes and a clean exact-build install.
NEXT:
- ChatGPT fixes the audited repository/doc defects first;
- Codex then installs/verifies exact clean main and resumes PC2-PC4 + release evidence.
DO NOT REPEAT:
- do not rebuild multi-PC transport;
- do not redo PC1 Owner Mode;
- do not redo broad Sonor retrieval/provenance audit;
- do not validate final PC2-PC4 behavior on an older build.


## 2026-09-24 — improvement acceptance addendum

ACTOR: ChatGPT
DATE: 2026-09-24
AREA: collaboration / refinement policy
STATE: DONE
CHANGED:
- clarified that good Codex improvements are welcome;
- Codex should refine existing work by default, but may replace/refactor when a clearly better evidence-backed approach improves ASTRA;
- unjustified competing implementations remain prohibited.
VALIDATED:
- policy synchronized across collaboration protocol, AGENTS, refinement contract, pointer, tracker and worklog.
BLOCKER:
- none.
NEXT:
- evaluate future ChatGPT/Codex proposals on technical merit and evidence.
DO NOT REPEAT:
- do not reject a better Codex solution merely because ChatGPT implemented the first version;
- do not replace working architecture without documented reason/evidence.


## 2026-09-24 — no-competition work ownership addendum

ACTOR: ChatGPT
DATE: 2026-09-24
AREA: project collaboration / work ownership
STATE: DONE
CHANGED:
- ChatGPT is responsible for completing all safe repository-side work it can verify.
- Target-PC/provider/runtime-only remainder must be explicitly handed to Codex.
- Codex must refine/finish incomplete ChatGPT work rather than create a competing implementation by default.
- ACTIVE work must be inspected/continued before either agent starts another implementation in the same subsystem.
- Parallel work is allowed only for independent slices.
VALIDATED:
- collaboration documents updated together on one branch.
BLOCKER:
- none for the policy itself.
NEXT:
- apply this relay model to every subsequent ASTRA task.
DO NOT REPEAT:
- do not duplicate another agent's ACTIVE, merged, BLOCKED or REPO_DONE_TARGET_PENDING work.


## 2026-09-24 — mandatory ChatGPT ↔ Codex collaboration handoff

ACTOR: ChatGPT
AREA: project continuity / cross-session memory
STATE: DONE
CHANGED:
- added `docs/ASTRA_COLLABORATION_PROTOCOL.md`;
- made the protocol mandatory from `AGENTS.md` and `SESSION_RECOVERY.md`;
- linked the rule from `CURRENT_EXECUTION_POINTER.md` and `JARVIS_PROGRESS_TRACKER.md`;
- recorded the rule in `ASTRA_WORKLOG.md` and the Codex refinement contract.
VALIDATED:
- repository state before this slice had no open PR and current multi-PC baseline remained merged;
- no ASTRA runtime behavior was intentionally changed.
NEXT:
- Codex/ChatGPT must read live main/CI/open PRs and the collaboration protocol before any new implementation.
DO NOT REPEAT:
- do not recreate merged work because a chat/session was interrupted;
- do not leave a meaningful code/runtime/provider change without synchronizing roadmap/pointer/worklog/handoff;
- do not treat BLOCKED or REPO_DONE_TARGET_PENDING as NOT_STARTED.


## 2026-09-24 — browser WebGL fallback

PR #223 is merged and installed: 446 tests/build/typecheck/audit passed; harmless
Owner Mode cancellation removed the witnessed shell in observed 440 ms. Sonor
retrieval passed for ASTRA and ALURKA. Final evidence is recorded on PR #223.
Browser inspection then reproduced repeated WebGL initialization rejection on
chat/control rerenders. The next patch gates R3F mounting behind one bounded
WebGL2 probe, keeps the existing SVG ring/approved humanoid image, and prevents
GPU-unavailable performance capture. See `WEBGL_FALLBACK_2026-09-24.md`.
Do not describe browser-denied GPU fallback as hardware 3D/HIGH verification.

## 2026-09-24 — actual runtime recovery

PR #222 is merged and CI #604 passed. Actual target inspection then found a
development server returning HTTP 500 and no Ollama listener, despite older
self-check evidence reporting Ollama READY from Hermes/Strategist availability.
The focused correction isolates Node instrumentation, detaches the hidden Ollama
console lifetime and exposes its independent readiness probe. Development HTTP
recovery, live Ollama tags and the harmless Owner Mode marker were rechecked.
See `RUNTIME_RECOVERY_2026-09-24.md`; clean production build/install and exact
commit evidence are required before claiming a release. Sonor is unchanged.

## 2026-09-23 — target-PC prompt-prefill refinement

After PR #213, warm Ollama SSE starts in 267–336 ms, but an uncached prompt prefix
still incurs seconds of CPU work. Direct metadata isolated 6,822 ms prompt eval
versus 3.5 ms model load. The compact lightweight-only prompt preserves project
memory, permissions and explicit provider preferences. Read
`OLLAMA_PREFILL_REFINEMENT_2026-09-23.md` for measured baseline/correction.
Recheck the exact clean build; physical voice/camera, approved actions,
multi-device transport and final release gates remain open.

## 2026-09-23 — Ollama / Next SSE latency handoff

Read `OLLAMA_SSE_LATENCY_HANDOFF_2026-09-23.md` before changing the Ollama streaming path. It records the measured target-PC evidence, the failed PR #209 transport experiment, the PR #210 revert, the separate `ASTRA_AUTO_PROVIDER=codex` delay, and the exact next timing boundaries to instrument. Do not restart this investigation from zero or reintroduce the Node `http.request` experiment without new evidence.
## 2026-09-23 — current local refinement

Read `TARGET_PC_REFINEMENT_2026-09-23.md` for the Windows npm/process shutdown,
provider persistence, read-only Hermes Runs and Sonor hardening slice.
PR #188 is merged. Do not reimplement the newer JARVIS/NVIDIA foundations.
Do not claim release READY before the combined build/runtime evidence passes.

PR #189 is now merged at `2a5d2c40cddfa811c27b59aae2bfcf1795d28d8c`
(CI #530 SUCCESS). The next Windows fix covers console-interruption exits,
bounded startup probe timing and npm execution in the repository-gate script.
Browser STOP returned IDLE/ERR_ABORTED; Level-2 unapproved occurrence stayed
unclaimed. Physical voice/camera, approved occurrence STOP and final release
measurements are still separate gates. See the detailed dated refinement note.

## 2026-09-20 — Phase 13 Command Center MAX

Implemented on `astra/phase13-command-center-max`:

- Brain status now publishes a truthful per-node runtime snapshot for all 18 Command Center nodes;
- snapshot status is derived from real provider/tool availability, not legacy visual flags;
- CRM / Calendar / Email are evaluated independently from their exact read tools;
- Drive reflects registered local file capability separately from optional cloud Drive;
- Developer reflects Codex availability;
- Strategist reflects local Ollama planner availability;
- Researcher reflects real Research runtime availability;
- Engineering remains honestly NOT_CONFIGURED until a separate specialist contract exists;
- Design status distinguishes working brief reasoning from optional image-generation/edit providers;
- new pure runtime overlay maps real SSE lifecycle events to node states:
  - ACTIVE;
  - WAITING_APPROVAL;
  - BLOCKED;
  - ERROR;
  - reset to server base state after completion/response;
- provider-unavailable alone does not fabricate terminal failure because fallback may still succeed;
- ReasoningWeb accepts real node state as part of its roster and colors/dims nodes accordingly;
- static legacy `live=true/false` is no longer the Command Center truth source;
- selected Agent Overview uses the same per-node runtime state/detail;
- accessible capability list includes real status labels;
- new request clears stale prior response/plan before streaming starts;
- Brain panel now shows:
  - provider + feature readiness;
  - trusted input source/trigger;
  - current/last returned plan and step statuses;
  - scoped approval request;
  - expanded live event timeline;
- tests cover all 18 node snapshots, lifecycle overlays, reset behavior, and provider fallback truth.

Important truth:
The visual web still uses the existing SVG design, but its operational state is now driven by Brain status + real SSE events. A node appearing in the graph does not imply a capability is configured.

Next milestone:
**Phase 14 — Automation**: safe scheduled workflows under the same Tool Runtime permission, approval, cancellation, and verification model.

## 2026-09-20 — Phase 12 Voice + Multimodal input unification

Implemented on `astra/phase12-multimodal-input-envelope`:

- one bounded trusted input metadata contract for ASTRA Runtime → API → Brain;
- current accepted message sources:
  - text;
  - voice transcript;
- trusted triggers:
  - keyboard;
  - microphone;
  - gesture_open_palm;
  - api;
- bounded modalities enum:
  - text;
  - voice;
  - gesture;
  - camera;
  - image;
  - screen;
- explicit consent booleans for microphone/camera/image/screen;
- `visualContentProvided` is forced to `false` in Phase 12;
- image/screen modalities are rejected by the HTTP parser because no real visual payload/provider path exists yet;
- gesture-open-palm voice input requires voice + gesture + camera metadata and microphone/camera consent;
- normal typed chat is tagged text/keyboard;
- microphone chat is tagged voice/microphone;
- open-palm-triggered microphone chat is tagged voice/gesture/camera with `gesture_open_palm`;
- no webcam frame, image pixel, or screen pixel is sent to the Brain;
- trusted input metadata is injected into provider context with an explicit instruction not to infer unseen visual content;
- input metadata is preserved in `brain.context.input` for observability;
- Brain status exposes a truthful `multimodal` feature;
- Command Center exposes an MM status chip;
- regression tests cover text metadata, gesture-triggered voice metadata, consent consistency, rejection of visual payload claims, Brain envelope propagation, and feature status.

Important truth:
Phase 12 unifies input provenance/consent. It does **not** add visual understanding. Camera remains local for gesture tracking/control. Image and screen understanding remain NOT_CONFIGURED until an explicit visual payload, consent, and provider/tool path is implemented.

Next milestone after merge:
Follow the current ASTRA roadmap from `main`; do not recreate existing voice/gesture/camera foundations.

## 2026-09-20 — Phase 11 controlled Computer Agent checkpoint

Implemented on `astra/phase11-controlled-computer-agent`:

- controlled Windows Computer Agent transport;
- OFF by default unless `ASTRA_COMPUTER_ENABLED=true`;
- non-Windows runtime reports OFFLINE rather than READY;
- canonical tools:
  - `computer.process.list` — Level 1 read-only;
  - `computer.app.launch` — Level 2 local action;
- app launch requires the existing `allowShell` policy gate;
- app launch accepts only fixed app IDs:
  - notepad
  - calculator
  - paint
  - explorer
- no arbitrary executable path;
- no arbitrary PowerShell/cmd string;
- no generic shell tool introduced;
- process listing uses bounded `tasklist.exe /FO CSV /NH` and caps returned rows;
- launch success is verified from the OS child-process `spawn` event, not merely an initial PID field;
- Tool Runtime cancellation/AbortSignal propagates into Computer transport;
- Brain exposes Computer Agent readiness and Command Center shows a PC feature chip;
- planner permission floors keep process-list read at Level 1 and app launch at Level 2;
- tests cover OFF-by-default state, selective capability exposure, Level-1/Level-2 gates, allowShell policy, and cancellation.

Global STOP semantics:
- STOP/Abort cancels work that is still in flight;
- once an allowlisted app has already been successfully spawned and the tool completed, STOP does not retroactively close that user application;
- ASTRA does not claim rollback for a completed launch.

Important truth:
The target Windows PC has not yet been physically validated in this GitHub CI environment. CI validates contracts/fixtures and non-Windows OFFLINE behavior. Real target-PC validation remains required before declaring desktop execution production-validated.

Next milestone:
**Phase 12 — Voice + Multimodal unification**: audit and unify the already-existing text/mic/gesture/camera foundations, add truthful input-source context, and keep image/screen capabilities NOT_CONFIGURED until real providers/consent paths exist.

## 2026-09-20 — Phase 10 Design + Social checkpoint

Implemented on `astra/phase10-design-social`:

- truthful Social drafting skill for captions, content calendars, hooks, reels/video scripts and CTA preparation;
- truthful Design briefing skill for composition, hierarchy, dimensions, copy, assets and acceptance criteria;
- skill lifecycle maps to Social / Design visual nodes;
- provider-neutral `AstraCreativeTransport`;
- canonical Level-3 tools:
  - `design.image.generate`
  - `design.image.edit`
  - `social.publish`
  - `social.schedule`
- default creative tools remain `NOT_CONFIGURED`;
- only capabilities explicitly reported by a real provider become `READY`;
- creative/provider success requires `verified=true`;
- generation/edit/publish/schedule remain Level-3 external actions behind scoped approval;
- Social drafting remains an implemented local/model skill and does not claim publishing;
- Design node is partial/NOT_CONFIGURED until an actual image provider is connected;
- live Brain/Command Center creative status added;
- regression coverage for skill selection, node mapping, provider readiness, Level-3 gates, policy blocking and verification truth.

Important truth:
No image-generation or social-network provider is claimed connected by default. A draft/brief is not a generated asset, and a prepared social post is not a published post.

Next milestone:
**Phase 11 — controlled Computer Agent** with an OFF-by-default execution transport, allowlisted Windows operations, permission gates, cancellation and global STOP.

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
---

## Handoff update — Phase 14A automation foundation — 2026-09-20

Current feature branch:

`astra/phase14a-automation-safety-foundation`

Completed in this slice:

- `lib/automation/contracts.ts`;
- `lib/automation/scheduler.ts`;
- `lib/automation/index.ts`;
- `tests/automation.test.ts`;
- lint scope now includes `lib/automation`;
- deterministic once/interval due calculation;
- minimum recurring frequency of 60 minutes;
- unattended Permission Level 1 ceiling;
- per-run approval requirement for Level 2/3;
- Level 4 scheduling rejection;
- pause/disable semantics and runtime bounds.

Do not replace this with an unrelated cron package or a second permission system.

Next exact task after this branch is validated/merged:

**Phase 14B — durable local scheduler runtime.**

Implement a private local automation store under `.astra/`, a bounded cancellable queue/worker, real lifecycle telemetry, and per-run approval binding into the existing Brain/Planner/Tool Runtime. Do not execute Level 2/3 work merely because a job exists. Level 4 must remain unavailable to scheduled automation.

External/target-PC validation is still required before Phase 14 is complete.
## Handoff update — Phase 14B private automation store

Added on stacked branch `astra/phase14b-automation-store`:

- `lib/automation/store.ts`;
- `tests/automation-store.test.ts`;
- private `.astra/automations.json` default;
- strict/fail-closed parsing;
- bounded entries and file bytes;
- duplicate-ID rejection;
- automation enable kill switch;
- symlink-target rejection.

Next exact task:

**Phase 14C — bounded scheduler worker + runtime integration.**

The worker must load only validated definitions, execute at most one bounded occurrence per job window, propagate AbortSignal/global STOP, never bypass Planner/Tool Runtime, emit real automation lifecycle events, and pause Level 2/3 occurrences at the existing approval boundary. Do not introduce permanent approval or Level-4 scheduling.
## Handoff update — Phase 14C1 bounded queue planner

Added:

- `lib/automation/queue.ts`;
- `tests/automation-queue.test.ts`;
- bounded unattended ready queue;
- separate approval queue for Level 2/3;
- deterministic ordering and next-wake calculation;
- automation lifecycle event type contracts with no fake emission.

Next exact task:

**Phase 14C2 — real cancellable automation runner.**

The runner must use validated store definitions and the queue planner, claim each occurrence durably before execution to avoid duplicate runs, invoke existing Brain/Planner/Tool Runtime through an injected boundary, propagate global AbortSignal/STOP, emit lifecycle events only around real work, and persist terminal occurrence state. Level 2/3 must resume only after the current occurrence receives valid scoped approval. Level 4 remains unavailable.
## Handoff update — Phase 14C2 read-only runner

Added:

- `lib/automation/runner.ts`;
- durable `claimAutomationOccurrence()`;
- serial read-only runner tick;
- per-job timeout;
- global AbortSignal/STOP propagation;
- real automation lifecycle emission;
- regression coverage for duplicate claims and cancellation.

Next exact task:

**Phase 14D — approval-resume + runtime/API integration.**

Bind Level 2/3 scheduled occurrences to the existing scoped approval machinery without permanent trust, expose safe loopback CRUD/status controls, connect real automation lifecycle into Brain/Command Center, and only then add an explicit local timer/service. Level 4 remains unavailable.
## Handoff update — Phase 14D1 automation API + telemetry

Added:

- `app/api/automation/route.ts`;
- `lib/automation/http.ts`;
- `lib/automation/management.ts`;
- `lib/automation/telemetry.ts`;
- process-local serialized store mutation shared with occurrence claims;
- automation lifecycle types in the Brain event contract;
- Ops Command Center mapping for real automation lifecycle;
- API/management/telemetry regression tests.

Next exact task:

**Phase 14D2 — scoped approval-resume for scheduled Level 2/3 occurrences.**

Do not invent permanent trust. A scheduled occurrence must be bound to a short-lived, single-use approval challenge for that exact automation id + scheduled occurrence + permission level. Level 2 may use the existing explicit safe-local approval semantics; Level 3 must retain the existing strong external-action checks and policy/provider availability. Level 4 remains unavailable.

After approval-resume is validated, add an explicit runtime event stream/control path and only later an opt-in timer/service.
## Handoff update — Phase 14D2 approval-resume

Added:

- `lib/automation/approval.ts`;
- `app/api/automation/run/route.ts`;
- bounded run-request parser;
- exact occurrence Brain input;
- `requirePlan` execution option;
- Level 2 per-occurrence approval;
- Level 3 reuse of the existing scoped Brain approval token;
- permission-ceiling enforcement;
- approval-resume regression tests.

Next exact task:

**Phase 14D3 — live automation stream + UI control integration.**

Add an SSE path for automation occurrence lifecycle and underlying Brain events so Command Center can update live. Then add a minimal Automation panel using the existing loopback definition API: list status, create/edit paused definitions, enable/pause/disable, approve exact due Level 2/3 occurrence, show Level-3 scope, STOP active run.

Do not start an always-on Windows timer/service until the live control/STOP path is proven.
## Handoff update — Phase 14D3A automation SSE

Added:

- `app/api/automation/run/stream/route.ts`;
- real-time automation + Brain event streaming;
- final result/error SSE frames;
- request-abort propagation.

Next exact task:

**Phase 14D3B — frontend Automation controls + Command Center stream consumption.**

Reuse this SSE endpoint. Do not create a second event bus. Append streamed Brain events into the existing ASTRA Runtime event list so the existing Ops capability mapping drives the Command Center truthfully.
## Handoff update — Phase 14D3B1 Runtime integration

Added to `components/AstraRuntime.tsx`:

- `runAutomationOccurrence()`;
- automation SSE parsing;
- shared Brain event append path;
- shared request controller / STOP behavior;
- `automationStreaming` UI state.

Next exact task:

**Phase 14D3B2 — minimal Automation panel.**

Use the existing `/api/automation` definition API and `runAutomationOccurrence()`. The panel should show definitions/queue state, allow create/edit in paused state, enable/pause/disable/delete, approve exact due Level-2/3 occurrences, display existing Level-3 scope, and call the existing global STOP. Do not add an always-on timer yet.
## Handoff update — Phase 14D3B2 Automation panel

Completed:

- `components/AstraAutomationPanel.tsx`;
- panel mounted in `app/page.tsx`;
- responsive Automation styling;
- safe definition lifecycle controls;
- due Level-2/3 approval UI;
- existing Level-3 scope review;
- shared STOP button;
- Automation lifecycle coloring in Command Center.

Next exact task:

**Phase 14E — explicit opt-in local automation service.**

Implement an in-process/local-service timer that is OFF by default, executes only Permission Level 0/1 through the bounded runner, uses the real ASTRA Brain/Planner/Tool Runtime under a hard read-only permission ceiling, exposes truthful service health/status, supports server-side global STOP, prevents overlapping ticks, preserves durable at-most-once claims, and never executes Level 2/3 unattended. Then perform CI and target-PC activation validation before Phase 14 is marked complete.
## Handoff update — Phase 14E1 read-only Brain ceiling

Added:

- internal `permissionCeiling` Brain run option;
- tested permission resolver;
- hard-ceiling enforcement before plan execution;
- scoped-token/ceiling conflict block;
- `lib/automation/read-only.ts`;
- read-only automation regression tests.

Next exact task:

**Phase 14E2 — explicit opt-in in-process automation service.**

Keep the service OFF by default. Reuse the existing ASTRA local server process, prevent overlapping ticks, execute only Level 0/1 with `createReadOnlyAutomationExecutor()`, expose service status and server-side STOP, and auto-start only when `ASTRA_AUTOMATION_SERVICE_ENABLED=true`.
## Handoff update — Phase 14E2 opt-in local service

Added:

- `lib/automation/service.ts`;
- `instrumentation.ts` opt-in startup;
- `app/api/automation/service/route.ts`;
- `.env.example` automation service settings;
- `scripts/windows/enable-automation.ps1`;
- installer service-status verification;
- service lifecycle/STOP/single-flight tests.

Safety state:

- service default: OFF;
- unattended ceiling: Level 0/1;
- Level 2/3: per-occurrence approval only;
- Level 4: unavailable;
- duplicate occurrence protection: durable claim;
- active tick STOP: server-side AbortController.

Next exact task:

**Phase 14E3 — service telemetry + global STOP integration + final Phase 14 verification.**

Stream real service lifecycle events to the existing `AstraRuntime`/Command Center when the UI is connected, make global STOP abort both browser-streamed work and the server service tick, display truthful service state in the Automation panel, then run the full CI gate and document target-PC activation steps/results.
## Handoff update — Phase 14E3 final Automation integration

Implemented:

- `app/api/automation/service/stream/route.ts`;
- background service SSE status/lifecycle;
- shared Runtime ingestion into `brainEvents` / `brainTrace`;
- background Ops telemetry without foreground-agent hijack;
- global browser + server-side Automation STOP;
- truthful background service state and controls in the Automation panel;
- `tests/automation-e2e.test.ts`;
- `scripts/windows/validate-automation.ps1`;
- `docs/AUTOMATION_VALIDATION.md`.

Phase 14 implementation stop condition:

1. branch CI passes build/tests/typecheck/lint/audit;
2. merge to `main`;
3. target PC explicitly opts in only if desired;
4. run `scripts/windows/validate-automation.ps1`;
5. optionally run `-RunSafeTick` for one real Level 0/1 validation;
6. verify UI/STOP and due Level-2/3 approval behavior.

Do not call target-PC validation complete unless those local commands were actually run. If CI is green but local activation has not occurred, report:

`IMPLEMENTATION COMPLETE / CI VERIFIED / TARGET-PC VALIDATION REQUIRED`

After the target-PC validation passes, Phase 14 is complete and the next roadmap task is **Phase 15 — Security/failure hardening**.
---

## Handoff update — post-Phase 14 Codex execution mission

Current verified `main` baseline:

- Phase 14 final merge: PR #92;
- merge commit: `de4fbefe6f9a23792a542a74d4d0ca1aef1aa208`;
- `main` CI after merge: SUCCESS;
- Automation implementation complete;
- target-PC Automation validation still required.

The next Codex session must begin from:

`docs/CODEX_NEXT_MISSION.md`

Phase 15 tracking matrix:

`docs/SECURITY_VALIDATION.md`

Exact priority:

1. target-PC Automation validation when local PC access is available;
2. Phase 15A–15F security/failure hardening;
3. real Sonor/Graphify/Obsidian validation from `docs/SONOR_CODEX_MISSION.md`;
4. Phase 16 performance;
5. Phase 17 full-system validation;
6. Phase 18 RC;
7. Phase 19 Windows ready-to-use release;
8. Phase 20 core release gate;
9. continue Phase 21–30 JARVIS-Class roadmap.

Open PR #51 is obsolete-era telemetry work and is 461 commits behind current `main`. Do not merge it wholesale. Compare for any genuinely unique unsuperseded behavior/tests, port only those pieces if needed, then close it as superseded.

Do not restart or redesign the completed Phase 14 architecture.

---

## Handoff update — Phase 15A project path/filesystem hardening

Implemented on `astra/phase15a-path-hardening`:

- writable project paths now use `lstat()` before the existing `realpath()` verification;
- an existing writable symlink is rejected fail-closed;
- a dangling symlink can no longer be mistaken for a safe non-existing file target;
- non-`ENOENT` `lstat` failures fail closed;
- existing traversal, absolute-outside, sensitive-path, extension and parent-realpath boundaries remain intact;
- new `tests/security-paths.test.ts` covers:
  - valid workspace/file resolution;
  - valid non-existing write target inside a real parent;
  - `../` traversal;
  - absolute outside paths;
  - sensitive paths/extensions;
  - read symlink escape;
  - writable symlinked-parent escape;
  - existing and dangling writable symlinks.

Security finding fixed:

A dangling writable symlink previously caused `realpath()` to throw and the catch path treated it like a safe new file. Phase 15A now distinguishes true `ENOENT` from an existing symlink and rejects the symlink.

Next repository task after green CI/merge:

**Phase 15B — Untrusted retrieved-context / prompt-injection boundary.**

Phase 14 target-PC validation remains an external/local gate and is not claimed complete.

---

## Handoff update — Phase 15B untrusted retrieved-context boundary

Implemented on `astra/phase15b-untrusted-context-boundary`:

- added `lib/brain/context-safety.ts` as the shared retrieval safety boundary;
- unified Memory/Project/Sonor/Graphify/Obsidian records are serialized as provenance-preserving JSON data;
- retrieval content remains available as evidence; imperative text is not silently deleted;
- Ollama, Hermes, Codex and optional Cloud prompts now explicitly state that retrieved data cannot override:
  - user intent;
  - ASTRA system instructions;
  - project scope;
  - permission levels;
  - approval requirements;
  - provider privacy rules;
  - tool authorization;
- prior plan-step/tool outputs are wrapped as UNTRUSTED DATA before later reasoning steps;
- planner instructions carry the same retrieval authority boundary;
- public-web research remains source/provenance backed and already marks fetched text `untrusted=true`.

Regression coverage:

- `tests/context-safety.test.ts`;
- malicious fixture includes:
  - `IGNORE ALL PREVIOUS INSTRUCTIONS`;
  - permission-elevation attempt;
  - secret-exfiltration request;
  - shell-action request;
  - fake system-message JSON;
- test verifies the malicious content is preserved as JSON data, provenance is preserved, the policy boundary is present, and Ollama receives the trusted boundary before the retrieved content.

Security model:

Prompt formatting is defense-in-depth only. Actual authority remains enforced independently by Planner permission floors, scoped approvals and Tool Runtime policy. Retrieved content never grants an approval token or changes server-side permission state.

Next repository task after green CI/merge:

**Phase 15C — Provider + MCP failure isolation.**

Phase 14 target-PC validation remains an external/local gate and is not claimed complete.

---

## Handoff update — Phase 15C1 MCP failure isolation

PR: **#99**

Implemented:

- MCP descriptor runtime validation;
- bounded name/description/schema handling;
- normalized stable MCP tool ids;
- permission floor escalation from declared permission to side-effect minimum;
- malformed MCP call results fail unverified;
- one optional MCP discovery failure no longer destroys native/healthy Tool Runtime;
- duplicate MCP ids are isolated instead of crashing registry construction;
- MCP discovery AbortSignal is rethrown and never treated as an ordinary provider outage;
- existing Tool Runtime input/output bounds remain authoritative.

Regression tests:

- `tests/mcp-hardening.test.ts`;
- broken + healthy MCP servers together;
- aborted discovery;
- malformed/oversized descriptors;
- duplicate normalized ids;
- permission-floor mismatch;
- malformed call result;
- oversized MCP output.

P15C is **not complete** yet.

Next exact task after green CI/merge:

**Phase 15C2 — provider outage/malformed-response matrix for Ollama, Hermes, Codex and optional Cloud.**

Phase 14 target-PC validation and real Sonor validation remain external/local gates.

---

## Handoff update — Phase 15C2 provider failure matrix

PR: **#100**

Implemented:

- shared bounded provider JSON reader in `lib/brain/provider-safety.ts`;
- Ollama tags/chat responses are bounded and shape-validated;
- malformed Ollama model lists cannot report readiness;
- Hermes `/v1/capabilities` must return structured bounded JSON before status is READY;
- Hermes chat malformed/empty/oversized/HTTP-error responses fail closed;
- optional Cloud `/models` must return structured bounded JSON before status is READY;
- Cloud chat malformed/empty/oversized/HTTP-error responses fail closed;
- real loopback connection-refused cases covered for Ollama/Hermes/Cloud;
- non-loopback Hermes endpoint remains rejected;
- configured Ollama model missing remains truthful unavailable;
- Cloud remains explicit opt-in/policy gated;
- Codex absent executable remains unavailable;
- malformed Codex JSONL lines are ignored rather than treated as valid events.

Regression coverage:

- `tests/provider-hardening.test.ts`.

P15C completion status after green CI/merge:

- C1 MCP isolation/validation: complete;
- C2 provider failure matrix: complete;
- Codex child timeout/cancellation/cleanup moves into **P15D**, where STOP semantics are tested end-to-end;
- secret/error redaction remains **P15E**.

Next exact task:

**Phase 15D — Cancellation / timeout / network failure matrix.**

---

## Handoff update — Phase 15D1 cancellation/timeout matrix

PR: **#101**

Implemented:

- Ollama/Hermes/Cloud provider timeout now aborts with `TimeoutError`, distinct from user/global STOP `AbortError`;
- Tool Runtime timeout now uses an authoritative race against its internal AbortController;
- a buggy handler that ignores AbortSignal can no longer keep the ASTRA caller waiting past timeout;
- timeout cannot later emit a winning `tool.completed` event;
- user STOP returns promptly even if a buggy read handler ignores its signal.

Regression matrix in `tests/cancellation-matrix.test.ts` covers:

- Ollama in-flight STOP;
- Hermes in-flight STOP;
- optional Cloud in-flight STOP;
- provider timeout vs STOP distinction;
- Strategist cancellation through Ollama;
- in-flight Memory source cancellation;
- browser pre-network cancellation;
- Tool Runtime timeout;
- Tool Runtime global STOP;
- no late completed lifecycle event after timeout/cancel.

P15D is **not complete** yet.

Next exact task after green CI/merge:

**Phase 15D2 — Codex child-process timeout/cancellation/cleanup plus Automation/Command Center STOP settlement verification.**

---

## Handoff update — Phase 15D2 Codex STOP + runtime settlement

PR: **#102**

Implemented/verified:

- real Codex spawn path tested with deterministic Node fixture;
- malformed JSONL cannot become a successful Codex turn;
- non-zero Codex child exit fails truthfully;
- Codex timeout kills the owned child process;
- global STOP aborts Codex and kills the owned child process;
- Automation runner STOP emits `automation.started` then `automation.cancelled`;
- `automation.completed` is forbidden after STOP in the regression test;
- Command Center maps `automation.cancelled` to Ops `BLOCKED`, so Ops cannot remain `ACTIVE`;
- a later real `response.ready` may reset transient terminal state to the truthful base snapshot.

Phase 15D completion after green CI/merge:

- D1 provider/Planner/Memory/browser/Tool Runtime cancellation + timeout: complete;
- D2 Codex child + Automation/Command Center STOP settlement: complete.

Next exact task:

**Phase 15E — Secret / error / telemetry leakage hardening.**
---

## Handoff update — Phase 15E secret/error/telemetry hardening

Implemented on `astra/phase15e-secret-error-redaction`:

- added shared `lib/security/redaction.ts`;
- redacts Authorization/Bearer credentials, API/access/refresh/approval tokens, password/secret key-value pairs, common OpenAI/GitHub token patterns, JWT-like tokens, URL credentials/sensitive query parameters, and user-home paths;
- bounds public error/detail strings;
- Tool Runtime scrubs thrown handler errors and provider-supplied failure details before result/telemetry exposure;
- Codex status/child stderr/JSONL error details are scrubbed before public exceptions;
- Brain provider fallback errors are scrubbed before Runtime/Command Center telemetry;
- every live Brain event detail goes through the public redaction boundary;
- Automation occurrence/service/API/SSE error surfaces are scrubbed;
- Ollama/Hermes/Cloud status errors and public endpoint URLs are scrubbed;
- `lib/security` is included in lint;
- `.gitignore` already protects `.env*` except the template, private `.astra/`, secret/credential directories, key/cert files, and local DBs.

Regression coverage:

- `tests/security-redaction.test.ts`;
- `tests/codex-process.test.ts` includes fake secret-bearing Codex stderr.

P15E completion requires green CI and merge.

Next exact task after merge:

**Phase 15F — final security regression matrix/report and close remaining implementable PENDING REVIEW rows.**
---

## Handoff update — Phase 15F final security report

- final matrix: `docs/SECURITY_VALIDATION.md`;
- final report: `docs/SECURITY_HARDENING_REPORT.md`;
- explicit malformed planner JSON regression added;
- all repository-implementable Phase 15 rows have automated coverage;
- no known fail-open path remains in the repository-tested Phase 15 scope;
- target-PC Automation validation remains required;
- real Sonor/Graphify/Obsidian MEM-X remains local-access required;
- Level-3 UI proof remains a release gate.

Truthful Phase 15 status after green CI/merge:

`PHASE 15 REPOSITORY HARDENING COMPLETE / CI VERIFIED / LOCAL RELEASE GATES REMAIN`

Next:

- run MEM-X when target-PC/Sonor access exists;
- otherwise continue Phase 16 repository-side performance instrumentation/preparation without inventing measurements.

---

## Handoff update — Phase 16A performance measurement harness

Implemented on `astra/phase16a-performance-measurement-harness`:

- `lib/performance/statistics.ts`
  - deterministic min/max/mean/P50/P95;
- `lib/performance/sse.ts`
  - ASTRA SSE block parsing for timing-only instrumentation;
- `lib/performance/loopback.ts`
  - loopback-only measurement boundary;
- `scripts/performance/measure-runtime.ts`
  - read-only Brain/Automation status timing;
  - optional explicit Ollama ASTRA SSE timing;
  - environment snapshot without hostname/user identity;
  - output to gitignored `.astra/performance/`;
- `npm run perf:runtime`;
- performance helpers/scripts added to lint;
- Brain streaming SSE error path now uses the shared public error redaction boundary.

Automated coverage:

- `tests/performance-statistics.test.ts`;
- `tests/performance-sse.test.ts`;
- `tests/performance-loopback.test.ts`.

Important truth boundary:

**No target-PC benchmark number is claimed by this slice.**

Phase 16 remains incomplete until the harness/browser diagnostics are run on the actual target environment and `docs/PERFORMANCE_BASELINE.md` is filled from real evidence.

Next after green CI/merge:

- if target-PC access is available: run P16B/P16C measurements;
- if not: continue repository-side Phase 17 preparation that does not require inventing measurements, while leaving Phase 16 open.

---

## Repository cleanup audit — stale PR #51

Audit:

`docs/PR51_TELEMETRY_AUDIT.md`

Finding:

- old branch is 621 commits behind current `main`;
- NDJSON + `AsyncLocalStorage` telemetry architecture is superseded by current SSE + explicit `onEvent`;
- Runtime incremental telemetry, bounded history and Humanoid Brain activity are present and expanded;
- current architecture additionally includes cancellation, approvals, Automation telemetry, provider/MCP hardening and redaction;
- no unique unsuperseded code/test was identified.

Decision:

**Do not merge or cherry-pick PR #51. Close it as superseded after this audit reaches `main`.**

---

## Repository cleanup final status

Evidence:

- `docs/PR51_TELEMETRY_AUDIT.md`;
- `docs/REPOSITORY_CLEANUP.md`.

Completed:

- PR #51 closed as superseded;
- no open PR remains;
- no unique telemetry code needed porting;
- historical branches remain only as non-blocking snapshots;
- current tree scan found no tracked private/runtime path matching the cleanup filter.

Do not delete historical branches automatically. Branch pruning is a separate destructive housekeeping action.

Release gates still pending outside repository cleanup:

- target-PC Automation validation;
- real Sonor/Graphify/Obsidian MEM-X;
- Phase 16 target measurements;
- Phase 17 real execution evidence.

---

## Handoff update — Phase 19A readiness self-check

Implemented on `astra/phase19a-readonly-self-check`:

- `lib/release/readiness.ts`;
- `lib/release/private-output.ts`;
- `scripts/release/self-check.ts`;
- `scripts/windows/self-check.ps1`;
- `npm run release:self-check`.

The self-check:

- reads the running ASTRA Brain/Automation status only;
- classifies READY/OFFLINE/NOT_CONFIGURED/ERROR/UNKNOWN conservatively;
- checks Windows `ASTRA-Agent` + `ASTRA-Ollama` Scheduled Task presence/state without modifying them;
- stores private evidence under `.astra/readiness/`;
- does not read `.env` secrets;
- does not start/stop services;
- does not infer real Sonor readiness;
- does not select a release status.

Automated tests cover readiness classification and private output confinement.

Truth boundary:

**P19A provides tooling only. Phase 19 target-PC readiness remains unverified until the command is actually run on the target Windows system and the remaining install/reinstall/local gates are checked.**

---

## Handoff update — Phase 19B update/reinstall tooling

Implemented on `astra/phase19b-update-reinstall-tooling`:

- `scripts/windows/update-local.ps1`;
- `scripts/windows/reinstall-local.ps1`;
- `docs/WINDOWS_RELEASE.md`;
- `tests/windows-release-scripts.test.ts`.

Updater safety:

- active tracked changes block pull;
- active branch must match requested branch;
- `git pull --ff-only` only;
- no automatic reset/clean/discard;
- no deletion of `.env.local` or `.astra/`;
- no project/model deletion;
- rebuild + re-register install + read-only self-check.

Reinstall/repair:

- reuses existing scoped uninstaller + installer;
- removes startup registrations/desktop shortcut only;
- preserves project/model/private runtime;
- self-check runs after reinstall.

Truth boundary:

**P19B provides repository tooling only. The update/reinstall checklist remains unverified until run on the target Windows PC.**


---

## 2026-09-21 — ChatGPT repository synchronization after Phase 19G

Current `main`:

`42657c7affc776057178416c5e777de388b98787`

Merged Windows/release tooling now includes:

- P19A PR #109 — read-only readiness self-check;
- P19B PR #110 — safe update/reinstall;
- P19C PR #115 — read-only install preflight;
- P19D PR #113 — read-only release validator;
- P19E PR #114 — Ollama loopback-only hardening;
- P19F PR #116 — ASTRA loopback runtime hardening;
- P19G PR #117 — bounded startup health gate.

Repository truth:

`PHASE 19 REPOSITORY TOOLING ADVANCED THROUGH P19G / TARGET-PC VALIDATION REQUIRED`

Do not mark any physical/local gate PASS from this merge history alone.

Next exact Codex task:

1. inspect current `main`;
2. inspect draft PR #111 (Phase 18A repository RC gate);
3. reconcile its changes with current `main` because it predates P19C–P19G;
4. keep repository gate behavior non-destructive;
5. rerun tests/typecheck/lint/build/audit/diff checks through CI;
6. merge only after current CI is green;
7. update tracker/handoff/worklog;
8. continue independent repository work while leaving target-PC-only gates explicitly pending.

Local-only work still requiring the real target PC:

- Phase 14 Automation approval/STOP proof;
- MEM-X Sonor/Graphify/Obsidian real validation;
- Phase 16 performance/browser measurements;
- Phase 17 real scenario execution;
- Phase 19 install/update/reinstall/startup evidence.


---

## 2026-09-21 — Phase 18A repository RC gate merged on current main

Merged:

- PR #119;
- merge commit `6ac2b98e6f99be68b75769654e78200f54d25fac`;
- `npm run release:repo-gate`;
- deterministic test → typecheck → lint → build → high-audit → diff-check gate;
- CI full-history checkout;
- PR/push range `git diff --check`;
- regression coverage for command completeness, Windows npm executable selection and non-destructive Git behavior.

Superseded:

- draft/diverged PR #111 was closed without merge.

Truth status:

`PHASE 18A REPOSITORY GATE IMPLEMENTED / LOCAL PROGRAM GATES REMAIN`

Remaining release evidence still requires the real target environment:

- Phase 14 Automation approval/STOP;
- MEM-X Sonor/Graphify/Obsidian;
- Phase 16 target performance/browser measurements;
- Phase 17 real scenarios;
- Phase 19 Windows install/update/reinstall/startup proof.


---

## 2026-09-21 — target-PC evidence collection support

Merged PR #121 / commit `67d6501bd9f61fe1f5819f7541ce5ab3101d26a8`.

When the real ASTRA Windows PC is available, begin non-destructive evidence collection with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\collect-target-pc-evidence.ps1
```

Optional:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\collect-target-pc-evidence.ps1 -IncludePerformance
powershell -ExecutionPolicy Bypass -File .\scripts\windows\collect-target-pc-evidence.ps1 -IncludeChatPreflight -Provider auto
```

A green collector result is not the final release verdict. Continue the documented real approval/STOP, MEM-X, browser/Humanoid and approved external-action validation.


---

## 2026-09-21 — Phase 20 evidence pipeline checkpoint

Current repository checkpoint after PR #126:

`b687fd0588e96f7fa3e0a60d6e45811797be4fff`

New merged tooling:

- PR #123 — conservative Phase 20 core report generator;
- PR #124 — private HIGH-quality Humanoid/browser performance capture;
- PR #125 — safe manual gate recorder;
- PR #126 — final-report context recorder.

Target-PC execution order:

1. `npm run release:repo-gate`;
2. `powershell -ExecutionPolicy Bypass -File .\scripts\windows\collect-target-pc-evidence.ps1 -IncludePerformance -IncludeChatPreflight -Provider auto`;
3. open `/lab/humanoid`, set QUALITY HIGH and capture the required browser scenarios with PERF CAPTURE;
4. perform each real manual/physical gate and record only evidence-backed PASS/FAIL using `npm run release:record-gate`;
5. record CONNECTED / REQUIRES USER LOGIN / NOT IMPLEMENTED context with `npm run release:record-context`;
6. generate `npm run release:core-report`;
7. treat `BLOCKED` as actionable truth, not as an error to bypass.

Still not proven by repository CI:

- real Automation Level-2/3 approvals and STOP;
- real Sonor / Graphify / Obsidian;
- actual target browser/Humanoid measurements;
- approved full-system external actions;
- emergency STOP against a real cancellable task;
- Windows install/update/reinstall/startup proof.

Codex continuation note:

`docs/CODEX_CONTINUATION_NOTE_2026-09-21.md`

When target-PC access is unavailable, Codex may improve only repository work that is independently useful and supported by tests/review. It must not convert missing local evidence into PASS/READY.


---

## 2026-09-21 — Phase 20 evidence validation hardening merged

PR #129 merged successfully.

Current repository checkpoint:

`e86fe028f0fa1f0d9f78c5ef5c426cd34ec1f50b`

Repository-side release evidence validation now fails closed for:

- null/empty/partial runtime performance evidence;
- missing required status endpoint samples;
- invalid runtime completion timestamp;
- partial Phase 17 preflight scenarios instead of completed A–D;
- directory evidence inputs;
- `.astra/` symlink evidence that resolves outside the real private root.

CI for the final #129 head passed build, all 246 unit/integration tests, typecheck, lint, dependency audit and PR diff-check.

Do not reimplement this hardening unless a new concrete defect is demonstrated.

Remaining work is still real target-runtime evidence:

- Automation Level-2/3 approval + STOP;
- Sonor / Graphify / Obsidian MEM-X;
- target runtime/browser/Humanoid performance;
- full-system approved actions + emergency STOP;
- Windows install/update/reinstall/startup;
- final Phase 20 report from real private evidence.

Continue from:

`docs/CODEX_CONTINUATION_NOTE_2026-09-21.md`

---

## 2026-09-21 — repository-side work exhausted through PR #145

Latest implementation checkpoint before this documentation handoff:

`03073fe8a95b7064b059aadcd4b9ff933c8c73e8`

New merged hardening:

- PR #142 — running-build attestation embedded in the ASTRA production bundle and exposed through `/api/agent`;
- PR #143 — target-PC evidence persists verified runtime identity; Phase 20 rejects stale/dirty runtime identity, duplicate checks and any recorded non-PASS check;
- PR #144 — target-PC, runtime-performance and Phase 17 preflight capture verify the same clean runtime build at start and completion;
- PR #145 — Humanoid/browser HIGH capture verifies the runtime before and after sampling; the server rejects runtime/checkout mismatch; the release bundle rejects stale or unverified browser captures.

CI for PRs #142–#145 passed production build, unit/integration tests, typecheck, lint, dependency audit and PR diff checks.

Repository audit conclusion:

**No additional concrete independently implementable release-evidence defect is known at this checkpoint.**

Do not manufacture speculative hardening merely to avoid real validation. The remaining work requires the target environment or user/external interaction:

1. Phase 14 — real Automation Level-2/3 approval + STOP proof.
2. MEM-X — inspect/preserve/audit the existing Sonor, verify its real API, Graphify + Obsidian provenance, degradation and cancellation.
3. Phase 16 — run runtime measurements and six HIGH Humanoid/browser captures on the real target browser; fix/re-measure only if real evidence identifies a bottleneck.
4. Phase 17 — execute A–D on the target runtime, approved real actions where configured, failure variants, and Scenario E emergency STOP.
5. Phase 19 — real install/startup/update/reinstall, loopback, Ollama/model, Codex, Automation, private runtime and bounded health verification.
6. Phase 20 — record only evidence-backed manual gates/context and run `release:core-report`; keep `BLOCKED` until every required gate is real.
7. Only after Phase 20 is stable, continue Phase 21–30.

Recommended target-PC start:

```powershell
git switch main
git pull --ff-only
npm run release:repo-gate
powershell -ExecutionPolicy Bypass -File .\scripts\windows\collect-target-pc-evidence.ps1 -IncludePerformance -IncludeChatPreflight -Provider auto
```

Then follow `docs/BROWSER_PERFORMANCE_EVIDENCE.md`, `docs/AUTOMATION_VALIDATION.md`, `docs/SONOR_CODEX_MISSION.md`, `docs/FULL_SYSTEM_VALIDATION.md`, `docs/MANUAL_RELEASE_EVIDENCE.md`, and `docs/CORE_RELEASE_REPORT.md`.

Truth boundary: repository CI is not target-PC proof. Do not mark READY, Sonor connected, physical STOP PASS, Windows release PASS, or browser performance PASS without the corresponding real private evidence.


---

## 2026-09-21 — final repository audit complete through PR #150

The earlier PR #145 saturation checkpoint was intentionally re-audited from the repository foundations before target-PC handoff. Four additional concrete defects were found and fixed:

- PR #147 / `5338f3f184ab84102f635dfb89255e090b43dba9` — browser release scenario runtime commits are independently bound to current clean HEAD;
- PR #148 / `95b2d6e8d82dae4da85650609650e72a5a14c8ef` — remote optional-cloud traffic carrying an API key must use HTTPS and URLs cannot embed credentials;
- PR #149 / `542e5f7494c23b525eccf38a503adf330b7a7cfc` — GitHub push verifies the exact `github.com` host rather than a substring;
- PR #150 / `32f3f8f340a6bfc4004c5b4eeedd116682dae854` — STOP/timeout now terminates the full owned subprocess tree, including Windows descendants.

All four PRs passed ASTRA CI before merge.

Detailed audit:

`docs/FINAL_REPOSITORY_AUDIT_2026-09-21.md`

Repository-side conclusion after PR #150:

**No additional concrete independently implementable defect was identified in the audited release/security scope.**

Remaining work is genuinely target-PC/local/external:

1. Phase 14 real Automation Level-2/3 approvals + STOP;
2. MEM-X real Sonor/Graphify/Obsidian;
3. Phase 16 real runtime/browser/Humanoid HIGH evidence;
4. Phase 17 real scenarios A–E + failure variants + emergency STOP;
5. Phase 19 real Windows install/startup/update/reinstall;
6. Phase 20 final evidence-backed report;
7. Phase 21–30 only after Phase 20 is stable.

First target-PC sequence:

```powershell
git switch main
git pull --ff-only
npm run release:repo-gate
powershell -ExecutionPolicy Bypass -File .\scripts\windows\collect-target-pc-evidence.ps1 -IncludePerformance -IncludeChatPreflight -Provider auto
```

GitHub governance note: branch `main` was unprotected and no repository ruleset existed at audit time. Recommended manual administrator action is to require PR + ASTRA CI and block force-push/deletion. This is not a substitute for target-PC evidence and cannot be configured with the available connector.


---

## 2026-09-21 — NVIDIA NIM / Nemotron Ultra provider merged

PR #152 merged as:

`c151d9d044829e14f66be84a70d56aaf163ea09c`

ASTRA now has an optional explicit NVIDIA provider using:

`nvidia/nemotron-3-ultra-550b-a55b`

Security/privacy defaults:

- `ASTRA_NVIDIA_ENABLED=false`;
- `ASTRA_NVIDIA_AUTO_FALLBACK=false`;
- `ASTRA_NVIDIA_INCLUDE_MEMORY=false`;
- `NVIDIA_API_KEY` belongs only in target-PC `.env.local`;
- hosted endpoint must be exactly `https://integrate.api.nvidia.com/v1`;
- NVIDIA is reasoning/chat only and cannot execute side effects.

Repository CI passed build, tests, typecheck, lint, dependency audit and diff-check.

Real NVIDIA hosted availability is still a target-PC configuration gate. Do not claim NVIDIA READY until the user has added a valid API key locally and ASTRA runtime status verifies the exact configured model.

See:

`docs/NVIDIA_NIM.md`

## 2026-09-22 — NVIDIA JARVIS mesh handoff

PR #154 is merged at `ce5a5623867f443ffc931c6b4687b19e38412882` with green CI.

Do not collapse NVIDIA back to a single-model provider. Preserve:
- Chief / Deep / Fast / Vision deterministic routing;
- actual active-model telemetry;
- no side-effect execution through NVIDIA;
- memory and AUTO cloud fallback opt-in defaults;
- exact NVIDIA hosted endpoint validation;
- fail-closed mesh health;
- current no-fake-vision boundary.

Real API validation is target-PC work because the user's key belongs only in `.env.local`.

Continue the existing target-PC Phase 14 / MEM-X / 16 / 17 / 19 / 20 gate order; this model mesh does not waive any release gate.

## 2026-09-22 — NVIDIA MAX framework handoff

The owner approved a single final NVIDIA architecture and asked that future sessions continue it rather than produce new recommendation lists.

Canonical architecture/implementation plan:

`docs/NVIDIA_MAX_INTEGRATION.md`

Repository foundation branch:

`feature/nvidia-max-framework`

Foundation contents:
- `lib/nvidia/catalog.ts` — 10-subsystem integration registry mapped to ASTRA phases and exit gates;
- `lib/nvidia/skill-hub.ts` — curated official NVIDIA core skill manifest plus bounded recommendation router;
- `tests/nvidia-max-framework.test.ts` — registry/authority/router invariants;
- `package.json` lint includes `lib/nvidia`;
- roadmap/tracker/recovery/Codex mission updated.

Safety decisions:
- Skill Hub is advisory/discovery only, not an executor;
- max recommended subset defaults to 3;
- hundreds of skills are discoverable/on-demand, not eagerly placed in context;
- NVIDIA cannot bypass ASTRA Tool Runtime/approval;
- Sonor remains canonical memory;
- NeMo Guardrails remains defense in depth, not execution authority;
- Vision cannot claim perception without real pixels;
- Voice cannot claim local/private audio unless that is actually true.

After NVA-0 merges, continue **NVA-1 Skill Hub discovery/install-state** as the next independent repository task.

When target-PC access exists, core release gates Phase 14/MEM-X/16/17/19/20 still take precedence.

## 2026-09-22 — NVIDIA NVA-1 Skill Hub state/cache handoff

Baseline NVIDIA framework is on main via PR #159 / merge `e155c75f98da4e07ca3c07b7f15d46ceb655f417`.

Current branch `feature/nvidia-skill-hub-state` implements the repository-side NVA-1 contract:
- `lib/nvidia/skill-catalog-cache.ts`;
- `lib/nvidia/skill-state.ts`;
- `tests/nvidia-skill-state.test.ts`;
- private paths documented in `.env.example`.

The catalog provider is injected/provider-neutral on purpose. Do not add brittle request-time scraping of build.nvidia.com.

Target-PC completion still needs the actual supported NVIDIA/Codex skill mechanism. Record installed state only after real verification.

After this branch merges, next independent repo task is **NVA-2 AI-Q adapter contract** from `docs/NVIDIA_MAX_INTEGRATION.md`.

## 2026-09-22 — NVIDIA MAX subsystem contract handoff

NVA-0 is on main through PR #159 (`e155c75f98da4e07ca3c07b7f15d46ceb655f417`).
NVA-1 is on main through PR #160 (`af7e05e1252b1b80e94b32cfbfedff6f2c7e006b`).

Current branch `feature/nvidia-max-subsystem-contracts` adds safe contracts for NVA-2 through NVA-9:
AI-Q, Retriever, Document Intelligence, Voice, Vision, NemoClaw/Hermes governance, Guardrails, and Evaluation.

After this branch merges:
- do not create more speculative NVIDIA architecture;
- do not guess service endpoint schemas;
- inspect the actual supported NVIDIA tooling/runtime when target access exists;
- wire each existing contract to the real backend;
- keep fallback/degradation truthful;
- collect exact target-PC evidence before marking a subsystem READY.

Codex still owns zero-touch delivery. The owner should not receive setup commands.

## 2026-09-22 — NVIDIA MAX repository work complete through PR #161

Merged/CI-verified NVIDIA MAX repository checkpoints:
- PR #159 / `e155c75f98da4e07ca3c07b7f15d46ceb655f417`;
- PR #160 / `af7e05e1252b1b80e94b32cfbfedff6f2c7e006b`;
- PR #161 / `84e5eb6aeb20dbdb737dc6d9ace149adfac73dbb`.

Codex should treat the provider-neutral NVIDIA repository architecture as complete until real integration exposes a missing contract.

Next work is execution, not redesign:
- core target-PC release validation;
- actual Skill Hub mechanism;
- actual AI-Q transport;
- real Sonor before Retriever;
- real OCR/voice/vision/Hermes/Guardrails/evaluation services;
- defect repair and evidence collection.

Owner interaction remains zero-touch except unavoidable external authorization/physical boundaries.

## 2026-09-22 — JARVIS foundations handoff through Phase 28

While target-PC/Codex execution was unavailable, repository-only JARVIS foundations continued under the owner's explicit authorization.

Merged:
- Phase 24 Event Engine — PR #164;
- Phase 25 Durable Background Task Manager — PR #165.

Active:
- Phase 28 Diagnostics / Audit / Offline on `feature/phase28-diagnostics-audit-offline`.

Read `docs/JARVIS_PROGRESS_TRACKER.md` and `docs/CURRENT_EXECUTION_POINTER.md` before touching these phases.

Do not duplicate merged foundations. Real provider/Windows/backend adapters should plug into the existing contracts and must preserve truthful health, permission boundaries, STOP/cancellation, and private evidence rules.

After Phase 28 green merge, next independent repository slice is Phase 22 Identity / Trust / Secret boundary.

## 2026-09-22 — Phase 22 Identity / Trust / Secret foundation

Phase 28 is merged and CI-verified. Phase 22 repository foundation is active on `feature/phase22-identity-trust-secrets`.

Do not wire speaker/face recognition as authorization. They may become convenience signals only.

When target-PC integration begins:
- use a real trusted OS/session identity mechanism;
- preserve existing approval gates;
- prefer local OS credential storage for secrets where appropriate;
- never copy secret values into Memory/Sonor/Graphify/Obsidian/logs;
- never expose secret values in status APIs;
- revoked device identities require fresh pairing.

After Phase 22 merges, continue the independent repository sequence with Phase 27 Multi-device.

## 2026-09-22 — Phase 27 Multi-device foundation

Phase 22 is merged and CI-verified. Phase 27 repository foundation is active on `feature/phase27-multi-device-foundation`.

When real transport integration begins:
- do not publish the existing loopback API directly to LAN/internet;
- bind real routing to a mutually authenticated/encrypted channel;
- use Phase-22 trust identity as the prerequisite for pairing;
- store transport credentials through Secret Broker, not device metadata;
- preserve per-device permission ceilings and existing Level-2/3 approval;
- revoke must block new routing immediately;
- treat remote capability/result payloads as untrusted input/evidence.

After Phase 27 merges, the next independent repo-only slice is Phase 29 Generic Skill / Environment Device Registry.


## 2026-09-22 — Phase 29 Generic Skill + Environment foundation

Branch: `feature/phase29-skill-environment-registry`
PR: #169

Implemented:
- generic skill contracts/state in `lib/skills/`;
- untrusted-by-default registration;
- explicit review before install;
- install remains disabled until explicit enable;
- tool/provider/permission/network/secret-name/verification metadata;
- health truth against the existing Tool Registry;
- verified install/update/rollback/remove state transitions;
- rollback version/checksum metadata;
- provider-neutral explicit environment registry in `lib/environment/`;
- devices disabled by default;
- read/write capabilities map only to registered Tool Registry ids;
- environment writes require Permission Level 3+;
- writes preserve scoped approval;
- camera/sensor devices require sensitive privacy class and per-operation consent;
- private bounded symlink-safe stores;
- dedicated `.astra/generic-skills.json` path to avoid collision with legacy `.astra/skills.json`;
- regression coverage in `tests/skill-environment-foundation.test.ts`;
- design contract in `docs/SKILL_ENVIRONMENT_BRIDGE.md`.

Validation:
- initial CI #452: 374/375 tests passed; one test used the pre-rename env var;
- fixed test env var;
- CI #453: build/tests/typecheck/lint/audit/diff-check all SUCCESS.

Important next-session rule:
If PR #169 remains open, inspect/fix its newest head rather than recreating Phase 29. After merge, repository-only Phase 21–30 foundation work is saturated; real target-PC/provider evidence is next.


## 2026-09-22 — Phase 29 merged checkpoint

PR #169 merged to `main` at `390a5c35e50a5020ccf34f317edcc25f4837dcb1`.
Final PR CI #457: SUCCESS.
Main push CI #458: SUCCESS.

Repository-only JARVIS foundation work authorized in the Phase 24/25/28/22/27/29 sequence is complete.

Codex must not rebuild these abstractions. The next useful work requires real target-PC/provider/device evidence or a concrete defect. Read `docs/CURRENT_EXECUTION_POINTER.md` before acting.


## 2026-09-22 — Cross-session reconciliation complete

Repository continuity has been reconciled across all 206 branches.

Merged recovery:
- PR #171;
- merge commit `cc8432edcf9e854bba9d0d78c14c7731fd279dbd`;
- CI #466 SUCCESS;
- post-merge main CI #467 SUCCESS.

Recovered capability:
- Phase 16 main-UI performance evidence for Command Center active and Automation panel open;
- opt-in only with `?perf=1`;
- evidence remains `NOT_EVALUATED` until real target-browser review;
- no prompt/response/mic transcript/console message content is persisted.

Do not revive old Phase 28/29, Windows private-evidence, V15 telemetry, Phase 14/18 prototype, early Humanoid, or stale handoff branches merely because they have unique commits. Their status is documented in `docs/CROSS_SESSION_RECONCILIATION_2026-09-22.md`.

Next actual work remains:
`Phase 14 → MEM-X → Phase 16 real evidence → Phase 17 → Phase 19 → Phase 20`.


## 2026-09-22 — Codex refinement responsibility

Canonical contract:

`docs/CODEX_REFINEMENT_CONTRACT.md`

The owner explicitly wants ChatGPT to consume as much repository-side implementation work as possible so Codex tokens are reserved for the work that requires the real PC/runtime/provider.

Codex responsibility is therefore:

- do not redo merged ChatGPT foundations;
- inspect and improve them;
- connect real providers/devices/runtime;
- fix actual incompatibilities found in execution;
- finish missing integration/UI/operational pieces;
- run happy-path + failure + cancellation + STOP + permission/privacy validation;
- gather exact-build evidence;
- package/polish until ready-to-use;
- keep handoff/tracker/worklog current.

For NVIDIA, Phase 24/25/28/22/27/29, and other already-merged foundations, Codex is explicitly the **refinement/completion owner**, not the architecture restart owner.


## 2026-09-22 — PR #174 operations UI refinement

ChatGPT is consuming another concrete repo-side slice to conserve Codex tokens:

- Phase 25 task UI/runtime presence;
- Phase 28 diagnostics/action-history UI.

PR #174 reuses existing canonical APIs and does not take over Codex's real-execution work.

Codex must still refine/complete later:
- production task executors;
- restart evidence on the real target PC;
- Level-2/3 real task-resume flow;
- real connectivity probe;
- real Ollama/Codex/Sonor/NVIDIA health adapters;
- Tool Runtime recovery execution;
- offline scenario evidence.

PR #174 is merged at `293216e9f94868d00b2636b125922ff09ec593db` with PR CI #483 green. Do not rebuild this UI. Use it as the operations surface while connecting the real integrations.


## 2026-09-22 — Event Inbox refinement

ChatGPT is consuming the remaining safe Event Engine UI slice on `feature/event-inbox-ui`.

The UI must:
- show only stored/evaluated Event Engine records;
- preserve source/topic/subscription/disposition truth;
- allow ACK and subscription enable/disable through the existing guarded API;
- never offer manual event publishing as if it were a real source.

Codex/refinement later connects real GitHub/calendar/email/service sources and target-runtime proactive notification delivery.


## 2026-09-22 — GitHub Actions Event Engine adapter

PR #175/Event Inbox is merged at `56059728be8ef60b1badb58a8ef13bade2ba569b` after green CI #486.

ChatGPT is now implementing the first real Phase-24 event-source adapter in PR #176 on `feature/github-actions-event-adapter`.

Contract:
- GitHub access is read-only;
- exact official Actions workflow-runs endpoint only;
- no token needed for public repositories;
- private token stays local and is never surfaced;
- ASTRA maps real workflow state into Event Engine records;
- no GitHub workflow mutation capability is introduced;
- repeated polling must not destroy existing acknowledgement state.

Codex later owns real background polling cadence, target-runtime proactive notification UX/evidence, and private-repo credential validation where required.

## 2026-09-22 — Phase 24 three-source repository checkpoint

- PR #178 provider-health diagnostics merged; main CI #501 SUCCESS.
- PR #180 local service-health Event Engine source merged; main CI #507 SUCCESS.
- PR #182 Automation lifecycle Event Engine bridge merged at `d04876391483500dda4f0755c4f1c120a25eae07`.
- PR #182 CI #512 passed; post-merge main CI #513 exposed one nondeterministic integration-test wait, not a runtime defect.
- PR #183 changed only that test to await canonical async Event Store publication; PR CI #516 SUCCESS.
- PR #183 merged at `0f1cff3723aeb30a56270b86d5b8dcfef713ca2a`; main CI #517 SUCCESS.
- Phase 24 now has three real repository-side source integrations: GitHub Actions, local service-health, and Automation lifecycle.
- Target-PC polling/proactive notification/failure/STOP/restart evidence is still required; repository CI is not production readiness.
- Phase 28 recovery execution remains intentionally pending because no recovery-specific Tool Runtime primitive currently exists. Do not substitute unrelated generic tools.

Codex continuation:
- use the merged source adapters rather than rebuilding them;
- subscribe/configure them only through existing guarded policy;
- collect real target-runtime evidence;
- keep Automation approval/STOP authoritative;
- do not implement recovery execution until a real recovery-specific Tool Runtime primitive is available.
