import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = { requestId: string } & Record<string, unknown>;

export const requestStore = new AsyncLocalStorage<RequestContext>();

export function getContext(): Record<string, unknown> {
  return requestStore.getStore() ?? {};
}
