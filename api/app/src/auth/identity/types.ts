/**
 * Authorization identity — the answer to "who is this request from?".
 * Orthogonal to readiness. Vendor-agnostic — specific identity resolvers
 * (Bearer JWT, cookie session, future IdPs) construct one of these variants
 * via the `authIdentity` factory.
 */
export type AuthIdentity =
  | { type: "unauthenticated" }
  | { type: "pending"; userId: string }
  | { type: "active"; userId: string; orgId: string };

export const UNAUTH_IDENTITY = {
  type: "unauthenticated",
} as const satisfies AuthIdentity;

export function authIdentity(
  userId: string,
  orgId: string | null | undefined
): AuthIdentity {
  if (!orgId) {
    return { type: "pending", userId };
  }
  return { type: "active", userId, orgId };
}
