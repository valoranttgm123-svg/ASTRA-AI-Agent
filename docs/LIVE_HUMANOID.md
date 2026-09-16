# ASTRA Live Humanoid

ASTRA Live Humanoid is an interaction surface, not a decorative video layer.

## Runtime flow

```text
User command
   ↓
ASTRA runtime
   ↓
Avatar state controller
   ↓
Live humanoid rig
   ↓
Head / eyes / jaw / neck / shoulders / hologram energy
```

## Avatar states

- `idle` — breathing, blinking, subtle gaze tracking.
- `listening` — leans forward slightly and focuses on the user.
- `thinking` — controlled gaze shift and slower head motion.
- `speaking` — jaw motion, micro head gestures, warmer facial energy.
- `executing` — steady focused posture for tool execution.
- `success` — short acknowledgement/nod behavior.
- `error` — restrained head tilt/error posture.

## Speech

V1 can use browser `speechSynthesis` for no-extra-cost voice output. While speech is active, ASTRA publishes a `speechLevel` signal to the live rig. This is currently a lightweight speech envelope; a later audio analyser/viseme engine can replace it without changing the avatar state API.

## Model strategy

The V1 live rig is deliberately separated from the final visual model. The interaction controller must remain stable while the visual asset evolves.

Target model path for the production humanoid:

```text
public/models/astra-humanoid.glb
```

Recommended production model requirements:

- rigged head, neck and shoulders;
- jaw bone or jaw-open morph target;
- blink left/right morph targets;
- eye look controls or eye bones;
- optional ARKit-compatible facial blendshapes;
- clean topology suitable for a hologram shader;
- GLB/VRM-compatible export.

A future model adapter should map the production model's bones/blendshapes onto the same `AstraAvatarState` and `speechLevel` signals used by V1. The rest of ASTRA should not need to know which 3D asset is loaded.

## Safety / behavior

Avatar animation is presentation only. Agent tool permissions and approval gates remain independent of the humanoid. A more expressive avatar must never bypass approval requirements for external, destructive, system, database, financial, or trading actions.
