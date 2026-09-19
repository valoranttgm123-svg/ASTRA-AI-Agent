# ASTRA AI Agent

ASTRA is a personal multi-agent AI project built on top of the open-source **APEX-UI** visual foundation. The repository keeps the orb, particle core, shader background, and reasoning graph while adding an agent runtime, command console, API route, routing layer, security defaults, and a path toward real tools and memory.

## Current status

**Brain V1 B1–B8 is implemented.** ASTRA supports local Ollama, a reviewed Hermes gateway, an existing-login Codex engineering adapter, bounded project memory, allowlisted MCP tools, single-use approvals, real task events, cancellation, a live Command Center timeline, voice input/output, gestures, and the approved GPU Humanoid. Missing providers are shown as unavailable; no cloud AI secret or paid fallback is embedded.

Sonor Workflow memory is the next integration stage and is not silently coupled to this release.

## Included agents

- Chief — orchestration and approvals
- Memory — durable context
- Research — public research
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

Open `http://127.0.0.1:3000`. The Brain API intentionally rejects non-loopback hosts.

### Windows local installation

After setting `.env.local`, install the production build, hidden logon tasks, and the `ASTRA` desktop shortcut with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\install-local.ps1
```

The installer keeps both HTTP services on loopback: ASTRA at `http://127.0.0.1:3017` and Ollama at `http://127.0.0.1:11434`. It does not expose either service to the LAN or internet. To remove only the autostart tasks and shortcut without deleting project data or models, run `scripts\windows\uninstall-local.ps1`.

For full validation:

```bash
npm run build
npm test
npm run typecheck
npm run lint
npm audit --audit-level=high
npm start
```

## Configuration

Copy `.env.example` to `.env.local` and fill only the provider/integrations you choose.

```bash
cp .env.example .env.local
```

Do **not** commit `.env.local`, tokens, passwords, SSH keys, broker credentials, OAuth secrets, or private memory databases.

Provider rules:
- Ollama is local-first; choose only a model shown as installed.
- Ollama extended thinking is off by default for responsive voice/chat; it can be enabled explicitly for harder tasks.
- Hermes agent execution requires server opt-in and per-task approval.
- Codex uses an existing ChatGPT CLI login, is read-only by default, and always asks before sending a task.
- MCP tools must be explicitly allowlisted. Non-read-only tools also require server opt-in and a single-use approval.
- paid provider fallback is not implemented.

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
ASTRA UI
   ↓
Command Console
   ↓
/api/agent
   ↓
Orchestrator
   ↓
Specialist Agent
   ↓
Provider / Tool Adapter
```

## Repository safety

Important source code, configuration templates, architecture docs, CI, and non-secret configuration belong in GitHub. Credentials and private runtime data do not.

See [`SECURITY.md`](SECURITY.md).

## Original APEX-UI foundation

This project began from [RubenM1990/APEX-UI](https://github.com/RubenM1990/APEX-UI), released under the MIT License. The original `LICENSE` and `CREDITS.md` are retained in this repository. APEX branding is not claimed as part of ASTRA.

## License

The inherited code is distributed under the MIT License included in [`LICENSE`](LICENSE). See [`CREDITS.md`](CREDITS.md) for upstream component attribution.
