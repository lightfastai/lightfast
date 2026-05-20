/**
 * App router — gate-based grouping of tRPC procedures.
 *
 * Sub-routers are nested by the auth admission rule they enforce, *not* by
 * the operation's target:
 * - `pendingAllowed`:    admits identity `pending` OR `active`.
 *                        Onboarding-safe surface.
 * - `pendingNotAllowed`: requires identity `active`. Procedures inside refine
 *                        further by binding status: `setupProcedure` stays
 *                        reachable before an org is bound (`task`), while
 *                        `boundOrgProcedure` requires a bound org (`orgApiKeys`).
 *
 * Naming the boundary by the gate lets us add procedures without renaming
 * the grouping when an operation's target evolves.
 */

import { accountRouter } from "./router/(pending-allowed)/account";
import { organizationRouter } from "./router/(pending-allowed)/organization";
import { orgApiKeysRouter } from "./router/(pending-not-allowed)/org-api-keys";
import { taskRouter } from "./router/(pending-not-allowed)/task";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  pendingAllowed: createTRPCRouter({
    organization: organizationRouter,
    account: accountRouter,
  }),
  pendingNotAllowed: createTRPCRouter({
    orgApiKeys: orgApiKeysRouter,
    task: taskRouter,
  }),
});

export type AppRouter = typeof appRouter;
