# ASTRA AI Agent

ASTRA is a personal multi-agent AI project built on top of the open-source **APEX-UI** visual foundation. The repository keeps the orb, particle core, shader background, and reasoning graph while adding an agent runtime, command console, API route, routing layer, security defaults, and a path toward real tools and memory.

## Current status

**V1 foundation is in progress.** The UI accepts a command, sends it to `/api/agent`, routes it to a specialist, and drives the request lifecycle (`idle → thinking → speaking`). No cloud AI secret is embedded in the repository. The current orchestrator intentionally stops at the provider boundary until a model/tool provider is configured.

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

Open `http://localhost:3000`.

For production validation:

```bash
npm run build
npm start
```

## Configuration

Copy `.env.example` to `.env.local` and fill only the provider/integrations you choose.

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
