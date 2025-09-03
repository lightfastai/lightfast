/**
 * Cloud application TRPC setup
 */

import { createTRPCBase, createTimingMiddleware, TRPCError } from "@vendor/trpc/core";
import type { CloudContext } from "./context";

// Create TRPC instance with cloud context
const t = createTRPCBase<CloudContext>();

// Create router
export const createTRPCRouter = t.router;

// Create caller factory
export const createCallerFactory = t.createCallerFactory;

// Middleware
const timingMiddleware = createTimingMiddleware(t);

// Public procedure
export const publicProcedure = t.procedure.use(timingMiddleware);

// Protected procedure (requires authentication)
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        session: ctx.session,
      },
    });
  });

// Re-export for convenience
export { TRPCError } from "@vendor/trpc/core";
export { createCloudContext } from "./context";