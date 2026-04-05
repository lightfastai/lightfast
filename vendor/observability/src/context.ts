import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

const MAX_JOURNAL_ENTRIES = 50;

// -- Identity (read-only after creation) --------------------------------------
// Open record: vendor enforces only `requestId`; apps pass whatever they need.

export type RequestContext = { requestId: string } & Record<string, unknown>;

// -- Journal (append-only accumulation) ---------------------------------------

export interface JournalEntry {
  level: "info" | "warn" | "error" | "debug";
  meta?: Record<string, unknown>;
  msg: string;
  ts: number;
}

// -- Composite store ----------------------------------------------------------

export interface RequestStore {
  ctx: RequestContext;
  journal: JournalEntry[];
}

export const requestStore = new AsyncLocalStorage<RequestStore>();

/** Type-safe store factory — eliminates `as` assertions at call sites. */
export function createStore(ctx: RequestContext): RequestStore {
  return { ctx, journal: [] };
}

export function getContext(): Record<string, unknown> {
  return requestStore.getStore()?.ctx ?? {};
}

export function getJournal(): readonly JournalEntry[] {
  return requestStore.getStore()?.journal ?? [];
}

export function pushJournal(
  level: JournalEntry["level"],
  msg: string,
  meta?: Record<string, unknown>
): void {
  const store = requestStore.getStore();
  if (!store || store.journal.length >= MAX_JOURNAL_ENTRIES) {
    return;
  }
  store.journal.push({ ts: Date.now(), level, msg, meta });
}
