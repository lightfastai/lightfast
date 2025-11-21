/**
 * Type definitions for Console authorization middleware
 *
 * This module provides TypeScript types and interfaces for:
 * - Workspace access verification
 * - Resource ownership validation
 * - Tenant isolation
 */

import type { db } from "@db/console/client";

/**
 * Database client type (extracted from @db/console)
 * This allows dependency injection without importing the actual client
 */
export type DbClient = typeof db;

/**
 * Supported resource types for ownership verification
 */
export type ResourceType = "integration" | "apiKey" | "repository";

/**
 * tRPC error codes used in authorization failures
 */
export type AuthErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "INTERNAL_SERVER_ERROR"
  | "BAD_REQUEST";

/**
 * User role within a Clerk organization
 * Maps to Clerk's org:role system
 */
export type UserRole = "org:admin" | "org:member";

// ============================================================================
// Workspace Access Types
// ============================================================================

/**
 * Context required for workspace access verification
 *
 * @property userId - Clerk user ID performing the action
 * @property clerkOrgSlug - Organization slug from URL (e.g., "acme-corp")
 * @property workspaceName - Workspace name from URL (e.g., "my-project")
 * @property db - Database client instance (dependency injection)
 */
export interface WorkspaceAccessContext {
  userId: string;
  clerkOrgSlug: string;
  workspaceName: string;
  db: DbClient;
}

/**
 * Data returned after successful workspace access verification
 *
 * @property workspaceId - Unique workspace identifier (nanoid)
 * @property workspaceName - User-facing workspace name (used in URLs)
 * @property workspaceSlug - Internal workspace slug (used for Pinecone)
 * @property clerkOrgId - Clerk organization ID
 * @property userRole - User's role in the organization
 */
export interface WorkspaceAccessData {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  clerkOrgId: string;
  userRole: string;
}

/**
 * Result of workspace access verification
 *
 * Success:
 * ```typescript
 * { success: true, data: { workspaceId, clerkOrgId, ... } }
 * ```
 *
 * Failure:
 * ```typescript
 * { success: false, error: "message", errorCode: "NOT_FOUND" }
 * ```
 */
export type WorkspaceAccessResult =
  | {
      success: true;
      data: WorkspaceAccessData;
    }
  | {
      success: false;
      error: string;
      errorCode: AuthErrorCode;
    };

// ============================================================================
// Workspace Resolution Types
// ============================================================================

/**
 * Context for resolving workspace by user-facing name
 *
 * @property clerkOrgSlug - Organization slug from URL
 * @property workspaceName - Workspace name from URL (user-provided)
 * @property userId - User performing the action
 * @property db - Database client instance
 */
export interface ResolveWorkspaceByNameContext {
  clerkOrgSlug: string;
  workspaceName: string;
  userId: string;
  db: DbClient;
}

/**
 * Context for resolving workspace by internal slug
 *
 * ⚠️ INTERNAL USE ONLY - Use resolveWorkspaceByName for user-facing routes
 *
 * @property clerkOrgSlug - Organization slug from URL
 * @property workspaceSlug - Internal workspace slug (e.g., "robust-chicken")
 * @property userId - User performing the action
 * @property db - Database client instance
 */
export interface ResolveWorkspaceBySlugContext {
  clerkOrgSlug: string;
  workspaceSlug: string;
  userId: string;
  db: DbClient;
}

/**
 * Data returned after successful workspace resolution
 *
 * @property workspaceId - Unique workspace identifier
 * @property workspaceName - User-facing workspace name
 * @property workspaceSlug - Internal workspace slug
 * @property clerkOrgId - Clerk organization ID
 */
export interface ResolveWorkspaceData {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  clerkOrgId: string;
}

/**
 * Result of workspace resolution
 */
export type ResolveWorkspaceResult =
  | {
      success: true;
      data: ResolveWorkspaceData;
    }
  | {
      success: false;
      error: string;
      errorCode: AuthErrorCode;
    };

// ============================================================================
// Resource Ownership Types
// ============================================================================

/**
 * Context for resource ownership verification
 *
 * @property userId - Clerk user ID to check ownership
 * @property resourceId - ID of the resource to verify
 * @property resourceType - Type of resource (integration, apiKey, repository)
 * @property db - Database client instance
 */
export interface ResourceOwnershipContext {
  userId: string;
  resourceId: string;
  resourceType: ResourceType;
  db: DbClient;
}

/**
 * Data returned after successful resource ownership verification
 *
 * @property authorized - Whether user owns the resource
 * @property resource - The resource object (if found and authorized)
 */
export interface ResourceOwnershipData {
  authorized: boolean;
  resource?: unknown; // Type varies by resourceType
}

/**
 * Result of resource ownership verification
 */
export type ResourceOwnershipResult =
  | {
      success: true;
      data: ResourceOwnershipData;
    }
  | {
      success: false;
      error: string;
      errorCode: AuthErrorCode;
    };

// ============================================================================
// Tenant Isolation Types
// ============================================================================

/**
 * Tenant filter for Drizzle queries
 *
 * Use with eq() in where clauses to enforce tenant isolation:
 * ```typescript
 * const filter = createTenantFilter(clerkOrgId);
 * const workspaces = await db
 *   .select()
 *   .from(workspaces)
 *   .where(eq(workspaces.clerkOrgId, filter.clerkOrgId));
 * ```
 */
export interface TenantFilter {
  clerkOrgId: string;
}

// ============================================================================
// Organization Access Types
// ============================================================================

/**
 * Context for organization access verification
 *
 * @property clerkOrgSlug - Organization slug from URL
 * @property userId - User performing the action
 */
export interface OrgAccessContext {
  clerkOrgSlug: string;
  userId: string;
}

/**
 * Data returned after successful organization access verification
 *
 * @property clerkOrgId - Clerk organization ID
 * @property clerkOrgSlug - Organization slug
 */
export interface OrgAccessData {
  clerkOrgId: string;
  clerkOrgSlug: string;
}

/**
 * Result of organization access verification
 */
export type OrgAccessResult =
  | {
      success: true;
      data: OrgAccessData;
    }
  | {
      success: false;
      error: string;
      errorCode: AuthErrorCode;
    };
