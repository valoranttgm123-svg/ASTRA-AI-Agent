# ASTRA Windows Ollama Loopback Boundary

The ASTRA-managed Windows Ollama Scheduled Task must not expose Ollama to the LAN.

`scripts/windows/run-ollama.ps1` therefore:

- inspects listeners on port `11434`;
- rejects any existing listener that is not `127.0.0.1` or `::1`;
- accepts an already-running healthy loopback Ollama;
- when starting its own Ollama process, explicitly sets:

```text
OLLAMA_HOST=127.0.0.1:11434
```

This override applies to the ASTRA task process only. It does not modify the user profile permanently, does not change firewall rules, and does not change `OLLAMA_MODELS` or model storage.

If a user intentionally runs a network-exposed Ollama instance for another workflow, ASTRA should not silently reuse it. The ASTRA task fails closed until a loopback-only instance is available.
