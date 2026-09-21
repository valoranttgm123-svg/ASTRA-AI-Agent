# ASTRA Windows Runtime Loopback Boundary

The Windows ASTRA runner is fail-closed around its local HTTP port.

`scripts/windows/run-astra.ps1` now:

- enumerates all listeners on the configured ASTRA port;
- rejects any listener bound outside `127.0.0.1` / `::1`;
- if an IPv4 loopback listener already exists, verifies it through `GET /api/agent`;
- accepts the existing process only when the Brain status reports `ready=true` and exposes the expected capability/feature status structures;
- otherwise treats the port as occupied by an unhealthy/non-ASTRA process;
- starts Next.js explicitly with `--hostname 127.0.0.1`.

This replaces the weaker historical check that accepted a page merely because its HTML contained the text `ASTRA`.

The runner does not change firewall rules or expose a public listener.
