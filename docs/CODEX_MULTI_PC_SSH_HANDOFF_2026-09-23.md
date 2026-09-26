# Codex handoff — ASTRA multi-PC over existing SSH

## 2026-09-24 — multi-PC transport merged; target SSH verification next

PR #225 merged to main as `6b3859a70f8c46ab80204b56c788e06cb8c09e60`
after full ASTRA CI success (build, unit/integration tests, typecheck, Brain lint,
dependency audit and diff check).

Repository-complete now:

- private gitignored node registry via `ASTRA_COMPUTER_NODES_FILE`;
- default `.astra/computer-nodes.json`, with parser rejection of credential/key fields;
- first-class `computer.nodes.list` plus optional `nodeId` on Computer tools;
- multi-node default runtime with LOCAL and SSH transport evidence;
- OpenSSH `BatchMode=yes` using only the existing SSH config alias and normal
  known-host verification (no host-key bypass and no private key path in ASTRA);
- per-command remote `COMPUTERNAME` identity guard against the private
  `expectedComputerName`;
- trusted-node requirement, bounded output/timeouts, and no fallback for
  unknown/untrusted/offline/identity-mismatched targets;
- explicit direct no-model syntax `@<node-id> powershell: ...` / `cmd: ...`;
- target validator `scripts/windows/validate-multi-pc-owner-mode.ps1`;
- regression tests for config secrets, target evidence, unknown/untrusted nodes,
  identity mismatch and independent node inventory.

PR #226 is also merged to main as `6cdfe8089dfb2e0273e984ca4ad9a2952d157b8e` and adds `scripts/windows/configure-ssh-computer-nodes.ps1`: a local trust-bootstrap helper that receives explicit `node-id=existing-ssh-alias` mappings, inspects only safe `ssh -G` fields (HostName/port), verifies the remote Windows `COMPUTERNAME` over normal host-verified SSH, and writes the private registry only when every target succeeds. It never copies passwords, tokens, private keys, key paths, or SSH config contents into the registry.

The older target-only observation that intended remote aliases failed name
resolution is superseded. The owner now reports four PC targets connected in
Codex. Exact aliases remain private and must not be committed. On the real hub,
verify the current connected aliases with `ssh -G` and remote
`$env:COMPUTERNAME`, identify which machine is LOCAL/the ASTRA hub, bootstrap
only the remaining verified remote nodes, restart ASTRA-Agent, then run the
validator.

Reliable remote STOP/KILL, actual administrator/file/service mutations and a
multi-step task still require physical target evidence before declaring
multi-PC Owner Mode complete.

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

## Historical PC1 implementation status — superseded by PR #222/#225/#226

Local Owner Mode on PC1 is now implemented in the repository:

- PR #221 merged `computer.owner.exec` into `main` as a bounded, cancellable Level-2 local command executor;
- `scripts/windows/enable-owner-mode.ps1` enables the required local runtime flags without committing secrets;
- the follow-up branch `feat/local-owner-mode-direct-exec-20260923` adds an explicit no-model fast path for deterministic Owner Mode commands;
- only explicit prefixes are eligible for the direct path: `powershell:`, `pwsh:`, `cmd:`, optionally prefixed with `jalankan`/`run`/`execute`/`eksekusi` and `owner mode`;
- ambiguous natural-language requests are intentionally not interpreted as raw shell commands by this direct path;
- direct Owner Mode still obeys the runtime permission ceiling and fails closed unless `computer.owner.exec` is READY and `ASTRA_ALLOW_SHELL=true`.

PC1 target validation was subsequently completed successfully. The historical minimum probe was:

```text
powershell: Write-Output ASTRA_OWNER_DIRECT_OK
```

Recorded evidence showed `computer.owner.exec` executing with exit code 0, stdout containing `ASTRA_OWNER_DIRECT_OK`, Brain provider `routing_only`, memory retrieval 0 and no planner/model round-trip. Do not repeat this PC1 validation unless a concrete regression appears.

A target-PC validation helper now exists at `scripts/windows/validate-owner-mode.ps1`. Run it against the active ASTRA URL after enabling Owner Mode, for example:

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\windows\\validate-owner-mode.ps1 -BaseUrl http://127.0.0.1:3017
```

Use the actual local ASTRA port if it differs. The script fails closed unless Owner Mode is READY and the direct probe returns verified tool lifecycle evidence without memory/planner/model use.

That repository sequence is now complete through PR #225/#226. Later target work also confirmed PC1 as LOCAL and privately registered/marker-validated three remote Windows nodes. Codex must not reimplement the local executor, multi-PC transport, alias verification or registry bootstrap. Continue only with remaining remote admin/file/process/service, unreachable/wrong-identity, STOP/KILL and pinned multi-step evidence.

## Do not redo completed work

Already completed on current main:

- controlled local Computer Agent enabled and validated;
- `computer.system.info` Level-1 tool added;
- local deterministic read-only fast path added;
- target evidence showed local system-info execution completed successfully in about 645 ms;
- local path used no memory retrieval, no plan, and no model provider.

Continue from the current merged state. Do not remove or regress the existing local fast path or rebuild remote-node support already merged in PR #225/#226.
