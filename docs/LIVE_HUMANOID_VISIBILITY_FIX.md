# ASTRA Live Humanoid visibility fix

This patch makes the live avatar the primary central visual instead of the legacy orb.

Changes:
- Legacy orb is demoted from the visual center and kept only as an invisible interaction target.
- The reasoning graph receives a central dark clear-zone so it does not visually cut through the face/body.
- Live humanoid camera is moved closer and the rig is scaled up.
- Head, neck and shoulders use brighter emissive/translucent materials so the avatar remains readable on the dark ASTRA background.
- Runtime state is used for the world activity state, avoiding a separate legacy orb animation state.
