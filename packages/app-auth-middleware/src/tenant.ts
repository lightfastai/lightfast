/**
 * Tenant Isolation Helpers
 *
 * This module provides helper functions for enforcing tenant isolation
 * in database queries. All functions ensure data is properly scoped to
 * the user's organization (Clerk org).
 *
 * Security principles:
 * 1. Always filter by clerkOrgId in multi-tenant queries
 * 2. Use these helpers to prevent cross-tenant data leakage
 * 3. Combine with org/resource ownership checks for full security
 *
 * @example
 * ```typescript
 * import { createTenantFilter } from "@repo/app-auth-middleware/tenant";
 * import { eq } from "drizzle-orm";
 *
 * const filter = createTenantFilter(clerkOrgId);
 *
 * const allIntegrations = await db
 *   .select()
 *   .from(orgIntegrations)
 *   .where(eq(orgIntegrations.clerkOrgId, filter.clerkOrgId));
 * ```
 */

import type { TenantFilter } from "./types";

/**
 * Create a tenant filter for Drizzle queries
 *
 * This creates a filter object that can be used with Drizzle's `eq()` function
 * to ensure queries are scoped to a specific organization.
 *
 * Use this helper to:
 * - Prevent cross-tenant data leakage
 * - Standardize tenant isolation across queries
 * - Make tenant filtering explicit and auditable
 *
 * @param clerkOrgId - Clerk organization ID to filter by
 * @returns Tenant filter object
 *
 * @example
 * ```typescript
 * import { createTenantFilter } from "@repo/app-auth-middleware/tenant";
 * import { eq, and } from "drizzle-orm";
 *
 * // In a tRPC procedure after verifying org access
 * const { clerkOrgId } = result.data;
 * const filter = createTenantFilter(clerkOrgId);
 *
 * // Query all integrations in this org
 * const integrations = await ctx.db
 *   .select()
 *   .from(orgIntegrations)
 *   .where(eq(orgIntegrations.clerkOrgId, filter.clerkOrgId));
 *
 * // Combine with other conditions
 * const activeIntegrations = await ctx.db
 *   .select()
 *   .from(orgIntegrations)
 *   .where(and(
 *     eq(orgIntegrations.clerkOrgId, filter.clerkOrgId),
 *     eq(orgIntegrations.clerkOrgId, true)
 *   ));
 * ```
 */
export function createTenantFilter(clerkOrgId: string): TenantFilter {
  return {
    clerkOrgId,
  };
}

/**
 * Validate tenant ID format
 *
 * Ensures the provided Clerk organization ID has the correct format.
 * Clerk org IDs typically start with "org_" followed by alphanumeric characters.
 *
 * @param clerkOrgId - Organization ID to validate
 * @returns True if valid, false otherwise
 *
 * @example
 * ```typescript
 * import { isValidTenantId } from "@repo/app-auth-middleware/tenant";
 *
 * if (!isValidTenantId(input.clerkOrgId)) {
 *   throw new TRPCError({
 *     code: "BAD_REQUEST",
 *     message: "Invalid organization ID format",
 *   });
 * }
 * ```
 */
export function isValidTenantId(clerkOrgId: string): boolean {
  // Clerk org IDs start with "org_" followed by alphanumeric
  return /^org_[a-zA-Z0-9]+$/.test(clerkOrgId);
}

/**
 * Extract tenant ID from a resource
 *
 * Convenience function to extract the clerkOrgId from a resource object.
 * This is useful when you have a resource and need to create a tenant filter.
 *
 * @param resource - Resource object with clerkOrgId
 * @returns Clerk organization ID
 *
 * @example
 * ```typescript
 * import { extractTenantId } from "@repo/app-auth-middleware/tenant";
 *
 * const integration = await db.query.orgIntegrations.findFirst({ ... });
 * const clerkOrgId = extractTenantId(integration);
 *
 * // Now use for tenant isolation
 * const filter = createTenantFilter(clerkOrgId);
 * ```
 */
export function extractTenantId(resource: { clerkOrgId: string }): string {
  return resource.clerkOrgId;
}

/**
 * Create tenant filter from org resource
 *
 * Convenience function that combines extractTenantId and createTenantFilter.
 *
 * @param resource - Resource object with clerkOrgId
 * @returns Tenant filter object
 *
 * @example
 * ```typescript
 * import { createTenantFilterFromOrg } from "@repo/app-auth-middleware/tenant";
 *
 * const integration = await db.query.orgIntegrations.findFirst({ ... });
 * const filter = createTenantFilterFromOrg(integration);
 *
 * // Use in queries
 * const resources = await db
 *   .select()
 *   .from(integrationResources)
 *   .where(eq(integrationResources.clerkOrgId, filter.clerkOrgId));
 * ```
 */
export function createTenantFilterFromOrg(resource: {
  clerkOrgId: string;
}): TenantFilter {
  return createTenantFilter(resource.clerkOrgId);
}

/**
 * Assert tenant IDs match
 *
 * Throws an error if two tenant IDs don't match.
 * Useful for cross-checking that resources belong to the same organization.
 *
 * @param tenantId1 - First organization ID
 * @param tenantId2 - Second organization ID
 * @param errorMessage - Custom error message (optional)
 * @throws Error if tenant IDs don't match
 *
 * @example
 * ```typescript
 * import { assertTenantIdsMatch } from "@repo/app-auth-middleware/tenant";
 *
 * // Ensure resource and integration belong to same org
 * assertTenantIdsMatch(
 *   resource.clerkOrgId,
 *   integration.clerkOrgId,
 *   "Integration doesn't belong to this organization"
 * );
 * ```
 */
export function assertTenantIdsMatch(
  tenantId1: string,
  tenantId2: string,
  errorMessage?: string
): void {
  if (tenantId1 !== tenantId2) {
    throw new Error(
      errorMessage ?? `Tenant ID mismatch: ${tenantId1} !== ${tenantId2}`
    );
  }
}

/**
 * Check if resource belongs to tenant
 *
 * Verifies that a resource's clerkOrgId matches the expected tenant ID.
 *
 * @param resource - Resource with clerkOrgId field
 * @param expectedTenantId - Expected organization ID
 * @returns True if resource belongs to tenant, false otherwise
 *
 * @example
 * ```typescript
 * import { belongsToTenant } from "@repo/app-auth-middleware/tenant";
 *
 * const integration = await db.query.orgIntegrations.findFirst({ ... });
 *
 * if (!belongsToTenant(integration, clerkOrgId)) {
 *   throw new TRPCError({
 *     code: "FORBIDDEN",
 *     message: "Resource doesn't belong to this organization",
 *   });
 * }
 * ```
 */
export function belongsToTenant(
  resource: { clerkOrgId: string },
  expectedTenantId: string
): boolean {
  return resource.clerkOrgId === expectedTenantId;
}

/**
 * Filter resources by tenant
 *
 * Client-side filter to remove resources that don't belong to the specified tenant.
 * Use this for in-memory filtering after fetching from database.
 *
 * ⚠️ IMPORTANT: Always filter at the database level when possible for security.
 * Only use this for additional safety or when database filtering isn't feasible.
 *
 * @param resources - Array of resources with clerkOrgId
 * @param tenantId - Organization ID to filter by
 * @returns Filtered array of resources
 *
 * @example
 * ```typescript
 * import { filterResourcesByTenant } from "@repo/app-auth-middleware/tenant";
 *
 * // After fetching resources (ideally already filtered at DB level)
 * const allResources = await fetchResources();
 *
 * // Additional client-side filtering for safety
 * const tenantResources = filterResourcesByTenant(allResources, clerkOrgId);
 * ```
 */
export function filterResourcesByTenant<T extends { clerkOrgId: string }>(
  resources: T[],
  tenantId: string
): T[] {
  return resources.filter((resource) => resource.clerkOrgId === tenantId);
}

/**
 * Create multi-tenant filter for OR conditions
 *
 * Creates filters for querying across multiple organizations.
 * Useful for admin operations or when a user has access to multiple orgs.
 *
 * @param clerkOrgIds - Array of organization IDs
 * @returns Array of tenant filters
 *
 * @example
 * ```typescript
 * import { createMultiTenantFilter } from "@repo/app-auth-middleware/tenant";
 * import { inArray } from "drizzle-orm";
 *
 * // Get integrations across multiple orgs
 * const filters = createMultiTenantFilter(["org_1", "org_2", "org_3"]);
 * const orgIds = filters.map(f => f.clerkOrgId);
 *
 * const multiOrgIntegrations = await ctx.db
 *   .select()
 *   .from(orgIntegrations)
 *   .where(inArray(orgIntegrations.clerkOrgId, orgIds));
 * ```
 */
export function createMultiTenantFilter(clerkOrgIds: string[]): TenantFilter[] {
  return clerkOrgIds.map((clerkOrgId) => createTenantFilter(clerkOrgId));
}
