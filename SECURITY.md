# Security Policy

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
