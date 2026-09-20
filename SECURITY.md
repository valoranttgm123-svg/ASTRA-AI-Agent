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


## Public web research boundary

ASTRA's native `browser.fetch` is read-only and accepts only explicit public HTTP/HTTPS URLs.

The browser transport:
- rejects credentials embedded in URLs;
- rejects localhost;
- resolves DNS before connecting and rejects the host if any resolved address is private/reserved;
- pins the request to the validated resolved address while preserving the original TLS server name / Host header;
- revalidates every redirect;
- blocks HTTPS-to-HTTP downgrade redirects;
- blocks loopback, RFC1918/private, link-local, carrier-grade NAT, metadata/link-local, benchmark/documentation ranges, multicast/reserved IPv4, IPv4-mapped private IPv6, unique-local/link-local IPv6, documentation IPv6, Teredo and 6to4;
- accepts bounded textual/JSON/XML content only;
- caps response bytes, extracted text, redirects and execution time;
- treats fetched page text as untrusted evidence, not instructions.

Full search uses `ASTRA_SEARXNG_URL`, which must be a loopback HTTP/HTTPS endpoint. A configured endpoint is not marked READY until a real bounded health search succeeds.

Research output preserves source URLs/source IDs and marks fetched text `untrusted=true`. Model instructions explicitly require treating source text as evidence rather than tool/system instructions.
## Untrusted retrieved-context boundary

Project files, local memory, Sonor, Graphify, Obsidian, public-web text, and prior tool/step outputs are data sources, not authority sources.

ASTRA must:
- preserve provenance for retrieved records;
- serialize retrieved memory/project records as bounded data rather than blending them with trusted policy text;
- explicitly tell model providers that instruction-like text inside retrieved data must not override the user request, ASTRA system rules, project scope, permissions, approvals, privacy settings, or tool authorization;
- treat prior tool/research outputs as untrusted evidence when they are passed into later reasoning;
- keep permission/approval enforcement in server-side Planner/Tool Runtime boundaries rather than relying on prompt-injection detection.

ASTRA does not use destructive regex filtering as the security boundary. A retrieved document may legitimately contain imperative text; the content remains available as evidence while its authority stays zero unless a real ASTRA policy/tool path independently authorizes an action.
## Public error and telemetry redaction

ASTRA treats provider/tool/child-process error strings as potentially sensitive.

Before errors/details reach public API responses, SSE, Runtime telemetry, Command Center, Automation service status, or ordinary tool results, ASTRA redacts common credential forms, approval/access tokens, URL credentials/sensitive query parameters, and user-home paths, then bounds the detail length.

This is defense-in-depth. Secret-bearing values must still never be deliberately inserted into ordinary telemetry.

Scoped approval tokens are allowed only in the explicit approval payload needed to complete that exact approval flow. They must not be copied into ordinary event detail/status text.

Provider status may expose a useful endpoint label, but embedded URL credentials or sensitive query values must be redacted.
