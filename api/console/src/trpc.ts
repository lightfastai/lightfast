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
 * @throws {TRPCError} NOT_FOUND if org doesn't exist
 * @throws {TRPCError} FORBIDDEN if user doesn't have access
 */
export async function verifyOrgAccessAndResolve(params: {
  clerkOrgSlug: string;
  userId: string;
}): Promise<{ clerkOrgId: string; clerkOrgSlug: string }> {
  const { clerkClient } = await import("@vendor/clerk/server");
  const clerk = await clerkClient();

  // 1. Fetch org by slug
  let clerkOrg;
  try {
    clerkOrg = await clerk.organizations.getOrganization({
      slug: params.clerkOrgSlug,
    });
  } catch {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Organization not found: ${params.clerkOrgSlug}`,
    });
  }

  if (!clerkOrg) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Organization not found: ${params.clerkOrgSlug}`,
    });
  }

  // 2. Verify user has access
  const membership = await clerk.organizations.getOrganizationMembershipList({
    organizationId: clerkOrg.id,
  });

  const userMembership = membership.data.find(
    (m) => m.publicUserData?.userId === params.userId,
  );

  if (!userMembership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied to this organization",
    });
  }

  // 3. Return org ID for database queries
  return {
    clerkOrgId: clerkOrg.id,
    clerkOrgSlug: params.clerkOrgSlug,
  };
}

/**
 * Helper: Resolve workspace by slug within an org
 *
 * This centralizes the pattern of:
 * 1. Verifying org access (via verifyOrgAccessAndResolve)
 * 2. Fetching workspace by slug within that org
 * 3. Returning workspace ID for database queries
 *
 * Use this in procedures that need to work with workspace-scoped data
 * (jobs, stores, documents, etc.)
 *
 * @throws {TRPCError} NOT_FOUND if org or workspace doesn't exist
 * @throws {TRPCError} FORBIDDEN if user doesn't have access to org
 */
export async function resolveWorkspaceBySlug(params: {
  clerkOrgSlug: string;
  workspaceSlug: string;
  userId: string;
}): Promise<{ workspaceId: string; workspaceSlug: string; clerkOrgId: string }> {
  // 1. Verify org access first
  const { clerkOrgId } = await verifyOrgAccessAndResolve({
    clerkOrgSlug: params.clerkOrgSlug,
    userId: params.userId,
  });

  // 2. Fetch workspace by slug within this org
  const { workspaces } = await import("@db/console/schema");
  const { eq, and } = await import("drizzle-orm");

  const workspace = await db.query.workspaces.findFirst({
    where: and(
      eq(workspaces.clerkOrgId, clerkOrgId),
      eq(workspaces.slug, params.workspaceSlug)
    ),
  });

  if (!workspace) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Workspace not found: ${params.workspaceSlug}`,
    });
  }

  // 3. Return workspace ID for database queries
  return {
    workspaceId: workspace.id,
    workspaceSlug: params.workspaceSlug,
    clerkOrgId,
  };
}

// Re-export for convenience
export { TRPCError } from "@trpc/server";
