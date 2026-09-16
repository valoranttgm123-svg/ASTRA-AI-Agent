# ASTRA Live Humanoid visibility fix

This patch makes the live avatar the primary central visual instead of the legacy orb.

Changes:
- The live humanoid layer now sits above the legacy APEX core.
- A dark central visual well masks the old orb and clears the reasoning graph away from the face/body.
- The live rig is larger and the camera is closer.
- Head, neck and shoulders use brighter emissive/translucent materials.
- Particle and halo opacity are increased so motion remains readable in idle/thinking/speaking states.

This is still a placeholder rig. The production visual target is a rigged GLB/VRM humanoid driven by the same ASTRA avatar state controller.
