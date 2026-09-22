# Phase 29 — Generic Skill Ecosystem + Environment Bridge

Status date: **2026-09-22**

This document records the repository-side Phase 29 contract. It does not claim a real smart-home/device provider is already connected.

## Generic skill registry

Canonical implementation:

- `lib/skills/contracts.ts`
- `lib/skills/registry.ts`
- private state: `.astra/generic-skills.json`
- override: `ASTRA_GENERIC_SKILL_REGISTRY_FILE`

A generic skill manifest records:

- id and version;
- capability;
- mapped Tool Registry ids;
- provider identity;
- declared permission ceiling;
- network requirement;
- required **secret names only**;
- verification method;
- install/update/trust state;
- enabled state;
- checksum;
- rollback metadata.

### Trust boundary

Newly registered skills are always:

- `trustState = untrusted`;
- `installState = registered`;
- `enabled = false`.

They cannot be installed until an explicit review transition records `reviewed`.

Review does **not** make third-party instructions authoritative. A skill remains data/configuration and may act only through existing ASTRA Tool Runtime permissions.

Install, update, rollback, and remove transitions require non-empty verification evidence before registry truth may advance.

Install does not auto-enable a skill.

### Permission and health truth

`checkSkillHealth()` verifies:

- reviewed trust state;
- installed + enabled state;
- required named secrets are available;
- required local/internet network is explicitly reported available;
- every mapped tool exists;
- the manifest does not understate any mapped tool permission;
- every mapped tool is actually `READY`.

A skill manifest never creates execution authority by itself.

## Environment / IoT registry

Canonical implementation:

- `lib/environment/contracts.ts`
- `lib/environment/registry.ts`
- private state: `.astra/environment-devices.json`
- override: `ASTRA_ENVIRONMENT_REGISTRY_FILE`

Supported provider-neutral device classes include:

- light;
- smart plug;
- printer;
- sensor;
- camera;
- local service;
- other explicitly configured devices.

There is no automatic LAN scan and no public control endpoint.

A device must be explicitly registered and starts disabled.

Each capability maps to an existing Tool Registry id and declares:

- capability id;
- `read` or `write`;
- required permission level;
- mapped tool id.

### Operation rules

- read capabilities require Permission Level 1 or higher;
- environment writes require Permission Level 3 or higher;
- writes remain scoped-approval-bound;
- a read capability may not map to a mutating tool;
- a write capability may not map to a read-only tool;
- the declared capability permission may not understate the mapped tool;
- mapped tools must report `READY`;
- camera and sensor devices must use `sensitive` privacy classification;
- sensitive reads/writes require explicit per-operation privacy consent.

The bridge never bypasses manufacturer authentication/security controls. Provider credentials belong in ASTRA secret providers, not this registry.

## Persistence safety

Both registries:

- are gitignored runtime metadata under `.astra/` by default;
- reject symbolic-link targets;
- use bounded record counts and file sizes;
- write private files/directories;
- store metadata, not secret values.

The generic registry intentionally does not reuse the older `ASTRA_SKILLS_FILE=.astra/skills.json` path.

## Verification

Regression coverage: `tests/skill-environment-foundation.test.ts`.

Validated in PR #169 code CI run #453:

- Next build: success;
- 375 unit/integration tests: success;
- TypeScript typecheck: success;
- lint: success;
- dependency audit: success;
- PR diff check: success.

Repository verification is not real-device telemetry. Phase 30 scenario J9 still requires a real registered provider/device, Tool Runtime invocation, telemetry, verification, approval behavior, and target-environment evidence.
