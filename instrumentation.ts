export async function register() {
  // Next compiles this entry for both Node and Edge, including in next dev.
  // Keep every Node-only dependency behind a statically removable import.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNodeRuntime } = await import("./lib/brain/startup");
    registerNodeRuntime();
  }
}
