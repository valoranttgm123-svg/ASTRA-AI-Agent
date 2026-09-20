# Security Policy

ASTRA is designed so source code and public project documentation can live in GitHub while credentials and private runtime data stay outside the repository.

## Never commit

- API keys or access tokens
- passwords
- OAuth client secrets
- SSH private keys
- `.env` or `.env.local`
- browser/session cookies
- private memory databases
- private custom skill data
- broker credentials
- Codex authentication/session files

Use `.env.example` only as a template.

## Local private data

ASTRA uses the gitignored `.astra/` directory for optional private runtime context:

```text
.astra/memory.json
.astra/skills.json
```

Do not move private memory into committed documentation.

Private memory is not sent to Codex or optional cloud by default. Those paths require explicit configuration flags.

## Tool permissions

ASTRA uses least privilege.

Default policy:
- approval required;
- shell side effects disabled;
- file writes disabled;
- external actions disabled;
- paid cloud disabled.

Read-only reasoning and inspection are the safe default.

## Local API boundary

ASTRA binds its supported production launcher to `127.0.0.1`. The agent routes
reject non-loopback hosts, cross-origin requests, unsupported content types, and
oversized bodies. The browser sends a dedicated ASTRA client header for POST
requests. Request cancellation is forwarded to Ollama, Hermes, cloud fetches,
and the owned Codex CLI child process.

Do not place ASTRA behind a public reverse proxy or disable these guards.

### Codex

Codex uses a read-only sandbox unless file-write permission is explicitly enabled. ASTRA does not store the user's Codex auth in the repository. Selecting `CHATGPT / CODEX` explicitly never causes a silent fallback to another provider.

Managed Codex installations may reject `workspace-write` and permit only
`read-only` or `danger-full-access`. Danger mode is never automatic: it requires
`ASTRA_CODEX_SANDBOX=danger-full-access`,
`ASTRA_CODEX_ALLOW_DANGER_FULL_ACCESS=true`, file-write permission, shell
permission, and a per-request `EXECUTE TASK` approval. In that mode the OS no
longer enforces the workspace boundary, so prompts are not a substitute for
reviewing high-impact actions. External actions and paid cloud remain separate
policy gates.

### Hermes / MCP

Hermes can run its own MCP/tool loop. ASTRA sends the permission policy in the Brain prompt, but Hermes/MCP must also be configured with matching least-privilege permissions because ASTRA cannot safely claim to intercept tool calls that the gateway does not expose.

### Cloud

Optional cloud execution requires two explicit gates:

```env
ASTRA_CLOUD_ENABLED=true
ASTRA_ALLOW_PAID_CLOUD=true
```

No silent paid fallback.

## High-impact side effects

Examples that require an explicit permitted execution path:
- sending email/messages;
- deleting or overwriting files;
- write-capable shell/PowerShell commands;
- Git push/merge;
- database writes;
- placing/modifying/closing trades;
- shutting down or controlling a computer;
- remote system changes.

## Reporting

If a secret is accidentally committed, rotate/revoke it first. Removing a file from the latest commit is not enough because Git history may still contain the value.
