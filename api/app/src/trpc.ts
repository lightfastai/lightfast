/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */

import { db } from "@db/app/client";
import { resolveWorkspaceByName as resolveWorkspace } from "@repo/app-auth-middleware";
import { getCachedUserOrgMemberships } from "@repo/app-clerk-cache";
import { trpcMiddleware } from "@sentry/core";
import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@vendor/clerk/server";
import superjson from "superjson";
import { ZodError } from "zod";

/**
 * Authentication Context - Discriminated Union
 * Represents exactly one authentication method per request
 */
type AuthContext =
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
 * Unified tRPC context factory (Clerk auth only)
 *
 * API key auth is handled by the REST layer (withApiKeyAuth, withDualAuth),
 * not tRPC. The CLI uses REST endpoints, not tRPC procedures.
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const source = opts.headers.get("x-trpc-source") ?? "unknown";

  const clerkSession = await auth({ treatPendingAsSignedOut: false });

  if (clerkSession.userId) {
    if (clerkSession.orgId) {
      console.info(`>>> tRPC Request from ${source} by ${clerkSession.userId} (clerk-active)`);
      return {
        auth: {
          type: "clerk-active" as const,
          userId: clerkSession.userId,
          orgId: clerkSession.orgId,
        },
        db,
        headers: opts.headers,
      };
    }
    console.info(`>>> tRPC Request from ${source} by ${clerkSession.userId} (clerk-pending)`);
    return {
      auth: {
        type: "clerk-pending" as const,
        userId: clerkSession.userId,
      },
      db,
      headers: opts.headers,
    };
  }

  console.info(`>>> tRPC Request from ${source} - unauthenticated`);
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

const sentryMiddleware = t.middleware(
  trpcMiddleware({
    attachRpcInput: true,
  })
);

const sentrifiedProcedure = t.procedure.use(sentryMiddleware);

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
 * For org-scoped operations (workspaces, repos), use `orgScopedProcedure`.
 *
 * @see https://trpc.io/docs/procedures
 */
export const userScopedProcedure = sentrifiedProcedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (ctx.auth.type === "unauthenticated") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required. Please sign in.",
      });
    }

    // Allow both clerk-pending and clerk-active
    if (ctx.auth.type !== "clerk-pending" && ctx.auth.type !== "clerk-active") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Clerk authentication required",
      });
    }

    return next({
      ctx: {
        ...ctx,
        // Type-safe: either clerk-pending or clerk-active
        auth: ctx.auth as Extract<
          AuthContext,
          { type: "clerk-pending" | "clerk-active" }
        >,
      },
    });
  });

/**
 * Org-Scoped Procedure
 *
 * For org-level operations: workspaces, repositories, members, integrations.
 * Only accepts clerk-active users (authenticated + has claimed org).
 *
 * Type-safe: `ctx.auth.orgId` is guaranteed to exist.
 *
 * Use cases:
 * - Workspaces (list, create, update)
 * - Repositories (connect, sync)
 * - Org members (invite, remove)
 * - Org integrations (GitHub org, Slack workspace)
 * - Org settings
 *
 * For user-level operations (profile, create org), use `userScopedProcedure`.
 *
 * @see https://trpc.io/docs/procedures
 */
export const orgScopedProcedure = sentrifiedProcedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (ctx.auth.type === "unauthenticated") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required. Please sign in.",
      });
    }

    // Only allow clerk-active (has org)
    if (ctx.auth.type !== "clerk-active") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Organization required. Please create or join an organization first.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        // Type-safe: orgId is guaranteed to exist
        auth: ctx.auth as Extract<AuthContext, { type: "clerk-active" }>,
      },
    });
  });


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
}): Promise<{
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  clerkOrgId: string;
}> {
  const result = await resolveWorkspace({
    clerkOrgSlug: params.clerkOrgSlug,
    workspaceName: params.workspaceName,
    userId: params.userId,
    db,
  });

  if (!result.success) {
    throw new TRPCError({
      code: result.errorCode,
      message: result.error,
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
 * Helper: Verify organization membership
 *
 * Strategy: User-centric lookup with caching - fetches user's orgs (typically 1-5)
 * instead of org's members (could be 100+). This is O(user_orgs) vs O(org_size).
 *
 * This centralizes the pattern of:
 * 1. Fetching user's organization memberships (cached)
 * 2. Verifying user has access to the organization
 * 3. Optionally verifying user has admin role
 * 4. Returning the membership object for further processing
 *
 * Use this in procedures that need to verify organization-level access
 * (organization settings, member management, etc.)
 *
 * @throws {TRPCError} FORBIDDEN if user doesn't have access or doesn't have required role
 */
export async function verifyOrgMembership(params: {
  clerkOrgId: string;
  userId: string;
  requireAdmin?: boolean;
}): Promise<{
  role: string;
  organization: {
    id: string;
    name: string;
    slug: string | null;
    imageUrl: string;
  };
}> {
  // User-centric lookup: get user's orgs (cached)
  const userMemberships = await getCachedUserOrgMemberships(params.userId);

  // Find membership in target org
  const userMembership = userMemberships.find(
    (m) => m.organizationId === params.clerkOrgId
  );

  if (!userMembership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied to this organization",
    });
  }

  // Check admin requirement if specified
  if (params.requireAdmin && userMembership.role !== "org:admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only administrators can perform this action",
    });
  }

  return {
    role: userMembership.role,
    organization: {
      id: userMembership.organizationId,
      name: userMembership.organizationName,
      slug: userMembership.organizationSlug,
      imageUrl: userMembership.imageUrl,
    },
  };
}

