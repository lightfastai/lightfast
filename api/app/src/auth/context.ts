import { z } from "zod";

/**
 * Authentication Context — Discriminated Union
 *
 * Every request resolves to exactly one variant:
 *   - clerk-pending: authenticated but hasn't claimed an organization yet
 *     (only allowed for onboarding procedures)
 *   - clerk-active:  authenticated AND has claimed an organization
 *     (can access all org-scoped resources)
 *   - unauthenticated: no valid session
 */
export type AuthContext =
  | { type: "clerk-pending"; userId: string }
  | { type: "clerk-active"; userId: string; orgId: string }
  | { type: "unauthenticated" };

/**
 * Shape of the Clerk session JWT claims we depend on.
 * Validated at the system boundary so a Clerk claim rename fails loudly
 * instead of silently producing `unauthenticated` requests.
 */
export const ClerkJwtClaims = z.object({
  sub: z.string(),
  org_id: z.string().optional(),
});

export const UNAUTH = {
  type: "unauthenticated",
} as const satisfies AuthContext;

/** Build an authenticated AuthContext from a Clerk userId + optional orgId. */
export function clerkAuth(
  userId: string,
  orgId: string | null | undefined
): AuthContext {
  return orgId
    ? { type: "clerk-active", userId, orgId }
    : { type: "clerk-pending", userId };
}
