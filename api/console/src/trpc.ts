/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */

import { db } from "@db/console/client";
import { trpcMiddleware } from "@sentry/core";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { auth } from "@vendor/clerk/server";

/**
 * Authentication Context - Discriminated Union
 * Represents exactly one authentication method per request
 */
export type AuthContext =
  | {
      type: "clerk";
      userId: string;
    }
  | {
      type: "webhook";
      source: "internal";
    }
  | {
      type: "unauthenticated";
    };

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

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const source = opts.headers.get("x-trpc-source") ?? "unknown";

  // Check for internal webhook calls (server-side only)
  // This header is set by our webhook service layer and cannot be spoofed via HTTP
  // because it's only added by server-side createCaller, not the HTTP handler
  const webhookSource = opts.headers.get("x-webhook-source");
  if (webhookSource === "internal") {
    console.info(`>>> tRPC Request from ${source} - internal webhook`);
    return {
      auth: { type: "webhook" as const, source: "internal" as const },
      db,
    };
  }

  // Authenticate via Clerk session only
  // treatPendingAsSignedOut: false allows pending users (authenticated but no org) to access tRPC procedures
  // This is needed for onboarding flows where users claim their first organization
  const clerkSession = await auth({ treatPendingAsSignedOut: false });
  if (clerkSession?.userId) {
    console.info(`>>> tRPC Request from ${source} by ${clerkSession.userId}`);
    return {
      auth: { type: "clerk" as const, userId: clerkSession.userId },
      db,
    };
  }

  // No authentication
  console.info(`>>> tRPC Request from ${source} - unauthenticated`);
  return {
    auth: { type: "unauthenticated" as const },
    db,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }),
});

const sentryMiddleware = t.middleware(
  trpcMiddleware({
    attachRpcInput: true,
  }),
);

export const sentrifiedProcedure = t.procedure.use(sentryMiddleware);

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
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev 100-500ms
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = sentrifiedProcedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid (either Clerk or API key) and guarantees authentication.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = sentrifiedProcedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (ctx.auth.type === "unauthenticated") {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return next({
      ctx: {
        ...ctx,
        // After check above, auth is clerk
        auth: ctx.auth as Extract<AuthContext, { type: "clerk" }>,
      },
    });
  });

/**
 * Clerk Protected procedure
 *
 * If you want a query or mutation to ONLY be accessible via Clerk session, use this.
 * This is used by web UI that needs to verify Clerk organization membership.
 *
 * Verifies that a valid Clerk session exists and guarantees `ctx.auth` is of type "clerk".
 *
 * @see https://trpc.io/docs/procedures
 */
export const clerkProtectedProcedure = sentrifiedProcedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (ctx.auth.type !== "clerk") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Clerk session required. Please sign in.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        // Type-safe clerk auth (guaranteed to be type "clerk")
        auth: ctx.auth as Extract<AuthContext, { type: "clerk" }>,
      },
    });
  });

/**
 * Webhook Protected procedure
 *
 * If you want a query or mutation to ONLY be accessible from verified webhook handlers, use this.
 * This is used by repository mutation procedures that should only be called after webhook signature verification.
 *
 * Verifies that the call is from an internal webhook source (server-side only) and guarantees `ctx.auth` is of type "webhook".
 *
 * Security:
 * - The x-webhook-source header is only set by our server-side createCaller
 * - Cannot be spoofed via HTTP requests (not passed through by fetchRequestHandler)
 * - Webhook handlers verify GitHub signatures before calling these procedures
 *
 * @see https://trpc.io/docs/procedures
 */
export const webhookProcedure = sentrifiedProcedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (ctx.auth.type !== "webhook") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "This endpoint can only be called by verified webhook handlers",
      });
    }

    return next({
      ctx: {
        ...ctx,
        // Type-safe webhook auth (guaranteed to be type "webhook")
        auth: ctx.auth as Extract<AuthContext, { type: "webhook" }>,
      },
    });
  });

/**
 * API Key Protected procedure
 *
 * If you want a query or mutation to ONLY be accessible via API key authentication, use this.
 * This is used by CLI clients that authenticate with API keys instead of Clerk sessions.
 *
 * Verifies that a valid API key is provided and guarantees `ctx.auth` is of type "apiKey".
 *
 * @see https://trpc.io/docs/procedures
 */

/**
 * Helper: Verify org access and resolve org ID from slug
 *
 * This centralizes the pattern of:
 * 1. Fetching org by slug from Clerk
 * 2. Verifying user has access to the org
 * 3. Returning the org ID for database queries
 *
 * Use this in procedures that need to work with organization-scoped data
 * (repositories, integrations, etc.)
 *
 * Uses @repo/console-auth-middleware for authorization logic
 *
 * @throws {TRPCError} NOT_FOUND if org doesn't exist
 * @throws {TRPCError} FORBIDDEN if user doesn't have access
 */
export async function verifyOrgAccessAndResolve(params: {
  clerkOrgSlug: string;
  userId: string;
}): Promise<{ clerkOrgId: string; clerkOrgSlug: string }> {
  const { verifyOrgAccess } = await import("@repo/console-auth-middleware");

  const result = await verifyOrgAccess({
    userId: params.userId,
    clerkOrgSlug: params.clerkOrgSlug,
  });

  if (!result.success) {
    throw new TRPCError({
      code: result.errorCode ?? "FORBIDDEN",
      message: result.error ?? "Access denied",
    });
  }

  return {
    clerkOrgId: result.data.clerkOrgId,
    clerkOrgSlug: params.clerkOrgSlug,
  };
}

/**
 * Helper: Resolve workspace by name within an org (user-facing)
 *
 * This centralizes the pattern of:
 * 1. Verifying org access (via verifyOrgAccessAndResolve)
 * 2. Fetching workspace by name within that org (name is user-facing, used in URLs)
 * 3. Returning workspace ID and internal slug for database queries
 *
 * Use this in procedures that need to work with workspace-scoped data from URL params
 * (jobs, stores, documents, etc.)
 *
 * @throws {TRPCError} NOT_FOUND if org or workspace doesn't exist
 * @throws {TRPCError} FORBIDDEN if user doesn't have access to org
 */
export async function resolveWorkspaceByName(params: {
  clerkOrgSlug: string;
  workspaceName: string;
  userId: string;
}): Promise<{ workspaceId: string; workspaceName: string; workspaceSlug: string; clerkOrgId: string }> {
  const { resolveWorkspaceByName: resolveWorkspace } = await import("@repo/console-auth-middleware");

  const result = await resolveWorkspace({
    clerkOrgSlug: params.clerkOrgSlug,
    workspaceName: params.workspaceName,
    userId: params.userId,
    db,
  });

  if (!result.success) {
    throw new TRPCError({
      code: result.errorCode ?? "NOT_FOUND",
      message: result.error ?? "Workspace not found",
    });
  }

  return {
    workspaceId: result.data.workspaceId,
    workspaceName: params.workspaceName,
    workspaceSlug: result.data.workspaceSlug,
    clerkOrgId: result.data.clerkOrgId,
  };
}

/**
 * Helper: Resolve workspace by slug within an org (internal use)
 *
 * ⚠️ INTERNAL USE ONLY - DO NOT USE IN USER-FACING ROUTES
 *
 * This helper queries by the internal `slug` field (e.g., "robust-chicken"),
 * which is used for Pinecone namespace naming and other internal operations.
 *
 * For user-facing URLs, ALWAYS use `resolveWorkspaceByName` instead,
 * which queries by the user-provided `name` field (e.g., "My Cool Project").
 *
 * This centralizes the pattern of:
 * 1. Verifying org access (via verifyOrgAccessAndResolve)
 * 2. Fetching workspace by internal slug within that org
 * 3. Returning workspace ID for database queries
 *
 * @throws {TRPCError} NOT_FOUND if org or workspace doesn't exist
 * @throws {TRPCError} FORBIDDEN if user doesn't have access to org
 */
export async function resolveWorkspaceBySlug(params: {
  clerkOrgSlug: string;
  workspaceSlug: string;
  userId: string;
}): Promise<{ workspaceId: string; workspaceSlug: string; clerkOrgId: string }> {
  const { resolveWorkspaceBySlug: resolveWorkspace } = await import("@repo/console-auth-middleware");

  const result = await resolveWorkspace({
    clerkOrgSlug: params.clerkOrgSlug,
    workspaceSlug: params.workspaceSlug,
    userId: params.userId,
    db,
  });

  if (!result.success) {
    throw new TRPCError({
      code: result.errorCode ?? "NOT_FOUND",
      message: result.error ?? "Workspace not found",
    });
  }

  return {
    workspaceId: result.data.workspaceId,
    workspaceSlug: params.workspaceSlug,
    clerkOrgId: result.data.clerkOrgId,
  };
}

// Re-export for convenience
export { TRPCError } from "@trpc/server";
