# ASTRA Humanoid Lab

The Humanoid Lab lives at `/lab/humanoid` and is intentionally isolated from the main ASTRA orb interface.

## Purpose

Use the lab to validate a production humanoid model before it is allowed into the main interface. The lab tests:

- GLB loading
- skeleton / skinned-mesh detection
- head, neck and jaw bone discovery
- morph-target discovery
- embedded animation clips
- interaction states: idle, listening, thinking, speaking, success and error
- pointer-driven head movement
- speaking jaw / mouth-open morph response
- camera orbit and zoom

## Model requirements

Preferred production asset: a single `.glb` file containing its meshes, textures, skeleton and facial morph targets.

Best results require:

- a recognizable head bone
- neck bone
- jaw bone or `jawOpen` / `mouthOpen` morph target
- eye blink morph targets
- neutral idle pose
- clean humanoid proportions

VRM support can be added after the GLB pipeline is approved.

## Safety / privacy

The local file picker uses `URL.createObjectURL()` in the browser. Selecting a local GLB does not upload it to ASTRA, GitHub or an external server.

## Integration rule

Do not replace the main ASTRA orb with an experimental humanoid. First approve the model and its movement in `/lab/humanoid`; only then integrate it with the main agent UI.
