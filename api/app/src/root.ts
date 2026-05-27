/**
 * App router — product-shaped grouping of tRPC procedures.
 *
 * Auth, org setup, and permission gates live in procedure builders. Public
 * router paths stay small and product-oriented:
 * - `viewer`: signed-in user surface, active org optional.
 * - `org.setup`: active org setup surface, binding optional.
 * - `org.settings`: active org settings surface, binding optional.
 * - `org.workspace`: future bound-org product surface.
 */

import { accountRouter } from "./router/(pending-allowed)/account";
import { nativeAuthRouter } from "./router/(pending-allowed)/native-auth";
import {
  organizationRouter,
  orgSettingsOrganizationRouter,
} from "./router/(pending-allowed)/organization";
import { orgApiKeysRouter } from "./router/(pending-not-allowed)/org-api-keys";
import { orgBillingRouter } from "./router/(pending-not-allowed)/org-billing";
import { orgMembersRouter } from "./router/(pending-not-allowed)/org-members";
import { taskRouter } from "./router/(pending-not-allowed)/task";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  native: createTRPCRouter({
    auth: nativeAuthRouter,
  }),
  viewer: createTRPCRouter({
    organization: organizationRouter,
    account: accountRouter,
  }),
  org: createTRPCRouter({
    setup: createTRPCRouter({
      task: taskRouter,
    }),
    settings: createTRPCRouter({
      organization: orgSettingsOrganizationRouter,
      orgApiKeys: orgApiKeysRouter,
      orgBilling: orgBillingRouter,
      orgMembers: orgMembersRouter,
    }),
    workspace: createTRPCRouter({}),
  }),
});

export type AppRouter = typeof appRouter;
