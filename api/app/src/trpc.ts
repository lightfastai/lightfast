/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end.
 *
 * Auth resolution lives in `./auth` — this file consumes the resolved
 * `AuthContext` and wires it into tRPC middleware.
 */

import { db } from "@db/app/client";
import { initTRPC, TRPCError } from "@trpc/server";
import { createObservabilityMiddleware } from "@vendor/observability/trpc";
import superjson from "superjson";
import { ZodError } from "zod";

import { resolveAuth } from "./auth/resolve";

// Re-exported for routers that want to pattern-match on `ctx.auth` directly.
export type { AuthContext } from "./auth/context";

/**
 * 1. CONTEXT
 *
 * The "context" available to every procedure: resolved auth, the database
 * client, and the raw request headers. Both transports (Bearer for desktop,
 * cookie for web) are handled inside `resolveAuth`.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => ({
  auth: await resolveAuth(opts.headers),
  db,
  headers: opts.headers,
});

/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer.
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
        default:
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
 * Pending-Allowed Procedure
 *
 * Admits both `clerk-pending` and `clerk-active` sessions. Use this for any
 * operation that must remain reachable while a user is still completing
 * onboarding (i.e. has not yet claimed/created an organization).
 *
 * The gate name describes the auth admission rule — *which* Clerk session
 * types are allowed — not the operation's target. That way, adding a new
 * onboarding-time procedure does not require renaming the gate.
 *
 * Typical use cases:
 * - User profile and settings (`account.get`)
 * - List user's organizations
 * - Create the first organization
 *
 * For procedures that must reject `clerk-pending` sessions, use
 * `pendingNotAllowedProcedure`.
 *
 * @see https://trpc.io/docs/procedures
 */
export const pendingAllowedProcedure = authedProcedure;

/**
 * Pending-Not-Allowed Procedure
 *
 * Admits `clerk-active` sessions only. `clerk-pending` is rejected by the
 * composed `requireOrg` middleware with `FORBIDDEN`.
 *
 * `ctx.auth.orgId` is guaranteed to be present in handlers.
 *
 * Typical use cases:
 * - Org API keys (list / create / revoke / delete)
 * - Org members, repositories, integrations, settings
 *
 * For procedures that must remain callable during onboarding, use
 * `pendingAllowedProcedure`.
 *
 * @see https://trpc.io/docs/procedures
 */
export const pendingNotAllowedProcedure = authedProcedure.use(requireOrg);
