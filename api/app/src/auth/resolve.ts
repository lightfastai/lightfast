import { clerkEnvBase } from "@vendor/clerk/env";
import { auth, verifyToken } from "@vendor/clerk/server";

import type { AuthContext } from "./context";
import { ClerkJwtClaims, clerkAuth, UNAUTH } from "./context";

// Hoisted so config errors surface at boot, not per-request.
const CLERK_SECRET_KEY = clerkEnvBase.CLERK_SECRET_KEY;

/**
 * Bearer transport — Electron desktop renderer.
 *
 *   undefined   → no Authorization header, or non-Bearer scheme; caller may
 *                 try the next transport
 *   AuthContext → definitive answer for Bearer requests:
 *                   - valid JWT       → clerk-active / clerk-pending
 *                   - malformed Bearer or rejected JWT → unauthenticated
 *
 * A definitive Bearer answer (UNAUTH or AuthContext) never falls through
 * to the cookie path: the only Bearer caller (desktop renderer) is
 * cross-origin and ships `credentials: "omit"`, so cookies physically
 * can't reach this request. See `packages/app-trpc/src/desktop.tsx`.
 */
async function tryBearer(headers: Headers): Promise<AuthContext | undefined> {
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
    return UNAUTH;
  }

  try {
    const claims = ClerkJwtClaims.parse(
      await verifyToken(token, { secretKey: CLERK_SECRET_KEY })
    );
    return clerkAuth(claims.sub, claims.org_id);
  } catch (err) {
    // Expired/invalid Bearer is expected (e.g. desktop holds a stale JWT
    // after sign-out). Log so genuinely suspicious failures (bad signature,
    // key rotation, Clerk outage) surface in observability.
    console.warn("[trpc] Bearer JWT verification failed", {
      name: err instanceof Error ? err.name : "unknown",
      message: err instanceof Error ? err.message : String(err),
    });
    return UNAUTH;
  }
}

/** Cookie transport — Next.js web app (same-origin). */
async function tryCookie(): Promise<AuthContext> {
  const session = await auth({ treatPendingAsSignedOut: false });
  return session.userId ? clerkAuth(session.userId, session.orgId) : UNAUTH;
}

/**
 * Resolve Clerk auth from one of two transports, in order:
 *   1. `Authorization: Bearer <jwt>`  (desktop renderer, cross-origin)
 *   2. Clerk session cookie           (Next.js web app, same-origin)
 *
 * If a Bearer header is present, it is the sole source of truth for that
 * request — see `tryBearer`.
 */
export async function resolveAuth(headers: Headers): Promise<AuthContext> {
  const bearer = await tryBearer(headers);
  return bearer ?? (await tryCookie());
}
