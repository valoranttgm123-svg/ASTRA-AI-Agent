# ASTRA private multi-PC registry

ASTRA multi-PC uses the existing OpenSSH client configuration on the hub. Real
node metadata belongs in the gitignored `.astra/` directory and must never be
committed.

## Runtime file

Default path:

```text
.astra/computer-nodes.json
```

Override locally with:

```text
ASTRA_COMPUTER_NODES_FILE=<private-local-path>
```

Schema:

```json
{
  "version": 1,
  "nodes": [
    {
      "id": "<stable-node-id>",
      "label": "<display-name>",
      "transport": "SSH",
      "trusted": true,
      "sshAlias": "<existing-ssh-config-alias>",
      "expectedComputerName": "<verified-Windows-COMPUTERNAME>"
    }
  ]
}
```

Do not copy placeholder values literally. Resolve the real SSH alias and Windows
computer name on the target machine.

## Security boundary

The registry intentionally contains no password, token, private key, key path,
or private SSH config content. The parser rejects credential-like fields.
OpenSSH continues to resolve authentication and host verification from the
user's existing SSH configuration and known-hosts state.

A remote node can execute only when all of these are true:

1. `ASTRA_COMPUTER_ENABLED=true` on the hub.
2. The node exists in the private registry.
3. The node is explicitly `trusted: true`.
4. Its SSH connection succeeds non-interactively through the existing alias.
5. The remote `$env:COMPUTERNAME` matches `expectedComputerName`.
6. Owner commands additionally require `ASTRA_OWNER_MODE_ENABLED=true` and
   the existing ASTRA shell policy.

Unknown, untrusted, unreachable, or identity-mismatched nodes fail closed. ASTRA
must not reroute the request to local or another remote computer.

## Deterministic direct Owner Mode

Local remains unchanged:

```text
powershell: Write-Output ASTRA_LOCAL_OK
```

An explicitly selected remote node uses the stable node id:

```text
@<node-id> powershell: Write-Output ASTRA_REMOTE_OK
@<node-id> cmd: whoami
```

These explicit forms use the no-memory/no-planner/no-model Owner Mode fast path.
Natural-language requests can still use normal planning when translation is
needed.

## Node inventory and health

The Computer Tool Runtime exposes `computer.nodes.list`. The local node is
reported as `LOCAL`; configured remote nodes are `SSH`. Remote health is
probed independently and can report `READY`, `OFFLINE`, `UNTRUSTED`, or
`IDENTITY_MISMATCH`.

One remote failure does not change another node's state.

## Safe trust bootstrap

Once Codex has the real existing SSH aliases, create the private registry without
copying SSH credentials or config contents:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\configure-ssh-computer-nodes.ps1 -Node "<node-id>=<existing-ssh-alias>","<node-id>=<existing-ssh-alias>"
```

The bootstrap reads only effective HostName/port for diagnosis, uses normal
OpenSSH host verification and key authentication, verifies each remote Windows
`COMPUTERNAME`, and writes the registry only if every requested node succeeds.
If any alias cannot resolve/authenticate, no registry is written.

## Target validation

After the bootstrap succeeds and ASTRA-Agent is restarted, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\validate-multi-pc-owner-mode.ps1 -BaseUrl http://127.0.0.1:3017
```

The validator uses only trusted registry entries. Each node must return its own
marker through `routing_only`, zero memory retrieval, no planner plan, and an
SSH transport result. A deliberately unknown target is also checked to ensure
there is no silent fallback.

Remaining target-only evidence includes actual administrator privilege, file and
service mutation, long-running remote STOP/KILL, and end-to-end multi-step work.
