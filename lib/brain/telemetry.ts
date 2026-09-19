import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import type { AstraBrainEvent } from "./types";

type BrainEventSink = (event: AstraBrainEvent) => void;

const brainEventStorage = new AsyncLocalStorage<BrainEventSink>();

export function withBrainEventSink<T>(
  sink: BrainEventSink,
  task: () => Promise<T>,
): Promise<T> {
  return brainEventStorage.run(sink, task);
}

export function emitBrainEvent(event: AstraBrainEvent) {
  brainEventStorage.getStore()?.(event);
}

export function emitBrainEvents(events: AstraBrainEvent[]) {
  const sink = brainEventStorage.getStore();
  if (!sink) return;
  for (const event of events) sink(event);
}
