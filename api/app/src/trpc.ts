/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end.
 *
 * Auth resolution lives in `./auth` — this file consumes the resolved
 * `AuthContext` and wires it into tRPC middleware. Structured failure
 * payloads (codes + repair hints) live in `./diagnostics`.
 */

import { db } from "@db/app/client";
import { initTRPC } from "@trpc/server";
import { createObservabilityMiddleware } from "@vendor/observability/trpc";
import superjson from "superjson";
import { ZodError } from "zod";

import { resolveIdentityFromClerk } from "./auth/identity/resolve-clerk";
import { isDiagnosticCause, throwDiagnostic } from "./diagnostics";

// Re-exported for routers that want to pattern-match on `ctx.auth` directly.
export type { AuthContext } from "./auth/context";

/**
 * 1. CONTEXT
 *
 * The "context" available to every procedure: resolved auth, the database
 * client, and the raw request headers. Both transports (Bearer for desktop,
 * cookie for web) are handled inside `resolveIdentityFromClerk`.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => ({
  auth: { identity: await resolveIdentityFromClerk(opts.headers) },
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

    // Generic diagnostic envelope. Any gate (or future router) that throws via
    // `throwDiagnostic` lands its structured payload here — no per-error
    // branches in this formatter.
    const diagnostics = isDiagnosticCause(error.cause)
      ? error.cause.diagnostics
      : [];

    return {
      ...shape,
      message: shouldSanitize ? "An unexpected error occurred" : shape.message,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
        diagnostics,
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
      switch (ctx.auth.identity.type) {
        case "active":
          return {
            userId: ctx.auth.identity.userId,
            orgId: ctx.auth.identity.orgId,
          };
        case "pending":
          return { userId: ctx.auth.identity.userId };
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
 * identity state (e.g. service-account) only requires touching `requireAuth`.
 */
const requireAuth = t.middleware(({ ctx, next }) => {
  if (ctx.auth.identity.type === "unauthenticated") {
    throwDiagnostic({
      trpcCode: "UNAUTHORIZED",
      diagnostic: {
        code: "AUTH_REQUIRED",
        message: "Authentication required. Please sign in.",
      },
    });
  }
  // ctx.auth.identity is narrowed to pending | active for downstream use.
  return next({
    ctx: { ...ctx, auth: { ...ctx.auth, identity: ctx.auth.identity } },
  });
});

/**
 * Active-identity gate. Narrows `ctx.auth.identity` to the `active` variant
 * so downstream handlers can read `orgId` without re-discriminating.
 *
 * Composed into `pendingNotAllowedProcedure` — the default gate for every
 * org-scoped router.
 */
const requireActiveIdentity = t.middleware(({ ctx, next }) => {
  // requireAuth has already excluded "unauthenticated".
  if (ctx.auth.identity.type !== "active") {
    throwDiagnostic({
      trpcCode: "FORBIDDEN",
      diagnostic: {
        code: "ORG_REQUIRED",
        message:
          "Organization required. Please create or join an organization first.",
        repair: { id: "create-or-join-org" },
      },
    });
  }
  return next({
    ctx: { ...ctx, auth: { ...ctx.auth, identity: ctx.auth.identity } },
  });
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
 * Admits both `pending` and `active` identities. Use this for any operation
 * that must remain reachable while a user is still completing onboarding
 * (i.e. has not yet claimed/created an organization).
 *
 * The gate name describes the identity admission rule — *which* identity
 * states are allowed — not the operation's target. That way, adding a new
 * onboarding-time procedure does not require renaming the gate.
 *
 * Typical use cases:
 * - User profile and settings (`account.get`)
 * - List user's organizations
 * - Create the first organization
 *
 * For procedures that must reject `pending` identities, use
 * `pendingNotAllowedProcedure`.
 *
 * @see https://trpc.io/docs/procedures
 */
export const pendingAllowedProcedure = authedProcedure;

/**
 * Pending-Not-Allowed Procedure
 *
 * Admits sessions with an `active` identity — the safe default for every
 * org-scoped router. A `pending` identity throws `FORBIDDEN` with an
 * `ORG_REQUIRED` entry in `data.diagnostics[]`.
 *
 * `ctx.auth.identity.orgId` is guaranteed in handlers.
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
export const pendingNotAllowedProcedure = authedProcedure.use(
  requireActiveIdentity
);
