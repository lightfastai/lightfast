/**
 * App router — all tRPC procedures under a single router
 *
 * Auth boundaries enforced at the procedure level:
 * - userScopedProcedure: clerk-pending | clerk-active (onboarding)
 * - orgScopedProcedure: clerk-active only (org operations)
 */

import { orgApiKeysRouter } from "./router/org/org-api-keys";
import { accountRouter } from "./router/user/account";
import { organizationRouter } from "./router/user/organization";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  // User-scoped (clerk-pending | clerk-active)
  organization: organizationRouter,
  account: accountRouter,
  // Org-scoped (clerk-active only)
  orgApiKeys: orgApiKeysRouter,
});

export type AppRouter = typeof appRouter;
