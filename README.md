# ASTRA AI Agent

ASTRA is a personal multi-agent AI project built on top of the open-source **APEX-UI** visual foundation. The repository keeps the orb, particle core, shader background, and reasoning graph while adding a real runtime, GPU Humanoid, local-first Brain Adapter, Memory/Skills, provider routing, Codex engineering specialization, permission controls, and Command Center telemetry.

## Current status

ASTRA MAX repository work is CI-verified through:

- Phase 15 security/failure hardening;
- Phase 16A runtime performance instrumentation;
- Phase 16 private browser/Humanoid HIGH evidence capture tooling;
- Phase 17A safe full-system preflight instrumentation;
- pre-RC repository cleanup;
- Phase 19A read-only readiness self-check;
- Phase 19B safe update/reinstall tooling;
- Phase 19C read-only Windows install preflight;
- Phase 19D read-only release validator;
- Phase 19E Ollama loopback hardening;
- Phase 19F ASTRA loopback runtime hardening;
- Phase 19G bounded startup health gate.

Phase 18A repository RC gate automation is merged as PR #119. Phase 20 also has conservative evidence/report tooling, private browser/Humanoid capture, runtime provenance hardening, and the final repository security/release audit through PR #150. See `docs/FINAL_REPOSITORY_AUDIT_2026-09-21.md`. These repository results are necessary but not sufficient for release; real target-runtime gates remain.

Current truthful release state:

`CORE IMPLEMENTATION ADVANCED / REPOSITORY CI VERIFIED / TARGET-PC RELEASE GATES REMAIN`

Still requiring real target-runtime evidence:

- Phase 14 Automation target-PC approval/STOP validation;
- MEM-X real Sonor/Graphify/Obsidian validation;
- Phase 16 target hardware/browser measurements;
- Phase 17 real scenario execution;
- Phase 19 target Windows install/update/reinstall/startup verification.

Hermes/Ollama/Codex/integrations are reported from real configuration/runtime state. Optional paid cloud remains disabled by default; unavailable integrations must remain `NOT_CONFIGURED` / unavailable rather than being presented as working.

## Included agents

- Chief — orchestration and approvals
- Memory — durable context
- Research — public-source research with provenance; explicit public-URL reading is built in, while search requires a configured local SearXNG transport
- Developer — coding/debugging
- Computer — approved desktop automation
- Files — file/document work
- GitHub — repository workflows
- Communication — email/calendar workflows
- Business — business/POS support
- Trading — market/trading tooling

## Business specialists

ASTRA includes implemented local business reasoning roles for Finance, Sales, Marketing, Ops, Editor and Analytics. Finance and Analytics also use deterministic native Level-1 tools for calculations/statistics. These roles analyze and draft; they do not imply CRM updates, messages sent, campaigns published, supplier actions, or database writes.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

For production validation:

```bash
npm run build
npm start
```

On Windows, the production installer builds ASTRA, installs hidden user-logon
tasks for ASTRA and Ollama, creates an `ASTRA.url` desktop shortcut, and verifies
both loopback services:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-local.ps1
```

Windows operations:

```powershell
# Read-only runtime readiness evidence
powershell -ExecutionPolicy Bypass -File .\scripts\windows\self-check.ps1

# Fast-forward-only update + rebuild + restart + self-check
powershell -ExecutionPolicy Bypass -File .\scripts\windows\update-local.ps1

# Non-destructive reinstall/repair of startup integration
powershell -ExecutionPolicy Bypass -File .\scripts\windows\reinstall-local.ps1

# Read-only target-PC evidence bundle (never selects READY)
powershell -ExecutionPolicy Bypass -File .\scripts\windows\collect-target-pc-evidence.ps1

# Repository release gate + private Phase 20 report
npm run release:repo-gate
npm run release:core-report
```

See `docs/WINDOWS_RELEASE.md` for the safety model and target-PC verification boundary.

The command console has four explicit provider modes:

- `AUTO` remains local-first (Codex first for engineering, otherwise local paths; NVIDIA is used only when its explicit AUTO fallback flag is enabled);
- `OLLAMA` forces the configured local model and never silently changes models;
- `CHATGPT / CODEX` forces the authenticated local Codex CLI;
- `NVIDIA · JARVIS MESH` enables ASTRA's adaptive NVIDIA model router (Chief / Deep / Fast / Vision) and never becomes an execution bypass.

`SEND` is chat/read-only reasoning. `EXECUTE TASK` is a per-request approval and
still cannot exceed the server-side permission policy.

## Configuration

Copy `.env.example` to `.env.local` and fill only the provider/integrations you choose.

For full web search, point `ASTRA_SEARXNG_URL` at a loopback SearXNG JSON `/search` endpoint. ASTRA health-checks it before marking Researcher READY. Without SearXNG, `browser.fetch` can still read one explicit public URL, but ASTRA does not pretend general web search is configured.

For NVIDIA Build/NIM, ASTRA uses an adaptive model mesh: Nemotron Ultra (Chief), GLM-5.3 (Deep), Nemotron 3.5 Lightning (Fast), and GLM-5.3 Flash (Vision). It is disabled by default, keeps private memory out by default, and AUTO remains local-first unless `ASTRA_NVIDIA_AUTO_FALLBACK=true`. See `docs/NVIDIA_NIM.md`. The approved full NVIDIA expansion (Skill Hub, AI-Q, Retriever/RAG, Document Intelligence, Voice, DeepStream/VSS, NemoClaw, Guardrails, and Evaluation) is tracked in `docs/NVIDIA_MAX_INTEGRATION.md`.

```bash
cp .env.example .env.local
```

Do **not** commit `.env.local`, tokens, passwords, SSH keys, broker credentials, OAuth secrets, or private memory databases.

## Codex project context

This repository stores the ASTRA project handoff/context so future Codex sessions can continue without rebuilding history from scratch.

Start here:
- `AGENTS.md` — automatic Codex repository instructions
- `docs/CODEX_NEXT_MISSION.md` — current task order and exit gates
- `docs/CODEX_HANDOFF.md` — verified implementation state
- `docs/SECURITY_VALIDATION.md` — Phase 15 hardening matrix
- `docs/ASTRA_MAX.md` — full Phase 0–30 roadmap / Definition of Done

The stored history contains project decisions and implementation context, not credentials, hidden reasoning, or private system prompts.

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the runtime design and approval model.

High-level flow:

```text
Humanoid / Chat / Mic / Gesture
   ↓
ASTRA Runtime / Event Bus
   ↓
/api/agent
   ↓
ASTRA Brain Adapter
   ├─ Memory / Skills / Permission Policy
   ├─ Hermes
   ├─ Ollama
   ├─ Codex engineering specialist
   ├─ NVIDIA JARVIS Mesh: Ultra / GLM-5.3 / Lightning / GLM-5.3 Flash (explicit opt-in)
   └─ optional generic cloud (explicit opt-in only)
   ↓
real Brain events
   ├─ Humanoid high-level state
   └─ Command Center detailed trace
```

Private local context belongs in `.astra/`, which is gitignored. See `.env.example` and `docs/ASTRA_BRAIN_V1.md` for provider and safety configuration.

The agent API is loopback-only, enforces same-origin requests, caps request
bodies, and propagates browser cancellation to active provider work. This local
security boundary is intentional; do not expose the port publicly.

## Repository safety

Important source code, configuration templates, architecture docs, CI, and non-secret configuration belong in GitHub. Credentials and private runtime data do not.

See [`SECURITY.md`](SECURITY.md).

## Original APEX-UI foundation

This project began from [RubenM1990/APEX-UI](https://github.com/RubenM1990/APEX-UI), released under the MIT License. The original `LICENSE` and `CREDITS.md` are retained in this repository. APEX branding is not claimed as part of ASTRA.

## License

The inherited code is distributed under the MIT License included in [`LICENSE`](LICENSE). See [`CREDITS.md`](CREDITS.md) for upstream component attribution.
