/**
 * App router — gate-based grouping of tRPC procedures.
 *
 * Sub-routers are nested by the auth admission rule they enforce, *not* by
 * the operation's target:
 * - `pendingAllowed`: composed of `pendingAllowedProcedure` — admits both
 *   `clerk-pending` and `clerk-active` sessions (onboarding-safe surface).
 * - `pendingNotAllowed`: composed of `pendingNotAllowedProcedure` — admits
 *   only `clerk-active` (requires a claimed organization).
 *
 * Naming the boundary by the gate lets us add procedures without renaming
 * the grouping when an operation's target evolves.
 */

import { accountRouter } from "./router/(pending-allowed)/account";
import { organizationRouter } from "./router/(pending-allowed)/organization";
import { orgApiKeysRouter } from "./router/(pending-not-allowed)/org-api-keys";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  pendingAllowed: createTRPCRouter({
    organization: organizationRouter,
    account: accountRouter,
  }),
  pendingNotAllowed: createTRPCRouter({
    orgApiKeys: orgApiKeysRouter,
  }),
});

export type AppRouter = typeof appRouter;
