# ASTRA Core Release Checklist — Phase 18–20

## Phase 18 — Release Candidate

### Repository gate

- [x] Repository gate automation implemented and merged — PR #119
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
- [x] no known secret/private runtime data committed
- [x] README / install docs reflect current architecture

RC status: **PENDING**

---

## Phase 19 — Windows ready-to-use release

Follow M5-0…M5-8 in `docs/WINDOWS_RELEASE.md`; install, update, reinstall and bounded-health are separate evidence gates and must not be inferred from one another.

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
- [ ] bounded startup health gate verified on target Windows

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

Follow M6-0…M6-7 in `docs/CORE_RELEASE_REPORT.md`. Official evidence must belong to one frozen candidate; any build-changing fix requires affected evidence to be recaptured.

### Repository evidence/report tooling

- [x] Conservative core report generator merged — PR #123
- [x] Browser/Humanoid private evidence capture merged — PR #124
- [x] Evidence-backed manual gate recorder merged — PR #125
- [x] Final-report context recorder merged — PR #126
- [ ] Repository gate PASS evidence captured on current target checkout
- [ ] Target-PC evidence bundle captured
- [ ] Required Humanoid HIGH browser evidence captured
- [ ] All six manual gates have real evidence-backed outcomes
- [ ] Core report generated and reviewed

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
