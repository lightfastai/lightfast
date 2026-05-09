/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */

import { db } from "@db/app/client";
import { initTRPC, TRPCError } from "@trpc/server";
import { clerkEnvBase } from "@vendor/clerk/env";
import { auth, verifyToken } from "@vendor/clerk/server";
import { createObservabilityMiddleware } from "@vendor/observability/trpc";
import superjson from "superjson";
import { z, ZodError } from "zod";

/**
 * Authentication Context - Discriminated Union
 * Represents exactly one authentication method per request.
 *
 * Exported so router helpers can type narrow against this union without
 * re-deriving the shape.
 */
export type AuthContext =
  | {
      type: "clerk-pending";
      userId: string;
      // Authenticated but hasn't claimed an organization yet
      // Only allowed for onboarding procedures
    }
  | {
      type: "clerk-active";
      userId: string;
      orgId: string;
      // Authenticated and has claimed an organization
      // Can access all org-scoped resources
    }
  | {
      type: "unauthenticated";
    };

// Hoisted so config errors surface at boot, not per-request.
const CLERK_SECRET_KEY = clerkEnvBase.CLERK_SECRET_KEY;

/**
 * Shape of the Clerk session JWT claims we depend on.
 * Validated at the system boundary so a Clerk claim rename fails loudly
 * instead of silently producing `unauthenticated` requests.
 */
const ClerkJwtClaims = z.object({
  sub: z.string(),
  org_id: z.string().optional(),
});

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */

/**
 * Resolved Clerk session — minimal shape consumed by createTRPCContext.
 *
 * `null` means no valid session was found via either Bearer token or cookie.
 */
type ResolvedSession = { userId: string; orgId: string | null } | null;

/**
 * Resolve a Clerk session from one of two transports:
 *
 *   - `Authorization: Bearer <jwt>` — used by the Electron desktop renderer
 *     (cross-origin, can't carry the Clerk cookie). See
 *     `packages/app-trpc/src/desktop.tsx`.
 *   - Clerk session cookie — used by the Next.js web app (same-origin).
 *
 * If a Bearer header is present, it is the sole source of truth for that
 * request: success returns the session, failure returns `null`. We do not
 * fall through to the cookie path on bad-Bearer because the only Bearer
 * caller (desktop renderer) is cross-origin and its cookies are never sent
 * (`credentials: "omit"`), so cookies cannot rescue a rejected Bearer.
 *
 * Exported for unit testing — production callers should use `createTRPCContext`.
 */
export async function resolveClerkSession(
  headers: Headers
): Promise<ResolvedSession> {
  const authHeader = headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (match?.[1]) {
    try {
      const claims = await verifyToken(match[1], {
        secretKey: CLERK_SECRET_KEY,
      });
      const parsed = ClerkJwtClaims.safeParse(claims);
      if (parsed.success) {
        return {
          userId: parsed.data.sub,
          orgId: parsed.data.org_id ?? null,
        };
      }
    } catch (err) {
      // Expired/invalid Bearer is expected (e.g. desktop holds a stale JWT
      // after sign-out). Log so genuinely suspicious failures (bad signature,
      // key rotation, Clerk outage) surface in observability.
      console.warn("[trpc] Bearer JWT verification failed", {
        name: err instanceof Error ? err.name : "unknown",
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return null;
  }

  const cookieSession = await auth({ treatPendingAsSignedOut: false });
  if (!cookieSession.userId) {
    return null;
  }
  return {
    userId: cookieSession.userId,
    orgId: cookieSession.orgId ?? null,
  };
}

/**
 * Unified tRPC context factory (Clerk auth only)
 *
 * Accepts both the Clerk cookie (web) and `Authorization: Bearer <jwt>` (desktop).
 *
 * API key auth is handled by the REST layer (withApiKeyAuth, withDualAuth),
 * not tRPC. The CLI uses REST endpoints, not tRPC procedures.
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await resolveClerkSession(opts.headers);

  if (session) {
    if (session.orgId) {
      return {
        auth: {
          type: "clerk-active" as const,
          userId: session.userId,
          orgId: session.orgId,
        },
        db,
        headers: opts.headers,
      };
    }
    return {
      auth: {
        type: "clerk-pending" as const,
        userId: session.userId,
      },
      db,
      headers: opts.headers,
    };
  }

  return {
    auth: { type: "unauthenticated" as const },
    db,
    headers: opts.headers,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 *
 * Uses the unified createTRPCContext factory (Clerk auth only).
 */
const isProduction = process.env.NODE_ENV === "production";

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => {
    // In production, sanitize INTERNAL_SERVER_ERROR messages to prevent credential leaks.
    // Procedures that throw TRPCError with specific codes (CONFLICT, BAD_REQUEST, etc.)
    // intentionally set user-facing messages, so those are preserved.
    const shouldSanitize =
      isProduction && error.code === "INTERNAL_SERVER_ERROR";

    return {
      ...shape,
      message: shouldSanitize ? "An unexpected error occurred" : shape.message,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these
 * a lot in the /src/server/api/routers folder
 */

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Create a server-side caller
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const observabilityMiddleware = t.middleware(
  createObservabilityMiddleware({
    isDev: t._config.isDev,
    extractAuth: (ctx) => {
      switch (ctx.auth.type) {
        case "clerk-active":
          return { userId: ctx.auth.userId, orgId: ctx.auth.orgId };
        case "clerk-pending":
          return { userId: ctx.auth.userId };
        case "unauthenticated":
          return {};
      }
    },
  })
);

/**
 * Authentication gates, composed by user/org procedures below.
 *
 * Split out so the unauth check exists in exactly one place — adding a 4th
 * auth state (e.g. service-account) only requires touching `requireAuth`.
 */
const requireAuth = t.middleware(({ ctx, next }) => {
  if (ctx.auth.type === "unauthenticated") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required. Please sign in.",
    });
  }
  // ctx.auth is narrowed to clerk-pending | clerk-active for downstream use.
  return next({ ctx: { ...ctx, auth: ctx.auth } });
});

const requireOrg = t.middleware(({ ctx, next }) => {
  // requireAuth has already excluded "unauthenticated".
  if (ctx.auth.type !== "clerk-active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Organization required. Please create or join an organization first.",
    });
  }
  return next({ ctx: { ...ctx, auth: ctx.auth } });
});

const authedProcedure = t.procedure
  .use(observabilityMiddleware)
  .use(requireAuth);

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = t.procedure.use(observabilityMiddleware);

/**
 * User-Scoped Procedure
 *
 * For user-level operations: account settings, profile, list orgs, create org.
 * Accepts both clerk-pending (no org) and clerk-active (has org) users.
 *
 * Use cases:
 * - User profile and settings
 * - List user's organizations
 * - Create new organization
 * - User-level integrations (GitHub account connection)
 *
 * For org-scoped operations (repos, integrations), use `orgScopedProcedure`.
 *
 * @see https://trpc.io/docs/procedures
 */
export const userScopedProcedure = authedProcedure;

/**
 * Org-Scoped Procedure
 *
 * For org-level operations: repositories, members, integrations.
 * Only accepts clerk-active users (authenticated + has claimed org).
 *
 * Type-safe: `ctx.auth.orgId` is guaranteed to exist.
 *
 * Use cases:
 * - Repositories (connect, sync)
 * - Org members (invite, remove)
 * - Org integrations (GitHub org, Slack)
 * - Org settings
 *
 * For user-level operations (profile, create org), use `userScopedProcedure`.
 *
 * @see https://trpc.io/docs/procedures
 */
export const orgScopedProcedure = authedProcedure.use(requireOrg);
