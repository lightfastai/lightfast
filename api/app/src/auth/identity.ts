import type { Database } from "@db/app";
import { clerkEnvBase } from "@vendor/clerk/env";
import { auth, verifyToken } from "@vendor/clerk/server";
import { z } from "zod";

/**
 * Authorization identity — the answer to "who is this request from?".
 * Vendor-agnostic — specific transports (Bearer JWT, cookie session, future
 * IdPs) construct one of these variants via the `authIdentity` factory.
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

function authIdentityFromOrg(userId: string, orgId: string | null | undefined) {
  return authIdentity(userId, orgId);
}

// Hoisted so config errors surface at boot, not per-request.
const CLERK_SECRET_KEY = clerkEnvBase.CLERK_SECRET_KEY;

/**
 * Shape of the Clerk bearer JWT claims we depend on.
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

  let claims: z.infer<typeof ClerkJwtClaims>;
  try {
    claims = ClerkJwtClaims.parse(
      await verifyToken(token, { secretKey: CLERK_SECRET_KEY })
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
  return authIdentityFromOrg(claims.sub, claims.org_id);
}

/** Cookie transport — Next.js web app (same-origin). */
async function tryCookie(): Promise<AuthIdentity> {
  const session = await auth({ treatPendingAsSignedOut: false });
  if (!session.userId) {
    return UNAUTH_IDENTITY;
  }
  return authIdentityFromOrg(session.userId, session.orgId);
}

/**
 * Resolve Clerk identity from one of two transports, in order:
 *   1. `Authorization: Bearer <jwt>`  (desktop renderer, cross-origin)
 *   2. Clerk session cookie           (Next.js web app, same-origin)
 *
 * If a Bearer header is present, it is the sole source of truth for that
 * request — see `tryBearer`.
 */
export interface ResolveIdentityInput {
  db: Database;
  headers: Headers;
}

export async function resolveIdentityFromClerk({
  headers,
}: ResolveIdentityInput): Promise<AuthIdentity> {
  const bearer = await tryBearer(headers);
  return bearer ?? (await tryCookie());
}
