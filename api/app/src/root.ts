/**
 * App router — all tRPC procedures under a single router
 *
 * Auth boundaries enforced at the procedure level:
 * - userScopedProcedure: clerk-pending | clerk-active (onboarding)
 * - orgScopedProcedure: clerk-active only (org operations)
 */

import { connectionsRouter } from "./router/org/connections";
import { entitiesRouter } from "./router/org/entities";
import { eventsRouter } from "./router/org/events";
import { jobsRouter } from "./router/org/jobs";
import { orgApiKeysRouter } from "./router/org/org-api-keys";
import { accountRouter } from "./router/user/account";
import { organizationRouter } from "./router/user/organization";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  // User-scoped (clerk-pending | clerk-active)
  organization: organizationRouter,
  account: accountRouter,
  // Org-scoped (clerk-active only)
  connections: connectionsRouter,
  entities: entitiesRouter,
  events: eventsRouter,
  jobs: jobsRouter,
  orgApiKeys: orgApiKeysRouter,
});

export type AppRouter = typeof appRouter;
