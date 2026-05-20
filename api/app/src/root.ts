/**
 * App router — gate-based grouping of tRPC procedures.
 *
 * Sub-routers are nested by the auth admission rule they enforce, *not* by
 * the operation's target:
 * - `pendingAllowed`:    admits identity `pending` OR `active`.
 *                        Onboarding-safe surface.
 * - `pendingNotAllowed`: requires identity `active`. Settings/setup surfaces
 *                        that must stay reachable before binding live here;
 *                        bound-only product procedures opt into
 *                        `boundOrgProcedure`.
 *
 * Naming the boundary by the gate lets us add procedures without renaming
 * the grouping when an operation's target evolves.
 */

import { accountRouter } from "./router/(pending-allowed)/account";
import { organizationRouter } from "./router/(pending-allowed)/organization";
import { orgApiKeysRouter } from "./router/(pending-not-allowed)/org-api-keys";
import { orgBillingRouter } from "./router/(pending-not-allowed)/org-billing";
import { orgMembersRouter } from "./router/(pending-not-allowed)/org-members";
import { taskRouter } from "./router/(pending-not-allowed)/task";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  pendingAllowed: createTRPCRouter({
    organization: organizationRouter,
    account: accountRouter,
  }),
  pendingNotAllowed: createTRPCRouter({
    orgApiKeys: orgApiKeysRouter,
    orgBilling: orgBillingRouter,
    orgMembers: orgMembersRouter,
    task: taskRouter,
  }),
});

export type AppRouter = typeof appRouter;
