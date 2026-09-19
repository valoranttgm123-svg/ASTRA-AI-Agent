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

### Codex

Codex uses a read-only sandbox unless file-write permission is explicitly enabled. ASTRA does not store the user's Codex auth in the repository.

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
