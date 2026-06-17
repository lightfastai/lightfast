/**
 * App router — product-shaped grouping of tRPC procedures.
 *
 * Auth, org setup, and permission gates live in procedure builders. Public
 * router paths stay small and product-oriented:
 * - `org.setup`: active org setup surface, binding optional.
 * - `org.settings`: active org settings surface, binding optional.
 * - `org.workspace`: bound-org product surface.
 */

import { nativeAuthRouter } from "./router/(pending-allowed)/native-auth";
import { automationsRouter } from "./router/(pending-not-allowed)/automations";
import { connectorsRouter } from "./router/(pending-not-allowed)/connectors";
import { developerConnectionsRouter } from "./router/(pending-not-allowed)/developer-connections";
import { githubSetupRouter } from "./router/(pending-not-allowed)/github-setup";
import { orgBillingRouter } from "./router/(pending-not-allowed)/org-billing";
import { orgIdentityRouter } from "./router/(pending-not-allowed)/org-identity";
import { orgMembersRouter } from "./router/(pending-not-allowed)/org-members";
import { orgSourceControlRouter } from "./router/(pending-not-allowed)/org-source-control";
import { taskRouter } from "./router/(pending-not-allowed)/task";
import { workspaceEntityGraphRouter } from "./router/(pending-not-allowed)/workspace-entity-graph";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  native: createTRPCRouter({
    auth: nativeAuthRouter,
  }),
  org: createTRPCRouter({
    setup: createTRPCRouter({
      github: githubSetupRouter,
      task: taskRouter,
    }),
    settings: createTRPCRouter({
      orgBilling: orgBillingRouter,
      identity: orgIdentityRouter,
      orgMembers: orgMembersRouter,
      sourceControl: orgSourceControlRouter,
    }),
    workspace: createTRPCRouter({
      automations: automationsRouter,
      connectors: connectorsRouter,
      developerConnections: developerConnectionsRouter,
      entityGraph: workspaceEntityGraphRouter,
    }),
  }),
});

export type AppRouter = typeof appRouter;
