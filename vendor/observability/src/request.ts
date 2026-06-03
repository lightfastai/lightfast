import "server-only";

import type { RequestContext } from "./context";
import { requestStore } from "./context";

interface RequestResult<T> {
  ctx: RequestContext;
  durationMs: number;
  result: T;
}

/**
 * Run an async function within a request context scope.
 * All `log` calls inside `fn` automatically get context enrichment.
 */
export async function withRequestContext<T>(
  ctx: RequestContext,
  fn: () => Promise<T>
): Promise<RequestResult<T>> {
  const store = { ...ctx };
  const start = Date.now();
  const result = await requestStore.run(store, fn);
  const durationMs = Date.now() - start;
  return { result, durationMs, ctx: store };
}
