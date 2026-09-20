export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { startAutomationServiceIfEnabled } = await import(
    "./lib/automation/service"
  );
  startAutomationServiceIfEnabled();
}
