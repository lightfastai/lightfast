/**
 * App router — all tRPC procedures under a single router
 *
 * Auth boundaries enforced at the procedure level:
 * - userScopedProcedure: clerk-pending | clerk-active (onboarding)
 * - orgScopedProcedure: clerk-active only (org operations)
 */

import { connectionsRouter } from "./router/org/connections";
import { jobsRouter } from "./router/org/jobs";
import { orgApiKeysRouter } from "./router/org/org-api-keys";
import { workspaceRouter } from "./router/org/workspace";
import { accountRouter } from "./router/user/account";
import { organizationRouter } from "./router/user/organization";
import { workspaceAccessRouter } from "./router/user/workspace";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  // User-scoped (clerk-pending | clerk-active)
  organization: organizationRouter,
  account: accountRouter,
  workspaceAccess: workspaceAccessRouter,
  // Org-scoped (clerk-active only)
  workspace: workspaceRouter,
  connections: connectionsRouter,
  jobs: jobsRouter,
  orgApiKeys: orgApiKeysRouter,
});

export type AppRouter = typeof appRouter;

