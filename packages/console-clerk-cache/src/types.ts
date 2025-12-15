/**
 * Cached representation of a user's organization membership.
 * Minimal data needed for auth decisions.
 */
export interface CachedUserOrgMembership {
  /** Clerk organization ID */
  organizationId: string;
  /** Organization slug for URL matching */
  organizationSlug: string | null;
  /** Organization name for display */
  organizationName: string;
  /** User's role in the organization */
  role: string;
  /** Organization image URL */
  imageUrl: string;
}

/**
 * Result of membership lookup - always returns array (empty if no memberships)
 */
export type GetMembershipsResult = CachedUserOrgMembership[];
