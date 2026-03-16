/**
 * Console application root router
 * This is the main router that combines all console-specific routers
 *
 * Split into three routers for authentication boundary:
 * - userRouter: Procedures that allow pending users (no org required)
 * - orgRouter: Procedures that require active org membership
 * - m2mRouter: Machine-to-machine procedures for internal services (Inngest, webhooks)
 */

// M2M routers (internal services only)
import { jobsM2MRouter } from "./router/m2m/jobs";
import { sourcesM2MRouter } from "./router/m2m/sources";
import { workspaceM2MRouter } from "./router/m2m/workspace";
import { connectionsRouter } from "./router/org/connections";
import { jobsRouter } from "./router/org/jobs";
import { orgApiKeysRouter } from "./router/org/org-api-keys";
// Org-scoped routers (active org required)
import { workspaceRouter } from "./router/org/workspace";
import { accountRouter } from "./router/user/account";
// User-scoped routers (no org required)
import { organizationRouter } from "./router/user/organization";
import { workspaceAccessRouter } from "./router/user/workspace";
import { createTRPCRouter } from "./trpc";

/**
 * User-scoped router
 * Allows both pending users (no org) and active users (has org)
 * Accessible via /api/trpc/user/*
 *
 * Procedures:
 * - organization.*: Create/list/update organizations
 * - account.*: User profile from Clerk
 * - workspaceAccess.*: Workspace queries that verify access manually (listByClerkOrgSlug)
 */
export const userRouter = createTRPCRouter({
  organization: organizationRouter,
  account: accountRouter,
  workspaceAccess: workspaceAccessRouter,
});

/**
 * Org-scoped router
 * Requires active org membership (pending users blocked)
 * Accessible via /api/trpc/org/*
 *
 * Procedures:
 * - workspace.*: Workspace management (includes workspace.store.get for single store)
 * - connections.*: OAuth connections (GitHub, Vercel, etc.) via gatewayInstallations
 * - jobs.*: Background job management
 * - orgApiKeys.*: Organization API key management
 */
export const orgRouter = createTRPCRouter({
  workspace: workspaceRouter,
  connections: connectionsRouter,
  jobs: jobsRouter,
  orgApiKeys: orgApiKeysRouter,
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
