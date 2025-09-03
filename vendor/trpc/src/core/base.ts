/**
 * Core TRPC utilities for Lightfast infrastructure
 * Provides base setup that can be used by any app
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

/**
 * Base context that all TRPC contexts should extend
 */
export interface BaseContext {
  headers: Headers;
}

/**
 * Create base TRPC instance with shared configuration
 */
export function createTRPCBase<TContext extends BaseContext = BaseContext>() {
  return initTRPC.context<TContext>().create({
    transformer: superjson,
    errorFormatter: ({ shape, error }) => ({
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }),
  });
}

/**
 * Create timing middleware for development
 */
export function createTimingMiddleware<TContext extends BaseContext>(
  t: ReturnType<typeof createTRPCBase<TContext>>
) {
  return t.middleware(async ({ next, path }) => {
    const start = Date.now();

    // Check if we're in development mode (simple check)
    if (process.env.NODE_ENV === 'development') {
      // artificial delay in dev 100-500ms
      const waitMs = Math.floor(Math.random() * 400) + 100;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    const result = await next();

    const end = Date.now();
    console.info(`[TRPC] ${path} took ${end - start}ms to execute`);

    return result;
  });
}

/**
 * Create auth middleware that requires a session
 */
export function createAuthMiddleware<TContext extends BaseContext & { session: any }>(
  t: ReturnType<typeof createTRPCBase<TContext>>
) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session?.userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        // infers the `session` as non-nullable
        session: ctx.session,
      },
    });
  });
}

/**
 * Export commonly used TRPC utilities
 */
export { TRPCError } from "@trpc/server";
export type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";