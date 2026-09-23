# Codex handoff — ASTRA multi-PC over existing SSH

Date: 2026-09-23

## User intent

ASTRA on the main/primary machine must be able to access three additional Windows computers from the same ASTRA UI.

Treat the current machine as the ASTRA hub. The other machines become controlled Computer Agent nodes.

## Critical context for Codex

Codex already configured and used the user's SSH setup in earlier target-PC work. Reuse that existing SSH topology and aliases instead of asking the user to rediscover or re-enter connection details.

Do **not** guess or hard-code PC2/PC3/PC4 aliases, IP addresses, usernames, private-key paths, or passwords. Resolve them from the existing target-machine SSH configuration/runtime that Codex already knows and verify each node on the actual target.

Known operational pattern from prior work: Windows OpenSSH with key authentication has been used successfully. Preserve that model.

## Security requirements

- Reuse existing SSH key authentication.
- Never store private keys, passwords, tokens, or private SSH config contents in Git.
- Never expose raw private-key material through ASTRA telemetry/UI.
- Preserve strict host verification. Do not silently disable host-key checking.
- Keep remote execution constrained to ASTRA registered capabilities; do not expose an arbitrary command textbox as a remote shell.
- Keep node configuration private/local (for example existing SSH aliases plus private ASTRA runtime configuration), not committed secrets.
- Time out and fail closed when a node is unreachable.

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

## Phase 1 — read-only only

Implement and validate remote Level-1 read-only capabilities first:

1. `computer.system.info`
   - computer/host name
   - Windows release/version
   - architecture

2. `computer.process.list`
   - bounded process list

The caller must specify or resolve one target node explicitly. Results must identify which node actually executed the tool.

Do not route these deterministic read-only actions through Codex, Hermes, NVIDIA, memory retrieval, or an Ollama planning round-trip when a matching registered Computer Tool is already available.

The local fast path added in PR #218 should remain fast and unchanged for the local node.

## Phase 2 — safe Level-2 actions

Only after Phase 1 is stable, extend approved allowlisted local actions to remote nodes, such as the existing app-launch capability.

Requirements:

- preserve Level-2 approval behavior;
- fixed allowlist only;
- no arbitrary executable path;
- no arbitrary shell command;
- return verifiable completion evidence from the chosen node.

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

Before calling multi-PC support complete, verify:

- existing SSH alias/config is reused;
- each remote node authenticates with the existing key path without interactive password entry;
- remote `system.info` returns the correct host identity;
- remote `process.list` returns a bounded real process list;
- local node still completes direct Level-1 requests without planner/model latency;
- wrong/unknown node fails closed;
- unreachable node fails closed with bounded timeout;
- no private SSH material appears in logs, evidence, Git, or UI;
- no arbitrary remote command execution is exposed.

## Do not redo completed work

Already completed on current main:

- controlled local Computer Agent enabled and validated;
- `computer.system.info` Level-1 tool added;
- local deterministic read-only fast path added;
- target evidence showed local system-info execution completed successfully in about 645 ms;
- local path used no memory retrieval, no plan, and no model provider.

Continue from that state. Do not remove or regress the existing local fast path while adding remote-node support.
