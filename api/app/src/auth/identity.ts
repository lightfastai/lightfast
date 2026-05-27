import { type Database, isOrgBound } from "@db/app";
import {
  NATIVE_AUTH_HEADERS,
  type NativeClient,
  nativeClientSchema,
} from "@repo/native-auth-contract";
import { auth, clerkClient } from "@vendor/clerk/server";
import { isExpectedNativeOAuthAccess } from "./native-oauth";

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

interface ClerkOAuthAuthResult {
  clientId?: unknown;
  isAuthenticated?: unknown;
  scopes?: unknown;
  tokenType?: unknown;
  userId?: unknown;
}

export type AuthAccess =
  | {
      has: ClerkHas;
      kind: "clerk-session";
      orgId: string | null;
      userId: string;
    }
  | {
      client: NativeClient;
      clientId: string;
      kind: "clerk-oauth";
      scopes: string[];
      userId: string;
    };

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

async function isNativeOrgMember(input: {
  organizationId: string;
  userId: string;
}): Promise<boolean> {
  const clerk = await clerkClient();
  const limit = 100;
  let offset = 0;

  while (true) {
    const memberships = await clerk.users.getOrganizationMembershipList({
      limit,
      offset,
      userId: input.userId,
    });
    if (
      memberships.data.some(
        (membership) => membership.organization.id === input.organizationId
      )
    ) {
      return true;
    }
    offset += limit;
    if (
      !memberships.data.length ||
      (typeof memberships.totalCount === "number" &&
        offset >= memberships.totalCount)
    ) {
      return false;
    }
  }
}

async function tryNativeOAuthBearer({
  db,
  headers,
}: ResolveIdentityInput): Promise<ResolvedAuthContext | undefined> {
  const authorization = headers.get("authorization");
  if (!(authorization && /^Bearer\b/i.test(authorization))) {
    return;
  }

  const rawClient = headers.get(NATIVE_AUTH_HEADERS.client);
  const parsedClient = nativeClientSchema.safeParse(rawClient);
  if (!parsedClient.success) {
    return { identity: UNAUTH_IDENTITY };
  }
  const client = parsedClient.data;

  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
  if (!match?.[1]) {
    return { identity: UNAUTH_IDENTITY };
  }

  let result: ClerkOAuthAuthResult | null;
  try {
    result = (await auth({
      acceptsToken: "oauth_token",
    })) as ClerkOAuthAuthResult;
  } catch (err) {
    console.warn("[trpc] Clerk OAuth bearer probe failed", {
      name: err instanceof Error ? err.name : "unknown",
      message: err instanceof Error ? err.message : String(err),
    });
    result = null;
  }

  if (!result) {
    return { identity: UNAUTH_IDENTITY };
  }
  const scopes = Array.isArray(result.scopes)
    ? result.scopes.filter(
        (scope): scope is string => typeof scope === "string"
      )
    : [];

  if (
    !result.isAuthenticated ||
    result.tokenType !== "oauth_token" ||
    typeof result.userId !== "string" ||
    typeof result.clientId !== "string"
  ) {
    return { identity: UNAUTH_IDENTITY };
  }

  if (
    !isExpectedNativeOAuthAccess({
      client,
      clientId: result.clientId,
      scopes,
    })
  ) {
    return { identity: UNAUTH_IDENTITY };
  }

  const organizationId = headers.get(NATIVE_AUTH_HEADERS.organizationId);
  if (organizationId) {
    const isMember = await isNativeOrgMember({
      organizationId,
      userId: result.userId,
    });
    if (!isMember) {
      return { identity: UNAUTH_IDENTITY };
    }
  }

  return {
    identity: await authIdentityFromDb(db, result.userId, organizationId),
    access: {
      client,
      clientId: result.clientId,
      kind: "clerk-oauth",
      scopes,
      userId: result.userId,
    },
  };
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
 * Resolve Clerk identity from native OAuth bearer headers or Clerk cookies.
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
  const nativeOAuth = await tryNativeOAuthBearer({ db, headers });
  if (nativeOAuth) {
    return nativeOAuth;
  }

  return await tryCookie(db);
}
