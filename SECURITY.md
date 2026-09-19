# Security Policy

## Brain V1 boundaries

- `/api/agent` is loopback and same-origin only; keep ASTRA behind `127.0.0.1` until an authenticated remote-access design exists.
- Project roots are an explicit server allowlist. Disk roots, path traversal, symlink escapes, NTFS alternate streams, secret-like files, private directories and oversized/binary files are denied.
- Memory saves are explicit, size-limited and rejected when credential patterns are detected. `.astra/` stays ignored by Git.
- Automatic Ollama tools are read-only. MCP tools are allowlisted; side-effect tools require both server opt-in and a single-use task-bound approval.
- Hermes tool execution is disabled until the gateway policy is reviewed, then still requires approval per task.
- Codex runs with ignored project/user configuration, ephemeral sessions, disabled apps/MCP/multi-agent, no workspace network, and read-only sandbox by default. Workspace-write requires server opt-in and per-task approval.
- ASTRA never sends raw reasoning, provider diagnostics, secrets, filesystem roots, or private memory contents to the browser event log.
- Paid provider fallback is absent, not merely hidden.

ASTRA is designed so source code and documentation can live in GitHub while private credentials and local runtime data stay outside the repository.

## Never commit

- API keys or access tokens
- passwords
- OAuth client secrets
- SSH private keys
- `.env` or `.env.local`
- browser/session cookies
- personal databases or private memory stores
- broker credentials

Use `.env.example` only as a template.

## Tool permissions

ASTRA should use least privilege. New integrations should start read-only when possible. Actions with side effects must be gated by user approval unless the user explicitly configures a narrower trusted automation.

High-impact examples include file deletion, external messages, database writes, repository merges, shell commands, remote computer control, and trade execution.

## Reporting

If a secret is accidentally committed, rotate/revoke it first. Removing a file from the latest commit is not enough because Git history may still contain the value.
