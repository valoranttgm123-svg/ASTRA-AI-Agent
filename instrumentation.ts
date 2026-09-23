let ollamaPreloadStarted = false;

async function preloadOllamaAfterStartup() {
  if (ollamaPreloadStarted) return;
  ollamaPreloadStarted = true;

  const { preloadOllamaModel } = await import("./lib/brain/ollama");

  // ASTRA-Agent and ASTRA-Ollama start concurrently on Windows. Give the
  // loopback Ollama service a bounded chance to come online, then load the
  // selected model in the background so the UI does not wait on a cold model.
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      if (await preloadOllamaModel()) return;
    } catch {
      // Ollama may still be starting. Retry without making ASTRA startup fail.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const {
    getAutomationService,
    startAutomationServiceIfEnabled,
  } = await import("./lib/automation/service");
  const { attachAutomationLifecycleEventBridge } = await import(
    "./lib/events/automation-lifecycle"
  );

  attachAutomationLifecycleEventBridge(getAutomationService());
  startAutomationServiceIfEnabled();

  void preloadOllamaAfterStartup();
}
