/**
 * App router — product-shaped grouping of tRPC procedures.
 *
 * Auth, org setup, and permission gates live in procedure builders. Public
 * router paths stay small and product-oriented:
 * - `viewer`: signed-in user surface, active org optional.
 * - `org.setup`: active org setup surface, binding optional.
 * - `org.settings`: active org settings surface, binding optional.
 * - `org.workspace`: bound-org product surface.
 */

import { accountRouter } from "./router/(pending-allowed)/account";
import { githubAccountRouter } from "./router/(pending-allowed)/github-account";
import { nativeAuthRouter } from "./router/(pending-allowed)/native-auth";
import {
  organizationRouter,
  orgSettingsOrganizationRouter,
} from "./router/(pending-allowed)/organization";
import { automationsRouter } from "./router/(pending-not-allowed)/automations";
import { githubSetupRouter } from "./router/(pending-not-allowed)/github-setup";
import { orgApiKeysRouter } from "./router/(pending-not-allowed)/org-api-keys";
import { orgBillingRouter } from "./router/(pending-not-allowed)/org-billing";
import { orgMembersRouter } from "./router/(pending-not-allowed)/org-members";
import { orgSourceControlRouter } from "./router/(pending-not-allowed)/org-source-control";
import { taskRouter } from "./router/(pending-not-allowed)/task";
import { workspacePeopleRouter } from "./router/(pending-not-allowed)/workspace-people";
import { workspaceSignalsRouter } from "./router/(pending-not-allowed)/workspace-signals";
import { workspaceSkillsRouter } from "./router/(pending-not-allowed)/workspace-skills";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  native: createTRPCRouter({
    auth: nativeAuthRouter,
  }),
  viewer: createTRPCRouter({
    organization: organizationRouter,
    account: accountRouter,
    githubAccount: githubAccountRouter,
  }),
  org: createTRPCRouter({
    setup: createTRPCRouter({
      github: githubSetupRouter,
      task: taskRouter,
    }),
    settings: createTRPCRouter({
      organization: orgSettingsOrganizationRouter,
      orgApiKeys: orgApiKeysRouter,
      orgBilling: orgBillingRouter,
      orgMembers: orgMembersRouter,
      sourceControl: orgSourceControlRouter,
    }),
    workspace: createTRPCRouter({
      automations: automationsRouter,
      people: workspacePeopleRouter,
      skills: workspaceSkillsRouter,
      signals: workspaceSignalsRouter,
    }),
  }),
});

export type AppRouter = typeof appRouter;
