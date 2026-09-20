# ASTRA Core Release Checklist — Phase 18–20

## Phase 18 — Release Candidate

### Repository gate automation

Run locally:

```powershell
npm run release:repo-gate
```

GitHub CI executes the same required categories as independent visible steps and additionally enforces PR/push range `git diff --check`.

Repository-gate tooling status: **IMPLEMENTED ON GREEN MERGE / RC NOT YET DECLARED**

### Repository gate

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm audit --audit-level=high`
- [ ] `git diff --check`

### Program gate

- [ ] Phase 14 target-PC Automation validation
- [x] Phase 15 security validation matrix
- [ ] Real Sonor state validated/reported
- [ ] Phase 16 performance baseline
- [ ] Phase 17 full-system validation
- [x] stale PR #51 reconciled
- [ ] no release-blocking browser console errors
- [x] no known secret/private runtime data committed — current tree audit clean
- [x] README / install docs reflect current architecture

RC status: **PENDING**

---

## Phase 19 — Windows ready-to-use release

### Install/start

- [ ] fresh or clean Windows-path validation
- [ ] supported Node detected
- [ ] dependencies install
- [ ] production build succeeds
- [ ] ASTRA starts on loopback only
- [ ] desktop shortcut works
- [ ] ASTRA-Agent startup task works
- [ ] ASTRA-Ollama startup task works
- [ ] Ollama model status truthful
- [ ] Codex status truthful
- [ ] Automation status truthful
- [ ] Sonor status truthful
- [ ] private `.astra/` paths valid
- [ ] uninstall/reinstall procedure verified

### Self-check output

Every capability must resolve to one of:

- READY
- NOT_CONFIGURED
- OFFLINE
- ERROR

No fake READY.

Windows status: **PENDING**

---

## Phase 20 — ASTRA MAX Core Release Gate

Final report must contain:

### COMPLETED
PENDING

### VERIFIED
PENDING

### CONNECTED
PENDING

### REQUIRES USER LOGIN
PENDING

### REQUIRES PHYSICAL TEST
PENDING

### NOT IMPLEMENTED
PENDING

### SECURITY STATUS
PENDING

### PERFORMANCE STATUS
PENDING

### TEST STATUS
PENDING

### RELEASE STATUS

Choose exactly one after evidence exists:

- READY
- READY WITH EXTERNAL CONFIGURATION REQUIRED
- BLOCKED

Current status: **PENDING**

---

Phase 20 is not the final product roadmap stop.

After the core gate stabilizes, continue Phase 21–30 JARVIS-Class roadmap from `docs/ASTRA_MAX.md`.
