export type AstraTaskAbortAction = "pause" | "cancel" | "global_stop";

export class AstraTaskAbortError extends Error {
  constructor(public readonly action: AstraTaskAbortAction) {
    super(
      action === "cancel"
        ? "Background task cancelled."
        : action === "pause"
          ? "Background task paused."
          : "Background task stopped by global STOP.",
    );
    this.name = "AbortError";
  }
}

const activeTasks = new Map<string, AbortController>();

function key(id: string) {
  return id.trim().toLowerCase();
}

export function registerActiveTask(
  id: string,
  controller: AbortController,
) {
  const normalized = key(id);
  if (activeTasks.has(normalized)) {
    throw new Error("Background task is already active in this process.");
  }
  activeTasks.set(normalized, controller);
  return () => {
    if (activeTasks.get(normalized) === controller) {
      activeTasks.delete(normalized);
    }
  };
}

export function isTaskActive(id: string) {
  return activeTasks.has(key(id));
}

export function stopActiveTask(
  id: string,
  action: AstraTaskAbortAction,
) {
  const controller = activeTasks.get(key(id));
  if (!controller) return false;
  if (!controller.signal.aborted) {
    controller.abort(new AstraTaskAbortError(action));
  }
  return true;
}

export function activeTaskIds() {
  return [...activeTasks.keys()];
}
