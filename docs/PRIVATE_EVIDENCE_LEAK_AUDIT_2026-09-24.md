# ASTRA Private Evidence / SSH Topology Leak Audit — 2026-09-24

Status: **PASS / DRAFT CHECKPOINT EVIDENCE — REVALIDATED AFTER PR SCOPE GROWTH**

Purpose: verify that the current public repository/draft preparation does not expose the private multi-PC SSH topology or credential material.

## Scope

Scanned directly on draft PR #241:
- all 17 files currently changed by PR #241;
- `.gitignore`;
- `lib/tools/computer-nodes.ts`;
- `scripts/windows/configure-ssh-computer-nodes.ps1`;
- `docs/COMPUTER_NODES_PRIVATE_CONFIG.md`;
- `docs/CODEX_MULTI_PC_SSH_HANDOFF_2026-09-23.md`.

Total unique files inspected directly: **21** (17 PR files + 4 additional baseline files not already present in the PR diff).

Also searched the repository for current private alias strings and common private-key/IP/credential indicators.

Revalidation note:
- PR #241 grew from 15 to 17 changed files after the first audit checkpoint.
- The two additional PR files were included in this revalidation.
- Pattern hits were limited to deliberate audit/example text such as RFC1918 CIDR examples and the literal placeholder phrase `user@host`; no concrete private topology or credential value was found.

## Patterns checked

- current owner-provided SSH alias strings;
- OpenSSH private-key material/header patterns;
- `IdentityFile` / private key-path assignments;
- RFC1918 IPv4 literals:
  - `10.0.0.0/8`;
  - `172.16.0.0/12`;
  - `192.168.0.0/16`;
- obvious password/passphrase/token assignments;
- literal SSH `user@host` topology strings.

## Result

**PASS — no matching private topology or credential material was found in the inspected files.**

The draft continues to use only public-safe descriptions such as:
- PC1 is LOCAL;
- three remote Windows targets are privately registered;
- exact aliases/topology remain private;
- private evidence belongs under gitignored `.astra/`.

## Boundary

This audit does not claim:
- the user's local SSH config is secret-free;
- private `.astra/` evidence was inspected;
- Git history contains no historical secret that predates the audited scope.

It verifies the current public/draft repository scope described above.

## DO NOT REPEAT

Do not re-run this same leak audit unless:
- new files containing SSH/evidence details are added;
- Codex posts new target evidence that must be reconciled into Git;
- a private alias/IP/key path is suspected to have been committed.

## Next

Continue only independent draft preparation or reconcile new Codex target evidence. Keep exact aliases/IPs/usernames/key paths/credentials out of Git.
