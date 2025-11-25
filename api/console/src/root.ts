/**
 * Console application root router
 * This is the main router that combines all console-specific routers
 *
 * Split into two routers for authentication boundary:
 * - userRouter: Procedures that allow pending users (no org required)
 * - orgRouter: Procedures that require active org membership
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
import { storesRouter } from "./router/org/stores";
import { clerkRouter } from "./router/org/clerk";
import { workspaceRouter } from "./router/org/workspace";
import { integrationRouter } from "./router/org/integration";
import { jobsRouter } from "./router/org/jobs";
import { sourcesRouter } from "./router/org/sources";

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
 * - workspace.*: Workspace management
 * - integration.*: Integration connections (GitHub, etc.)
 * - stores.*: Vector store management
 * - jobs.*: Background job management
 * - sources.*: Data source management
 * - clerk.*: Clerk organization utilities
 * - search.*: Semantic search
 * - contents.*: Document retrieval
 */
export const orgRouter = createTRPCRouter({
  // Phase 1.3: Docs search
  search: searchRouter,
  contents: contentsRouter,

  // Phase 1.6: Stores, Clerk integration, and Workspaces
  stores: storesRouter,
  clerk: clerkRouter,
  workspace: workspaceRouter,
  integration: integrationRouter,
  jobs: jobsRouter,
  sources: sourcesRouter,
});

// Export types for client usage
export type UserRouter = typeof userRouter;
export type OrgRouter = typeof orgRouter;
