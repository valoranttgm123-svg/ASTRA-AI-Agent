/** Probe once before mounting R3F: its async renderer initialization can reject
 * outside a React error boundary when a browser denies WebGL contexts. */
export function probeWebGL2(createCanvas: () => HTMLCanvasElement): boolean {
  try {
    const context = createCanvas().getContext("webgl2");
    if (!context) return false;
    const available = !context.isContextLost();
    // The probe is not a renderer. Release its context before the real scene
    // mounts; never retain an extra GPU allocation for each visual component.
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return available;
  } catch {
    return false;
  }
}
