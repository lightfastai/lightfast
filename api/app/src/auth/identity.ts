import { clerkEnvBase } from "@vendor/clerk/env";
import { auth, verifyToken } from "@vendor/clerk/server";
import { z } from "zod";

/**
 * Lightfast-owned Clerk session claims.
 *
 * Augments Clerk's global `CustomJwtSessionClaims` so `auth()`'s typed
 * `sessionClaims` exposes `lf_binding_status`. The claim is minted by Clerk
 * from `org.public_metadata.lightfast.binding.status` (see the Phase 0 Clerk
 * configuration). It is read here, never written — the binding mirror service
 * owns the org metadata that backs it.
 */
declare global {
  interface CustomJwtSessionClaims {
    /** Org binding-gate mirror. Absent/empty for orgs that have not bound. */
    lf_binding_status?: string;
  }
}

/**
 * Org binding gate — has the active org completed source-control setup?
 *
 *   bound   → at least one active Binding; product features are reachable.
 *   unbound → no Binding yet (also the fail-closed default for missing claims).
 *   revoked → a Binding existed and was revoked; treated as not usable.
 */
export type BindingStatus = "bound" | "unbound" | "revoked";

/**
 * Org-level gate signal carried on an `active` identity. Resolved from the
 * verified Clerk `lf_binding_status` claim via `parseBindingStatus`; enforced
 * server-side by tRPC's `boundOrgProcedure`.
 */
export interface OrgGate {
  bindingStatus: BindingStatus;
}

/**
 * Normalises the raw `lf_binding_status` claim into a `BindingStatus`.
 *
 * Only the exact strings `"bound"` and `"revoked"` are honoured. Everything
 * else — missing, null, empty, or any unknown value — collapses to `unbound`
 * so a misconfigured or stale token fails closed.
 */
export function parseBindingStatus(value: unknown): BindingStatus {
  if (value === "bound") {
    return "bound";
  }
  if (value === "revoked") {
    return "revoked";
  }
  return "unbound";
}

/**
 * Authorization identity — the answer to "who is this request from?".
 * Vendor-agnostic — specific transports (Bearer JWT, cookie session, future
 * IdPs) construct one of these variants via the `authIdentity` factory.
 *
 * The `active` variant additionally carries `orgGate` — the org-level setup
 * signal — so org-scoped procedures can gate without a second round-trip.
 */
export type AuthIdentity =
  | { type: "unauthenticated" }
  | { type: "pending"; userId: string }
  | { type: "active"; userId: string; orgId: string; orgGate: OrgGate };

export const UNAUTH_IDENTITY = {
  type: "unauthenticated",
} as const satisfies AuthIdentity;

export function authIdentity(
  userId: string,
  orgId: string | null | undefined,
  bindingStatus: BindingStatus
): AuthIdentity {
  if (!orgId) {
    return { type: "pending", userId };
  }
  return { type: "active", userId, orgId, orgGate: { bindingStatus } };
}

// Hoisted so config errors surface at boot, not per-request.
const CLERK_SECRET_KEY = clerkEnvBase.CLERK_SECRET_KEY;

/**
 * Shape of the Clerk session JWT claims we depend on.
 * Validated at the system boundary so a Clerk claim rename fails loudly
 * instead of silently producing `unauthenticated` requests.
 */
const ClerkJwtClaims = z.object({
  sub: z.string(),
  /**
   * Active org id. `nullish` — not `optional` — because JWT-template tokens
   * (e.g. `lightfast-desktop`, claim `{{org.id}}`) render an absent org as an
   * explicit `null`, and an org-less token must still resolve to `pending`,
   * never fail parsing into `unauthenticated`.
   */
  org_id: z.string().nullish(),
  /**
   * Org binding-gate mirror. Typed as `unknown` so a missing, null, or empty
   * claim never fails JWT parsing — `parseBindingStatus` normalises it.
   */
  lf_binding_status: z.unknown(),
});

/**
 * Bearer transport — Electron desktop renderer.
 *
 *   undefined    → no Authorization header, or non-Bearer scheme; caller may
 *                  try the next transport
 *   AuthIdentity → definitive answer for Bearer requests:
 *                    - valid JWT       → active / pending
 *                    - malformed Bearer or rejected JWT → unauthenticated
 *
 * A definitive Bearer answer (UNAUTH or AuthIdentity) never falls through
 * to the cookie path: the only Bearer caller (desktop renderer) is
 * cross-origin and ships `credentials: "omit"`, so cookies physically
 * can't reach this request. See `packages/app-trpc/src/desktop.tsx`.
 */
async function tryBearer(headers: Headers): Promise<AuthIdentity | undefined> {
  const authorization = headers.get("authorization");
  if (!authorization) {
    return;
  }
  if (!/^Bearer\b/i.test(authorization)) {
    return;
  }
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
  const token = match?.[1];
  if (!token) {
    return UNAUTH_IDENTITY;
  }

  try {
    const claims = ClerkJwtClaims.parse(
      await verifyToken(token, { secretKey: CLERK_SECRET_KEY })
    );
    return authIdentity(
      claims.sub,
      claims.org_id,
      parseBindingStatus(claims.lf_binding_status)
    );
  } catch (err) {
    // Expired/invalid Bearer is expected (e.g. desktop holds a stale JWT
    // after sign-out). Log so genuinely suspicious failures (bad signature,
    // key rotation, Clerk outage) surface in observability.
    console.warn("[trpc] Bearer JWT verification failed", {
      name: err instanceof Error ? err.name : "unknown",
      message: err instanceof Error ? err.message : String(err),
    });
    return UNAUTH_IDENTITY;
  }
}

/** Cookie transport — Next.js web app (same-origin). */
async function tryCookie(): Promise<AuthIdentity> {
  const session = await auth({ treatPendingAsSignedOut: false });
  if (!session.userId) {
    return UNAUTH_IDENTITY;
  }
  return authIdentity(
    session.userId,
    session.orgId,
    parseBindingStatus(session.sessionClaims?.lf_binding_status)
  );
}

/**
 * Resolve Clerk identity from one of two transports, in order:
 *   1. `Authorization: Bearer <jwt>`  (desktop renderer, cross-origin)
 *   2. Clerk session cookie           (Next.js web app, same-origin)
 *
 * If a Bearer header is present, it is the sole source of truth for that
 * request — see `tryBearer`.
 */
export async function resolveIdentityFromClerk(
  headers: Headers
): Promise<AuthIdentity> {
  const bearer = await tryBearer(headers);
  return bearer ?? (await tryCookie());
}
