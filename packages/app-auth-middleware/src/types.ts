/**
 * Type definitions for Console authorization middleware
 *
 * This module provides TypeScript types and interfaces for:
 * - Workspace access verification
 * - Resource ownership validation
 * - Tenant isolation
 */

import type { db } from "@db/app/client";

/**
 * Database client type (extracted from @db/app)
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
  db: DbClient;
  resourceId: string;
  resourceType: ResourceType;
  userId: string;
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
