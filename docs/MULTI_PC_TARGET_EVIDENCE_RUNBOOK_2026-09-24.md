# ASTRA Multi-PC Target Evidence Runbook — 2026-09-24

Status: **DRAFT / TARGET-EXECUTION AID / DO NOT TREAT AS FINAL RELEASE EVIDENCE BY ITSELF**

Purpose: give Codex a repeatable, low-risk sequence for the remaining multi-PC target gates without rebuilding the SSH transport or exposing private topology.

Security / continuity rules:
- PC1 is LOCAL/hub and must not be placed in the remote registry.
- Use only the three already-verified private remote node IDs from the local registry.
- Do not write aliases, IPs, usernames, key paths or credentials into Git, chat evidence or public logs.
- Keep the target node explicit for every step.
- Never silently retry a command on another node.
- Do not stop/restart arbitrary production services for the sake of proof.
- Functional validation may continue on the installed runtime, but official release evidence must later be recaptured on one frozen final clean commit.

## Evidence record template

For every target action record privately:

```text
NODE_ID:
EXPECTED_COMPUTERNAME:
TRANSPORT: SSH
ACTION:
START_TIME:
END_TIME:
RESULT: PASS | FAIL | BLOCKED
EXIT_CODE:
STDOUT_SUMMARY:
STDERR_SUMMARY:
ROLLBACK:
POST_CHECK:
ASTRA_STATE:
NOTES:
```

PASS requires the selected node and transport to be visible/truthful in ASTRA evidence.

## Gate A — administrator context

Goal: prove Owner Mode reaches the selected remote with administrator context without making a destructive change.

Preferred probe on each selected node:
- inspect current Windows identity;
- inspect administrator-group membership/elevation;
- return COMPUTERNAME;
- return a unique marker.

PASS:
- reported COMPUTERNAME matches the registered target;
- the administrator/elevation check is truthful;
- ASTRA reports SSH and the intended node;
- command exits successfully;
- no memory/planner/model round-trip is used for explicit direct Owner Mode.

FAIL:
- wrong computer;
- ambiguous node;
- silent fallback;
- elevation claim is not actually true;
- target mismatch is ignored.

## Gate B — bounded file mutation with rollback

Use a disposable path under a temporary/evidence directory on the selected remote. Do not touch user projects.

Sequence:
1. create a unique directory/token;
2. write a small marker file;
3. read it back;
4. calculate/record its hash or exact bounded content;
5. rename or update it once;
6. verify the new state;
7. delete the marker and directory;
8. independently verify cleanup.

PASS:
- all mutations occur only on the pinned node;
- read-back matches exactly;
- cleanup succeeds;
- no residue remains.

FAIL:
- any mutation appears on another node;
- cleanup fails;
- evidence cannot prove the node;
- an operation succeeds after ASTRA reported failure.

## Gate C — process control

Use a disposable long-running process with a unique marker. Do not target unrelated user/system processes.

Sequence:
1. launch a harmless long-running process on one remote;
2. capture its PID/unique command marker;
3. verify it exists on that same remote;
4. terminate that exact owned PID;
5. verify it no longer exists;
6. prove unrelated processes remain unaffected.

This proves remote process control. It is **not** a substitute for the separate ASTRA STOP/KILL gate below.

## Gate D — service-control evidence

Do not stop, disable or reconfigure an arbitrary Windows service.

Preferred order:
1. inspect/query a real service through Owner Mode;
2. if a disposable ASTRA-owned/test service already exists, use only that service for start/stop/restart evidence;
3. otherwise mark destructive service-state mutation **BLOCKED: no disposable service available** and do not manufacture proof by stopping a production service.

PASS for an actual service-state mutation requires:
- service is explicitly disposable/approved for testing;
- before/after state is captured;
- rollback restores original state;
- target identity remains pinned.

A read-only service query can support administrator/service visibility but does not by itself prove mutation.

## Gate E — unreachable node fail-closed

Goal: prove a registered target that cannot be reached does not fall back to another PC.

Use a reversible private test setup only. Do not expose topology in Git.

Acceptable test patterns:
- a disposable private registry entry that points to a deliberately unreachable test alias/host and has a bounded timeout; or
- a real remote that is already naturally unavailable during the test.

PASS:
- ASTRA returns blocked/unavailable within the configured bound;
- requested marker never appears;
- no other registered node executes the command;
- local PC1 does not execute it.

Restore private configuration exactly after any synthetic test.

## Gate F — wrong identity fail-closed

Goal: prove SSH connectivity is not enough when COMPUTERNAME does not match the expected private registry identity.

Use only a reversible private test:
1. back up/hash the private registry;
2. temporarily set one test entry's expected COMPUTERNAME to a known-wrong value;
3. restart/reload only as required;
4. issue a harmless marker request to that node;
5. require BLOCKED/identity mismatch;
6. restore the original registry exactly;
7. verify original hash/state is restored.

PASS:
- marker never executes;
- no fallback occurs;
- identity mismatch is explicit;
- restored registry works normally.

## Gate G — remote ASTRA STOP/KILL

This is stricter than killing the local `ssh.exe` client.

Goal: prove ASTRA STOP terminates the actual remote owned work.

Sequence:
1. on one pinned remote, start a harmless long-running Owner Mode command with a unique marker/PID;
2. independently prove the remote process is active;
3. while ASTRA reports the operation running, invoke the normal ASTRA STOP/KILL control;
4. wait only the bounded settlement interval;
5. independently inspect the remote node;
6. require the owned remote process/marker to be absent;
7. require no late ASTRA success;
8. require no automatic retry;
9. verify unrelated processes remain alive.

PASS only if the **remote work itself** terminates.

If only the local SSH client exits while the remote process continues, record FAIL and treat that as an evidence-backed design defect for refinement.

## Gate H — pinned multi-step task

Use one disposable task on one selected node. Do not use an important project for first proof.

Example safe task:
1. create a temporary project directory;
2. create a small text/JSON file;
3. initialize a temporary Git repository if Git is available;
4. modify the file;
5. run a deterministic validation command;
6. inspect resulting status/output;
7. clean up the temporary directory.

Requirements:
- every step remains pinned to the same node ID;
- every result reports the same remote identity/SSH transport;
- no step drifts to PC1 or another remote;
- failure at any step stops/blocks truthfully;
- cleanup is verified.

## Gate I — final multi-PC checkpoint

Multi-PC Owner Mode can be called target-validated only when all of these are evidenced:
- direct marker on each registered remote — already reported PASS;
- unknown-node fail-closed — already reported PASS;
- administrator context;
- file mutation + rollback;
- process control;
- safe service-control evidence or a truthful BLOCKED reason if no disposable service exists;
- unreachable fail-closed;
- wrong-identity fail-closed;
- remote STOP/KILL terminates remote work;
- one pinned multi-step task;
- no private SSH material in evidence/logs/UI;
- PC1 remains LOCAL.

## Commit-bound release reminder

These functional checks are valuable for finding defects.

However, Phase-20/final release evidence must be repeated or officially recorded on the final frozen clean release commit when required by the release evidence contract. Do not relabel evidence from an older runtime commit as current-HEAD final evidence.
