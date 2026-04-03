import type { OrgAccessContext, OrgAccessResult } from "./types";

/**
 * Verify organization access via Clerk
 *
 * Strategy: User-centric lookup with caching - fetches user's orgs (typically 1-5)
 * instead of org's members (could be 100+). This is O(user_orgs) vs O(org_size).
 */
export async function verifyOrgAccess(
  params: OrgAccessContext
): Promise<OrgAccessResult> {
  try {
    const { clerkClient } = await import("@vendor/clerk/server");
    const clerk = await clerkClient();

    let clerkOrg;
    try {
      clerkOrg = await clerk.organizations.getOrganization({
        slug: params.clerkOrgSlug,
      });
    } catch {
      return {
        success: false,
        error: `Organization not found: ${params.clerkOrgSlug}`,
        errorCode: "NOT_FOUND",
      };
    }

    if (!clerkOrg) {
      return {
        success: false,
        error: `Organization not found: ${params.clerkOrgSlug}`,
        errorCode: "NOT_FOUND",
      };
    }

    const { getCachedUserOrgMemberships } = await import(
      "@repo/app-clerk-cache"
    );
    const userMemberships = await getCachedUserOrgMemberships(params.userId);

    const userMembership = userMemberships.find(
      (m) => m.organizationId === clerkOrg.id
    );

    if (!userMembership) {
      return {
        success: false,
        error: "Access denied to this organization",
        errorCode: "FORBIDDEN",
      };
    }

    return {
      success: true,
      data: {
        clerkOrgId: clerkOrg.id,
        clerkOrgSlug: params.clerkOrgSlug,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to verify organization access: ${error instanceof Error ? error.message : "Unknown error"}`,
      errorCode: "INTERNAL_SERVER_ERROR",
    };
  }
}
