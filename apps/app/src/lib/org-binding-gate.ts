import "server-only";
import { isOrgBound } from "@db/app";
import { db } from "@db/app/client";

/**
 * Route-layer view of an org's source-control binding state.
 *
 * The DB binding can be `active`, `revoked`, or `error`; the gate only answers
 * "is this org usable yet?", so every non-active state collapses to `unbound`.
 */
export interface OrgBindingGate {
  bindingStatus: "bound" | "unbound";
}

/**
 * Route-layer org binding gate.
 *
 * Resolves the authoritative DB binding for a Clerk org id and reduces it to
 * the binary the `(bound)` layout and the `tasks/bind` page need. This is the
 * route-layer counterpart to the tRPC `boundOrgProcedure` claim check — it is
 * used by RSC layouts/pages, never by tRPC procedures.
 */
export async function getOrgBindingGate(
  clerkOrgId: string
): Promise<OrgBindingGate> {
  const bound = await isOrgBound(db, clerkOrgId);
  return { bindingStatus: bound ? "bound" : "unbound" };
}
