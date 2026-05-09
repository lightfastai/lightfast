import { clerkEnvBase } from "@vendor/clerk/env";
import { auth, verifyToken } from "@vendor/clerk/server";

import type { AuthContext } from "./context";
import { ClerkJwtClaims, UNAUTH, clerkAuth } from "./context";

// Hoisted so config errors surface at boot, not per-request.
const CLERK_SECRET_KEY = clerkEnvBase.CLERK_SECRET_KEY;

/**
 * Bearer transport — Electron desktop renderer.
 *
 *   undefined   → header absent; caller should try the next transport
 *   AuthContext → definitive answer (resolved session OR rejected → unauth)
 *
 * A rejected Bearer never falls through to the cookie path: the only
 * Bearer caller (desktop renderer) is cross-origin and ships
 * `credentials: "omit"`, so cookies physically can't reach this request.
 * See `packages/app-trpc/src/desktop.tsx`.
 */
async function tryBearer(headers: Headers): Promise<AuthContext | undefined> {
  const match = /^Bearer\s+(.+)$/i.exec(headers.get("authorization") ?? "");
  const token = match?.[1];
  if (!token) return undefined;

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
