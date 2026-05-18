import type { AuthContext } from "./context";
import { resolveIdentityFromClerk } from "./identity/resolve-clerk";
import { resolveReadinessFromTasks } from "./lightfast-tasks/resolve";

/**
 * Resolve the composite `AuthContext` for a request.
 *
 * Identity is always resolved (from Clerk Bearer + cookie). Readiness is
 * resolved from `org_lightfast_tasks` only when identity is `active` —
 * pending or unauthenticated identities get `{ type: "n/a" }` for free.
 *
 * Each sub-resolver is single-purpose and vendor-coupled to its own
 * implementation file. Swapping the IdP changes `identity/resolve-clerk.ts`;
 * adding a second readiness source adds a new readiness resolver and a
 * composition step here.
 */
export async function resolveAuth(headers: Headers): Promise<AuthContext> {
  const identity = await resolveIdentityFromClerk(headers);
  const readiness =
    identity.type === "active"
      ? await resolveReadinessFromTasks(identity.orgId)
      : ({ type: "n/a" } as const);
  return { identity, readiness };
}
