/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end.
 *
 * Identity resolution lives in `./auth/identity`. Structured failure payloads
 * (codes + repair hints) live in `./diagnostics`.
 */

import { db } from "@db/app/client";
import { repairIdForSetupRequirement } from "@repo/app-setup-contract";
import { initTRPC } from "@trpc/server";
import { createObservabilityMiddleware } from "@vendor/observability/trpc";
import superjson from "superjson";
import { ZodError } from "zod";

import type { AuthAccess, AuthIdentity } from "./auth/identity";
import { resolveAuthContextFromClerk } from "./auth/identity";
import { isDiagnosticCause, throwDiagnostic } from "./diagnostics";

/**
 * Authentication context — identity is the only auth dimension: "who is this
 * request from?". Resolved once per request in `createTRPCContext` and
 * narrowed at the procedure layer by the middleware below.
 */
export interface AuthContext {
  access?: AuthAccess;
  identity: AuthIdentity;
}

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
  auth: (await resolveAuthContextFromClerk({
    db,
    headers: opts.headers,
  })) satisfies AuthContext,
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
 * a lot in the /src/router folder.
 */

/**
 * This is how you create new routers and subrouters in your tRPC API.
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Create a server-side caller.
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * Times procedure execution and adds an artificial delay in development to
 * surface waterfalls that would otherwise only appear under production
 * network latency.
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
 * Authentication gate. Rejects `unauthenticated` identities; narrows
 * `ctx.auth.identity` to `pending | active` for downstream use.
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
 * Composed into `orgProcedure` — the default gate for active-org surfaces.
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

const signedInProcedure = t.procedure
  .use(observabilityMiddleware)
  .use(requireAuth);

const requireNativeOAuth = t.middleware(({ ctx, next }) => {
  if (
    ctx.auth.identity.type === "unauthenticated" ||
    ctx.auth.access?.kind !== "clerk-oauth"
  ) {
    throwDiagnostic({
      trpcCode: "UNAUTHORIZED",
      diagnostic: {
        code: "NATIVE_OAUTH_REQUIRED",
        message: "Lightfast native OAuth authentication required.",
      },
    });
  }

  return next({
    ctx: {
      ...ctx,
      auth: {
        ...ctx.auth,
        access: ctx.auth.access,
        identity: ctx.auth.identity,
      },
    },
  });
});

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in.
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
 * `orgProcedure`.
 *
 * @see https://trpc.io/docs/procedures
 */
export const viewerProcedure = signedInProcedure;

export const nativeOAuthProcedure = signedInProcedure.use(requireNativeOAuth);

/**
 * Pending-Not-Allowed Procedure
 *
 * Admits sessions with an `active` identity, *regardless of binding status*. A
 * `pending` identity throws `FORBIDDEN` with an `ORG_REQUIRED` entry in
 * `data.diagnostics[]`.
 *
 * `ctx.auth.identity.orgId` is guaranteed in handlers.
 *
 * This is no longer the default for org work — it does not enforce that the
 * org has completed setup. Use it only for active-org settings/setup surfaces
 * that must stay reachable before an org is bound. New product features should
 * use `boundOrgProcedure`; the v1 setup surface uses `setupProcedure`.
 *
 * For procedures that must remain callable during onboarding, use
 * `viewerProcedure`.
 *
 * @see https://trpc.io/docs/procedures
 */
export const orgProcedure = signedInProcedure.use(requireActiveIdentity);

/**
 * Setup Procedure
 *
 * The pre-bind setup surface. Identical gate to `orgProcedure` —
 * admits any `active` identity without checking binding status — but the
 * distinct name marks procedures that must stay callable *before* an org is
 * bound: `task.status` and `task.bind`.
 *
 * Product features should use `boundOrgProcedure` instead.
 */
export const setupProcedure = orgProcedure;

/**
 * Bound-org gate. Composed after `requireActiveIdentity`; rejects an active
 * identity whose authoritative DB binding status is not `bound` with
 * `FORBIDDEN` + an `ORG_SETUP_REQUIRED` entry in `data.diagnostics[]`.
 *
 * Identity resolution reads the Lightfast DB once per request to derive this
 * compact gate. Procedures that additionally need binding details (provider
 * ids, installation) should load the DB binding row inside the handler.
 */
const requireBoundOrg = t.middleware(({ ctx, next }) => {
  // requireActiveIdentity (composed before this) has already excluded
  // unauthenticated/pending identities; this guard only re-narrows the type
  // so `orgGate` is reachable. The non-active branch is unreachable here.
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
  if (ctx.auth.identity.orgGate.bindingStatus !== "bound") {
    const requirement = ctx.auth.identity.orgGate.nextSetupRequirement;
    throwDiagnostic({
      trpcCode: "FORBIDDEN",
      diagnostic: {
        code: "ORG_SETUP_REQUIRED",
        message:
          "Organization setup required. Complete setup before using Lightfast features.",
        repair: {
          id: requirement
            ? repairIdForSetupRequirement(requirement)
            : "setup-github-org",
        },
      },
    });
  }
  return next({
    ctx: { ...ctx, auth: { ...ctx.auth, identity: ctx.auth.identity } },
  });
});

/**
 * Bound-Org Procedure
 *
 * The default gate for org-scoped product features. Admits an `active`
 * identity whose org has completed source-control setup
 * (`bindingStatus === "bound"`). An active but unbound org throws
 * `FORBIDDEN` with an `ORG_SETUP_REQUIRED` entry in `data.diagnostics[]`.
 *
 * `ctx.auth.identity.orgId` is guaranteed in handlers.
 *
 * Typical use cases:
 * - Bound-only org product features
 * - Future workspace operations that require completed source-control setup
 *
 * For the pre-bind setup surface, use `setupProcedure`.
 *
 * @see https://trpc.io/docs/procedures
 */
export const boundOrgProcedure = orgProcedure.use(requireBoundOrg);

/**
 * Org-admin gate. Requires a web Clerk session for the active org whose
 * `has({ role: "org:admin" })` check succeeds. Bearer callers currently carry
 * identity only, not role/permission claims, so they fail closed here.
 */
const requireOrgAdmin = t.middleware(({ ctx, next }) => {
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

  const access = ctx.auth.access;
  const isMatchingAdmin =
    access?.kind === "clerk-session" &&
    access.userId === ctx.auth.identity.userId &&
    access.orgId === ctx.auth.identity.orgId &&
    access.has({ role: "org:admin" });

  if (!isMatchingAdmin) {
    throwDiagnostic({
      trpcCode: "FORBIDDEN",
      diagnostic: {
        code: "PERMISSION_REQUIRED",
        message: "Only organization administrators can perform this action.",
      },
    });
  }

  return next({
    ctx: { ...ctx, auth: { ...ctx.auth, identity: ctx.auth.identity } },
  });
});

export const orgAdminProcedure = orgProcedure.use(requireOrgAdmin);

export const boundOrgAdminProcedure = boundOrgProcedure.use(requireOrgAdmin);
