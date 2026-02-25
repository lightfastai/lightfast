import { createActor } from "xstate";
import { backfillMachine } from "./backfill-machine";
import type { BackfillEvent, BackfillContext } from "./backfill-machine";

/**
 * Ephemeral state transition — creates an actor, sends the event, returns the
 * persisted snapshot, and stops the actor. Used inside Inngest step.run() calls
 * to avoid doubling step count (XState for state tracking only, not as steps).
 */
export function transitionMachine(
  snapshot: Parameters<typeof createActor>[1],
  event: BackfillEvent,
): ReturnType<ReturnType<typeof createActor>["getPersistedSnapshot"]> {
  const actor = createActor(backfillMachine, snapshot).start();
  actor.send(event);
  const next = actor.getPersistedSnapshot();
  actor.stop();
  return next;
}

/**
 * Read context from a persisted snapshot without modifying it.
 */
export function readContext(
  snapshot: Parameters<typeof createActor>[1],
): BackfillContext {
  const actor = createActor(backfillMachine, snapshot).start();
  const { context } = actor.getSnapshot();
  actor.stop();
  return context;
}
