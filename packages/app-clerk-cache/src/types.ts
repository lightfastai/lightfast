/**
 * Cached representation of a user's organization membership.
 * Minimal data needed for auth decisions.
 */
export interface CachedUserOrgMembership {
  /** Organization image URL */
  imageUrl: string;
  /** Clerk organization ID */
  organizationId: string;
  /** Organization name for display */
  organizationName: string;
  /** Organization slug for URL matching */
  organizationSlug: string | null;
  /** User's role in the organization */
  role: string;
}

/**
 * Result of membership lookup - always returns array (empty if no memberships)
 */
export type GetMembershipsResult = CachedUserOrgMembership[];
