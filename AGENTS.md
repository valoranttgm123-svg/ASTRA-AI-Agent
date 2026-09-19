# ASTRA Repository Instructions for Codex

This repository is the working source of truth for the ASTRA AI Agent project.

Before changing ASTRA, read these files in order:

1. `docs/CODEX_HANDOFF.md` — current architecture, active state, constraints, next work.
2. `docs/ASTRA_CONVERSATION_HISTORY.md` — conversation-derived project history and user decisions.
3. `docs/HUMANOID_BUILD_LOG.md` — detailed Humanoid implementation history.
4. `docs/ASTRA_BRAIN_V1.md` — approved Brain architecture direction.
5. `docs/ARCHITECTURE.md` and `SECURITY.md` — runtime/security boundaries.

## Project intent

ASTRA should become one integrated AI operating environment:

```text
USER
  ↓
HUMANOID / CHAT / MIC / GESTURE
  ↓
ASTRA RUNTIME / EVENT BUS
  ↓
ASTRA BRAIN
  ├─ Hermes orchestration
  ├─ Ollama local default
  ├─ Codex engineering specialist
  ├─ Memory
  └─ Tools / MCP / optional cloud
  ↓
COMMAND CENTER
  └─ visualizes real agent/tool/task events
```

Humanoid is the face/presence of ASTRA.
Brain is the reasoning/execution layer.
Command Center is the real-time visualization/control surface for Brain activity.

Do not build these as disconnected systems.

## Non-negotiable Humanoid rules

- Keep the approved artwork source:
  `public/assets/astra-humanoid/astra-idle-v1.webp`
- Humanoid remains image-driven, not a newly invented procedural character.
- Preserve the approved silhouette, cyan/orange palette, source proportions, and faceless/bald visual language.
- Do not generate or replace artwork unless the user explicitly asks.
- Keep one renderer.
- HIGH quality should preserve visual fidelity; optimize architecture before lowering quality.
- Never describe a visual pulse as measured audio loudness unless real audio amplitude is actually measured.
- Camera hand tracking uses local MediaPipe inference; do not claim browser speech recognition is local/private.
- Keep Effects Off / reduced-motion fallbacks.
- Preserve recoverable backup branches before large visual refactors.

## Runtime rules

- Real user interaction must drive state:
  `IDLE → LISTENING → THINKING → SPEAKING → IDLE`
- Do not fake agent activity in Command Center.
- Command Center nodes must light from real Brain/runtime events.
- Meaningful stop/cancel actions must actually stop mic/request/speech, not only change animation.
- Paid cloud providers are disabled by default and must not be silently used.
- No secrets in the repository.

## Git / validation rules

Before merging meaningful changes:

- create a recoverable backup branch when the change is risky;
- work on a feature branch;
- run the production GitHub Actions build;
- merge only when CI succeeds;
- update the relevant build/context docs.

## Local commands

Development:

```powershell
cd C:\WINDOWS\system32\ASTRA-AI-Agent
git checkout main
git pull origin main
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

Production comparison:

```powershell
npm run build
npm run start
```

## Privacy / repository hygiene

Never commit:
- API keys;
- OAuth tokens;
- passwords;
- SSH private keys;
- broker credentials;
- private memory databases;
- private ChatGPT/system prompts;
- hidden chain-of-thought.

The conversation-history document stores project-relevant decisions and facts, not hidden reasoning or credentials.
