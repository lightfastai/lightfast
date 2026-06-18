/**
 * App router — product-shaped grouping of tRPC procedures.
 *
 * Auth, org setup, and permission gates live in procedure builders. Public
 * router paths stay small and product-oriented:
 * - `org.setup`: active org setup surface, binding optional.
 * - `org.settings`: active org settings surface, binding optional.
 * - `org.workspace`: bound-org product surface.
 */

import { taskRouter } from "./router/(pending-not-allowed)/task";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  org: createTRPCRouter({
    setup: createTRPCRouter({
      task: taskRouter,
    }),
  }),
});

export type AppRouter = typeof appRouter;
