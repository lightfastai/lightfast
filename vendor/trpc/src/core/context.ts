/**
 * Base context utilities for TRPC
 */

import type { BaseContext } from "./base";

/**
 * Create base context with headers
 * This can be extended by app-specific contexts
 */
export async function createBaseContext(opts: {
  headers: Headers;
}): Promise<BaseContext> {
  return {
    headers: opts.headers,
  };
}

/**
 * Type helper for extending contexts
 */
export type ExtendContext<TBase extends BaseContext, TExtension> = TBase & TExtension;