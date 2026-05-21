import { type Database, isOrgBound } from "@db/app";
import { clerkEnvBase } from "@vendor/clerk/env";
import { auth, verifyToken } from "@vendor/clerk/server";
import { z } from "zod";

/**
 * Org binding gate — has the active org completed source-control setup?
 *
 *   bound   → at least one active Binding; product features are reachable.
 *   unbound → no active Binding yet.
 *   revoked → a Binding existed and was revoked; treated as not usable.
 */
export type BindingStatus = "bound" | "unbound" | "revoked";

/**
 * Org-level gate signal carried on an `active` identity. Resolved from the
 * authoritative Lightfast DB binding; enforced server-side by tRPC's
 * `boundOrgProcedure`.
 */
export interface OrgGate {
  bindingStatus: BindingStatus;
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

type ClerkAuthSession = Awaited<ReturnType<typeof auth>>;
type ClerkHas = ClerkAuthSession["has"];

export interface AuthAccess {
  kind: "clerk-session";
  userId: string;
  orgId: string | null;
  has: ClerkHas;
}

export interface ResolvedAuthContext {
  access?: AuthAccess;
  identity: AuthIdentity;
}

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

async function authIdentityFromDb(
  db: Database,
  userId: string,
  orgId: string | null | undefined
): Promise<AuthIdentity> {
  if (!orgId) {
    return { type: "pending", userId };
  }
  const bound = await isOrgBound(db, orgId);
  return authIdentity(userId, orgId, bound ? "bound" : "unbound");
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
async function tryBearer({
  db,
  headers,
}: ResolveIdentityInput): Promise<AuthIdentity | undefined> {
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
  return authIdentityFromDb(db, claims.sub, claims.org_id);
}

/** Cookie transport — Next.js web app (same-origin). */
async function tryCookie(db: Database): Promise<ResolvedAuthContext> {
  const session = await auth({ treatPendingAsSignedOut: false });
  if (!session.userId) {
    return { identity: UNAUTH_IDENTITY };
  }
  return {
    identity: await authIdentityFromDb(db, session.userId, session.orgId),
    access: {
      kind: "clerk-session",
      userId: session.userId,
      orgId: session.orgId ?? null,
      has: ((params) => session.has(params)) satisfies ClerkHas,
    },
  };
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
  db,
  headers,
}: ResolveIdentityInput): Promise<AuthIdentity> {
  return (await resolveAuthContextFromClerk({ db, headers })).identity;
}

export async function resolveAuthContextFromClerk({
  db,
  headers,
}: ResolveIdentityInput): Promise<ResolvedAuthContext> {
  const bearer = await tryBearer({ db, headers });
  return bearer ? { identity: bearer } : await tryCookie(db);
}
