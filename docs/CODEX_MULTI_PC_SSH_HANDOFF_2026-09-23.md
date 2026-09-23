# Codex handoff — ASTRA multi-PC over existing SSH

Date: 2026-09-23

## User intent

ASTRA on the main/primary machine must be able to access three additional Windows computers from the same ASTRA UI.

Treat the current machine as the ASTRA hub. The other machines become trusted Computer Agent nodes.

The user's latest requirement is **Owner Mode / full administrative control** on all registered trusted PCs. Once a node is explicitly trusted and authenticated, ASTRA should not be limited to the current read-only/allowlisted capability set or require approval for every normal administrative action.

## Critical context for Codex

Codex already configured and used the user's SSH setup in earlier target-PC work. Reuse that existing SSH topology and aliases instead of asking the user to rediscover or re-enter connection details.

Do **not** guess or hard-code PC2/PC3/PC4 aliases, IP addresses, usernames, private-key paths, or passwords. Resolve them from the existing target-machine SSH configuration/runtime that Codex already knows and verify each node on the actual target.

Known operational pattern from prior work: Windows OpenSSH with key authentication has been used successfully. Preserve that model.

## Owner Mode boundary

Owner Mode is intentionally broad. On a trusted node ASTRA may perform normal administrator-level work including:

- arbitrary PowerShell/CMD execution;
- read/write/create/delete/move files and directories;
- launch/stop applications and processes;
- inspect/change services and scheduled tasks;
- install/update/uninstall software;
- Git/project/build/dev tooling;
- network and system administration;
- restart/shutdown;
- remote execution through the existing SSH transport.

Do not keep the current fixed app allowlist or Level-1/Level-2 capability ceiling as the functional limit of Owner Mode.

The security perimeter is the **trusted-node boundary**, not a per-command restriction:

- reuse the existing SSH key authentication;
- never store private keys, passwords, tokens, or private SSH config contents in Git;
- preserve host verification;
- keep node configuration private/local;
- require an explicitly registered trusted node before full control is available;
- provide a reliable STOP/KILL path so the user can terminate an active remote job;
- keep truthful execution/audit telemetry without logging secrets;
- if a node is unreachable or authentication fails, fail closed on that node and never silently execute on another machine.

## Required architecture

Extend the existing controlled Computer Tool Runtime from one local Windows machine to multiple named nodes.

Expected shape:

- local hub node: current Windows machine
- remote node 1: existing SSH target
- remote node 2: existing SSH target
- remote node 3: existing SSH target

ASTRA should be able to represent node state similar to:

```text
PC1   LOCAL   READY
PC2   SSH     READY
PC3   SSH     READY
PC4   SSH     READY
```

The displayed names may come from verified host identity / private node config; do not invent them.

## Implementation order

### Phase 1 — multi-node transport and identity

First make PC1 plus the three existing SSH targets first-class ASTRA nodes. Reuse the SSH aliases/configuration Codex already knows. Verify host identity and health per node.

Keep the already validated local fast-path reads working while transport is added.

### Phase 2 — Owner Mode executor

Add a general administrator executor for explicitly trusted nodes. It must be able to execute arbitrary user-requested local/remote administrative commands rather than requiring a predefined ASTRA tool for every possible operation.

The executor must return:

- selected target node;
- transport used (LOCAL or SSH);
- exit status / completion status;
- bounded stdout/stderr or structured evidence;
- truthful failure when the command did not complete.

Owner Mode should not wake Codex/Hermes/NVIDIA merely to perform a deterministic command when ASTRA can execute it directly. Model reasoning may still be used to translate a natural-language request into an execution plan when needed.

### Phase 3 — multi-step tasks

Allow ASTRA to carry out compound tasks on trusted nodes, for example:

- inspect a project;
- edit files;
- install dependencies;
- build/test;
- start/restart services;
- move files between trusted PCs;
- diagnose a failure and apply a repair;
- reboot a selected PC when requested.

The target node must remain explicit throughout a multi-step run so work cannot drift onto a different machine.

## Routing behavior

Examples of intended behavior:

- "cek versi Windows PC3" -> target PC3 -> remote `computer.system.info`
- "lihat proses di PC2" -> target PC2 -> remote `computer.process.list`
- "cek komputer ini" -> local node -> existing direct local tool path

If the requested node is ambiguous, ASTRA should ask for the node rather than silently choosing a remote machine.

If a node is offline, report that node as unavailable without falling through to a different computer.

## Readiness / status

Computer feature status should distinguish node transport and health, e.g. LOCAL / SSH and READY / OFFLINE / NOT_CONFIGURED.

A failure on one remote node must not mark every Computer Agent node offline.

## Target-PC validation gates

Codex owns validation on the actual target PCs.

Before calling multi-PC Owner Mode complete, verify:

- existing SSH alias/config is reused;
- each remote node authenticates with the existing key path without interactive password entry;
- ASTRA identifies the correct remote host before execution;
- arbitrary administrator commands can execute on an explicitly trusted node;
- file read/write/create/delete works on the selected trusted node;
- process/service/app control works on the selected trusted node;
- a multi-step project task can complete end-to-end on one selected node;
- local node still completes direct Level-1 requests without planner/model latency;
- wrong/unknown node fails closed;
- unreachable node fails closed with bounded timeout;
- STOP/KILL can terminate an active remote execution;
- no private SSH material or secrets appear in logs, evidence, Git, or UI;
- ASTRA never silently falls back from one target PC to another.

## Do not redo completed work

Already completed on current main:

- controlled local Computer Agent enabled and validated;
- `computer.system.info` Level-1 tool added;
- local deterministic read-only fast path added;
- target evidence showed local system-info execution completed successfully in about 645 ms;
- local path used no memory retrieval, no plan, and no model provider.

Continue from that state. Do not remove or regress the existing local fast path while adding remote-node support.
