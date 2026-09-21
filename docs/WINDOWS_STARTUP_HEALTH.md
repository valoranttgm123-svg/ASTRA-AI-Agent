# ASTRA Windows Startup Health

The Windows installer no longer relies on fixed startup sleeps.

After registering and starting `ASTRA-Ollama` and `ASTRA-Agent`, it calls:

```powershell
.\scripts\windows\wait-local-health.ps1
```

The waiter is bounded and read-only.

It polls:

- `GET http://127.0.0.1:<port>/api/agent` and requires `ready=true`;
- `GET http://127.0.0.1:11434/api/version` and requires a version;
- `GET http://127.0.0.1:<port>/api/automation/service` and requires a service status object.

Defaults:

- timeout: 45 seconds;
- poll interval: 500 ms;
- each individual HTTP probe has a short timeout.

The waiter does not register/start/stop tasks, install dependencies, build, pull Git, or delete files.

The desktop shortcut is created only after the local health gate succeeds.

If the timeout expires, installation fails truthfully instead of treating a fixed sleep as readiness evidence.
