import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = { requestId: string } & Record<string, unknown>;

export const requestStore = new AsyncLocalStorage<RequestContext>();

export function getContext(): Record<string, unknown> {
  return requestStore.getStore() ?? {};
}

/**
 * Merge additional fields into the current request context.
 * Useful for downstream middleware (e.g. auth) to enrich ALS context
 * after the observability middleware has already seeded it.
 */
export function enrichContext(fields: Record<string, unknown>): void {
  const store = requestStore.getStore();
  if (store) {
    Object.assign(store, fields);
  }
}
