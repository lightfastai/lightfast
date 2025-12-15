/**
 * Console application root router
 * This is the main router that combines all console-specific routers
 *
 * Split into three routers for authentication boundary:
 * - userRouter: Procedures that allow pending users (no org required)
 * - orgRouter: Procedures that require active org membership
 * - m2mRouter: Machine-to-machine procedures for internal services (Inngest, webhooks)
 */

import { createTRPCRouter } from "./trpc";

// User-scoped routers (no org required)
import { organizationRouter } from "./router/user/organization";
import { accountRouter } from "./router/user/account";
import { workspaceAccessRouter } from "./router/user/workspace";
import { userApiKeysRouter } from "./router/user/user-api-keys";
import { userSourcesRouter } from "./router/user/user-sources";

// Org-scoped routers (active org required)
import { searchRouter } from "./router/org/search";
import { contentsRouter } from "./router/org/contents";
import { clerkRouter } from "./router/org/clerk";
import { workspaceRouter } from "./router/org/workspace";
import { integrationRouter } from "./router/org/integration";
import { jobsRouter } from "./router/org/jobs";
import { sourcesRouter } from "./router/org/sources";
import { activitiesRouter } from "./router/org/activities";
import { workspaceApiKeysRouter } from "./router/org/workspace-api-keys";

// M2M routers (internal services only)
import { jobsM2MRouter } from "./router/m2m/jobs";
import { sourcesM2MRouter } from "./router/m2m/sources";
import { workspaceM2MRouter } from "./router/m2m/workspace";

/**
 * User-scoped router
 * Allows both pending users (no org) and active users (has org)
 * Accessible via /api/trpc/user/*
 *
 * Procedures:
 * - organization.*: Create/list/update organizations
 * - account.*: User profile from Clerk
 * - userApiKeys.*: API key management (lightfast_user_api_keys table)
 * - userSources.*: OAuth integrations (lightfast_user_sources table)
 * - workspaceAccess.*: Workspace queries that verify access manually (listByClerkOrgSlug)
 */
export const userRouter = createTRPCRouter({
  organization: organizationRouter,
  account: accountRouter,
  userApiKeys: userApiKeysRouter,
  userSources: userSourcesRouter,
  workspaceAccess: workspaceAccessRouter,
});

/**
 * Org-scoped router
 * Requires active org membership (pending users blocked)
 * Accessible via /api/trpc/org/*
 *
 * Procedures:
 * - workspace.*: Workspace management (includes workspace.store.get for single store)
 * - integration.*: Integration connections (GitHub, etc.)
 * - jobs.*: Background job management
 * - sources.*: Source management
 * - clerk.*: Clerk organization utilities
 * - search.*: Semantic search
 * - contents.*: Document retrieval
 * - activities.*: Activity logging
 */
export const orgRouter = createTRPCRouter({
  // Phase 1.3: Docs search
  search: searchRouter,
  contents: contentsRouter,

  // Org-level routers
  clerk: clerkRouter,
  workspace: workspaceRouter,
  integration: integrationRouter,
  jobs: jobsRouter,
  sources: sourcesRouter,
  activities: activitiesRouter,
  workspaceApiKeys: workspaceApiKeysRouter,
});

/**
 * M2M router
 * Machine-to-machine procedures for internal services only
 * Accessible via /api/trpc/m2m/*
 *
 * Security:
 * - Inngest procedures: Require Inngest M2M token (CLERK_M2M_INNGEST_CLIENT_ID)
 * - Webhook procedures: Require webhook M2M token (CLERK_M2M_WEBHOOK_CLIENT_ID)
 *
 * Procedures:
 * - jobs.*: Job lifecycle management for Inngest workflows
 * - sources.*: Source management for GitHub webhooks
 * - workspace.*: Workspace queries for Inngest workflows
 */
export const m2mRouter = createTRPCRouter({
  jobs: jobsM2MRouter,
  sources: sourcesM2MRouter,
  workspace: workspaceM2MRouter,
});

// Export types for client usage
export type UserRouter = typeof userRouter;
export type OrgRouter = typeof orgRouter;
export type M2MRouter = typeof m2mRouter;
