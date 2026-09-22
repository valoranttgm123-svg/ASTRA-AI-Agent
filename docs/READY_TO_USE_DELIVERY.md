# ASTRA Ready-to-Use Delivery Contract

## Owner outcome

The owner wants to receive ASTRA as a ready-to-use application.

Codex owns the technical workflow end to end. The owner should not be asked to manually edit source files, environment files, JSON, PowerShell scripts, Git state, dependencies, Windows startup configuration, provider routing, tests, or release evidence.

The target experience is:

```text
owner provides only unavoidable credentials / consent
                    ↓
Codex performs repository + target-PC work
                    ↓
Codex validates and fixes failures
                    ↓
ASTRA launches normally on Windows
                    ↓
owner uses ASTRA
```

## What Codex must do

When target-PC access is available, Codex must handle all technically executable work itself:

1. locate or create the canonical ASTRA checkout;
2. reconcile it with the latest safe `main` without losing private local state;
3. install/repair required runtime dependencies;
4. create and maintain `.env.local`;
5. request secrets only when a secret is actually required;
6. write secrets locally without echoing them back;
7. verify secrets are not tracked, committed, logged, or uploaded;
8. configure NVIDIA JARVIS Mesh and validate the real hosted endpoint;
9. inspect and connect the existing local Sonor/Graphify/Obsidian workflow rather than duplicating it;
10. validate Ollama/Hermes/Codex/local providers that are part of the selected production setup;
11. run the required Phase 14 / MEM-X / 16 / 17 / 19 / 20 target-PC gates;
12. fix reproducible defects found during those gates rather than merely reporting them;
13. install/repair Windows startup integration and the user-facing launcher/shortcut;
14. validate STOP/cancel behavior and approval boundaries;
15. validate production build/startup, update, and non-destructive reinstall;
16. collect truthful release evidence;
17. leave the working tree safe and recoverable;
18. provide a final concise owner handoff describing how to launch/use ASTRA and any genuinely external limitation.

## Owner interaction budget

Owner interaction must be minimized.

Acceptable owner actions are only things Codex cannot legitimately do by itself, for example:

- entering an API key, password, login, MFA/2FA code, or account consent;
- approving an OS/UAC/security prompt that requires a human;
- granting camera/microphone permissions when Windows/browser requires explicit human consent;
- making a physical observation that cannot be measured programmatically;
- approving a genuinely high-impact action under ASTRA's permission model.

These are not implementation tasks. Codex should immediately continue the technical workflow after the owner supplies the required input.

Do not ask the owner to:

- copy/paste project commands;
- edit `.env.local`;
- run npm/git/PowerShell commands;
- choose file paths Codex can discover;
- inspect logs Codex can read;
- manually test things Codex can automate;
- re-explain the roadmap already stored in the repository.

## Do-not-stop rule

Codex must not stop merely because:

- one command failed;
- a build/test failed;
- a path moved;
- a dependency is missing;
- a local service is stopped;
- an environment file needs creation;
- a configuration mismatch is fixable;
- a repository defect is reproducible and repairable.

Codex should diagnose, repair, retest, and continue.

Stop only for a genuine external blocker, safety/approval boundary, unavailable credential, or physical-human-only step. Record the exact blocker and resume automatically once it is resolved.

## Ready-to-use acceptance

Do not tell the owner ASTRA is ready merely because repository CI is green.

A ready-to-use delivery requires target-PC evidence appropriate to the enabled feature set, including:

- production ASTRA launches successfully on the target Windows PC;
- expected local services are reachable;
- provider status reflects reality;
- NVIDIA JARVIS Mesh passes live API validation when enabled;
- private credentials remain local and untracked;
- Sonor/MEM-X status is validated against the real local implementation when enabled;
- startup/launcher behavior works;
- update and repair/reinstall paths are validated;
- STOP/cancel and approval controls function;
- core full-system scenarios pass;
- release report is generated from measured evidence;
- no known reproducible release-blocking defect is left unfixed.

If an optional external integration remains unconfigured, label it truthfully. Do not block the entire delivery unless that integration is part of the agreed required feature set.

## Final owner handoff

The desired final owner handoff is short:

1. where/how to launch ASTRA;
2. which major capabilities are operational;
3. which optional external integrations, if any, still require an account/credential;
4. how to stop/restart/update ASTRA;
5. the verified release status.

The owner should not receive a development to-do list as the final product handoff.

## Autonomous credential completion

The owner's preferred operating mode is **no-interruption delivery**: Codex should not ask the owner to manually provision a provider secret if the credential can already be obtained or reused safely from an authorized local source.

For NVIDIA and other providers, Codex should try these paths in order:

1. reuse an existing valid secret already present in the canonical local `.env.local`;
2. reuse an existing authorized local environment/secret source available to the ASTRA runtime;
3. reuse an already-authenticated provider session on the target PC when Codex has legitimate access to that session and the provider flow permits creating/retrieving a new API credential without bypassing security;
4. validate the resulting credential live, store it only in the intended local secret location, and ensure it is never committed/logged/uploaded.

Codex must never:
- invent a fake credential;
- bypass login, MFA, account consent, CAPTCHA, UAC, or provider security;
- extract unrelated passwords/tokens;
- weaken account security to achieve zero-touch setup.

If a required credential cannot be obtained from an already-authorized local source, Codex should continue every other independent setup/validation task instead of stopping the whole workflow. That credential remains an external blocker and ASTRA must not be labeled READY for that provider until the provider is actually authenticated.

The intended owner experience is that Codex attempts every legitimate autonomous path first and only exposes a human-authentication blocker if no authorized credential/session exists.
