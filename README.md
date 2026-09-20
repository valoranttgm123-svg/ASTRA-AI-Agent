# ASTRA AI Agent

ASTRA is a personal multi-agent AI project built on top of the open-source **APEX-UI** visual foundation. The repository keeps the orb, particle core, shader background, and reasoning graph while adding a real runtime, GPU Humanoid, local-first Brain Adapter, Memory/Skills, provider routing, Codex engineering specialization, permission controls, and Command Center telemetry.

## Current status

**Brain V1 architecture is implemented.** The UI accepts text/mic/gesture input, drives the real interaction lifecycle, routes requests through the ASTRA Brain Adapter, loads local Memory/Skills, chooses a permitted provider, and streams real Brain lifecycle events into the Command Center. Hermes and Ollama are local-first paths; Codex is the engineering specialist; optional paid cloud is disabled by default.

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

The command console has three explicit provider modes:

- `AUTO` uses ASTRA routing (Codex first for engineering, otherwise local paths);
- `OLLAMA` forces the configured local model and never silently changes models;
- `CHATGPT / CODEX` forces the authenticated local Codex CLI.

`SEND` is chat/read-only reasoning. `EXECUTE TASK` is a per-request approval and
still cannot exceed the server-side permission policy.

## Configuration

Copy `.env.example` to `.env.local` and fill only the provider/integrations you choose.

For full web search, point `ASTRA_SEARXNG_URL` at a loopback SearXNG JSON `/search` endpoint. ASTRA health-checks it before marking Researcher READY. Without SearXNG, `browser.fetch` can still read one explicit public URL, but ASTRA does not pretend general web search is configured.

```bash
cp .env.example .env.local
```

Do **not** commit `.env.local`, tokens, passwords, SSH keys, broker credentials, OAuth secrets, or private memory databases.

## Codex project context

This repository stores the ASTRA project handoff/context so future Codex sessions can continue without rebuilding history from scratch.

Start here:
- `AGENTS.md`
- `docs/CODEX_HANDOFF.md`
- `docs/ASTRA_CONVERSATION_HISTORY.md`
- `docs/HUMANOID_BUILD_LOG.md`
- `docs/ASTRA_BRAIN_V1.md`

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
   └─ optional cloud (explicit opt-in only)
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
