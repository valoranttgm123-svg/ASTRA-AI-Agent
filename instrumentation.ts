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
}
