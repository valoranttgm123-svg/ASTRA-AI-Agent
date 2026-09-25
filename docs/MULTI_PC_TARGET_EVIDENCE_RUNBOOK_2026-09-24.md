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

Current known state (2026-09-25):
- the first real target test **FAILED** because cancelling the local SSH client left an ASTRA-owned remote parent/descendant alive;
- the focused remote-job / heartbeat / lease remediation is now repository-complete on draft PR #244 at exact head `0ac4093f8ab5ecf9346dd8053f36822e7ab033f9`;
- ASTRA CI #769 is SUCCESS on that exact head and the repository remote-STOP regression suite is 22/22 PASS;
- this is **repository evidence only**: Gate G remains **TARGET PENDING**, not PASS, until G0-G5 prove the real remote parent/descendant behavior on the target PC;
- keep #244 frozen for functional G0-G5 re-test; if target evidence exposes a concrete defect, repair that defect on the same focused scope and rerun the affected target gate.

Goal: prove ASTRA STOP terminates the actual remote owned work.

### G0 — post-fix identity / build pin

Before any re-test:
1. record the pushed fix commit and target runtime commit;
2. require the working tree/build identity expected by the active evidence freeze;
3. confirm the selected remote node identity before starting owned work;
4. do not reuse the original FAIL as PASS evidence.

### G1 — normal long-command completion

Prove the fix does not break ordinary completion:
1. run one harmless bounded long command on the pinned remote;
2. let it complete normally;
3. require exit/result to settle once;
4. require no false cancellation;
5. verify no owned-job residue remains.

### G2 — explicit STOP

1. start a harmless long-running Owner Mode command with a unique private marker/job identity;
2. independently prove the remote parent and at least one descendant/owned child are active when the test deliberately creates descendants;
3. invoke the normal ASTRA UI **STOP** control for that active interaction; the current UI path calls `stopInteraction()`, which aborts the active request signal. Do **not** substitute manual `ssh.exe` termination, Ctrl+C, Task Manager, or an out-of-band remote kill as the STOP proof;
4. wait only the bounded settlement interval;
5. independently inspect the same remote node;
6. require the owned remote parent and descendants to be absent;
7. require no late ASTRA success;
8. require no automatic retry;
9. verify unrelated processes remain alive.

### G3 — timeout / transport-loss settlement

Exercise the supported bounded failure path without changing private topology:
1. use a disposable owned job and a bounded timeout or approved transport-loss test;
2. require the local transport to settle;
3. require the remote lease/heartbeat contract to terminate or expire only the exact ASTRA-owned job;
4. independently verify no owned remote parent/descendant remains after the documented bound;
5. require no verified success after timeout/disconnect.

### G4 — stale lease / cleanup idempotence

Where the focused implementation exposes this behavior safely:
1. reproduce a stale/expired owned lease using only disposable target state and the production lease/heartbeat path;
2. do **not** use repository test-only seams such as `_tickLeaseWatchdogOnce()`, injected clocks, or mocked runners as target-PC evidence;
3. prove cleanup is scoped to that exact job;
4. repeat cleanup/settlement once;
5. require the second cleanup to be safe/idempotent;
6. require unrelated/concurrent jobs to remain unaffected.

### G5 — concurrent isolation

When feasible with disposable work:
1. start two distinct ASTRA-owned remote jobs on the same selected node;
2. STOP/cancel only one;
3. require only the selected job and its descendants to terminate;
4. require the other job to remain truthful and unaffected;
5. clean up the surviving disposable job normally.

PASS only if:
- the **remote work itself** terminates for STOP/timeout/disconnect according to the supported contract;
- parent + owned descendants are gone;
- unrelated/concurrent jobs are unaffected;
- no late success appears after cancellation;
- no private topology/credentials leak into public evidence.

If only the local SSH client exits while remote work continues, record FAIL. Do not weaken this gate or relabel local-process termination as remote STOP success.

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
