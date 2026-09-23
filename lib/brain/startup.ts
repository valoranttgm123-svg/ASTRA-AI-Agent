import { getAutomationService, startAutomationServiceIfEnabled } from "../automation/service";
import { attachAutomationLifecycleEventBridge } from "../events/automation-lifecycle";
import { preloadOllamaModel } from "./ollama";

let ollamaPreloadStarted = false;

async function preloadOllamaAfterStartup() {
  if (ollamaPreloadStarted) return;
  ollamaPreloadStarted = true;

  // Windows starts both tasks concurrently. Preserve the bounded, background
  // preload; model availability must never prevent the UI from starting.
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      if (await preloadOllamaModel()) return;
    } catch {
      // The loopback service may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export function registerNodeRuntime() {
  attachAutomationLifecycleEventBridge(getAutomationService());
  startAutomationServiceIfEnabled();
  void preloadOllamaAfterStartup();
}
