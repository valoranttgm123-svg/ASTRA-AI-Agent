import type { AstraHealthProbe } from "./contracts";
import { runHealthSnapshot } from "./health";

const probes = new Map<string, AstraHealthProbe>();

export function registerHealthProbe(probe: AstraHealthProbe) {
  const key = probe.id.trim().toLowerCase();
  if (!key) throw new Error("Health probe id is required.");
  if (probes.has(key)) {
    throw new Error("Health probe is already registered: " + probe.id + ".");
  }
  probes.set(key, probe);
  return () => {
    if (probes.get(key) === probe) probes.delete(key);
  };
}

export function listHealthProbes() {
  return [...probes.values()];
}

export async function runRegisteredHealthSnapshot(options?: {
  timeoutMs?: number;
  signal?: AbortSignal;
  now?: Date;
}) {
  return runHealthSnapshot({
    probes: listHealthProbes(),
    ...options,
  });
}

export function clearHealthProbesForTests() {
  probes.clear();
}
