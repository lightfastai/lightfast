import "server-only";

import type { JournalEntry, RequestContext } from "./context";
import { createStore, requestStore } from "./context";
import { log } from "./log/next";

interface RequestResult<T> {
  durationMs: number;
  journal: readonly JournalEntry[];
  result: T;
}

/**
 * Run an async function within a request context scope.
 * All `log` calls inside `fn` automatically get context enrichment and journal accumulation.
 */
export async function withRequestContext<T>(
  ctx: RequestContext,
  fn: () => Promise<T>
): Promise<RequestResult<T>> {
  const store = createStore(ctx);
  const start = Date.now();
  const result = await requestStore.run(store, fn);
  const durationMs = Date.now() - start;
  return { result, journal: store.journal, durationMs };
}

/**
 * Emit the request journal as a single structured log entry.
 * No-op if the journal is empty.
 */
export function emitJournal(
  journal: readonly JournalEntry[],
  meta: Record<string, unknown>
): void {
  if (journal.length === 0) {
    return;
  }
  log.info("[trpc] request journal", {
    ...meta,
    entryCount: journal.length,
    entries: journal,
  });
}
