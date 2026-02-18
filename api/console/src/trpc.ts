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
import { eq, and, sql } from "drizzle-orm";

import { auth } from "@vendor/clerk/server";
import { getCachedUserOrgMemberships } from "@repo/console-clerk-cache";
import { verifyM2MToken } from "@repo/console-clerk-m2m";
import {
  resolveWorkspaceByName as resolveWorkspace,
} from "@repo/console-auth-middleware";
import { hashApiKey } from "@repo/console-api-key";
import { userApiKeys } from "@db/console/schema";

/**
 * Authentication Context - Discriminated Union
 * Represents exactly one authentication method per request
 */
type AuthContext =
  | {
      type: "clerk-pending";
      userId: string;
      // Authenticated but hasn't claimed an organization yet
      // Only allowed for onboarding procedures in PENDING_USER_ALLOWED_PROCEDURES
    }
  | {
      type: "clerk-active";
      userId: string;
      orgId: string;
      // Authenticated and has claimed an organization
      // Can access all org-scoped resources
    }
  | {
      type: "m2m";
      machineId: string; // Machine ID that created the token (webhook or inngest machine)
    }
  | {
      type: "apiKey";
      workspaceId: string;
      userId: string;
      apiKeyId: string;
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
 * Create context for user-scoped procedures
 *
 * Used by /api/trpc/user/* endpoint
 * Allows both pending users (no org) and active users (has org)
 *
 * Procedures accessible:
 * - organization.* (create, list, update)
 * - account.* (profile, API keys, personal integrations)
 */
export const createUserTRPCContext = async (opts: { headers: Headers }) => {
  const source = opts.headers.get("x-trpc-source") ?? "unknown";

  // Check for M2M Bearer token (highest priority)
  const authHeader = opts.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");

    try {
      const verified = await verifyM2MToken(token);

      if (!verified.expired && !verified.revoked) {
        console.info(
          `>>> tRPC User Request from ${source} - M2M token (machine: ${verified.subject})`,
        );
        return {
          auth: {
            type: "m2m" as const,
            machineId: verified.subject,
          },
          db,
          headers: opts.headers,
        };
      }
    } catch (error) {
      console.warn("[M2M Auth] Token verification error:", error);
    }
  }

  // Authenticate via Clerk - ALWAYS allow pending users for user-scoped endpoint
  const clerkSession = await auth({
    treatPendingAsSignedOut: false, // Allow pending users
  });

  if (clerkSession.userId) {
    if (clerkSession.orgId) {
      console.info(
        `>>> tRPC User Request from ${source} by ${clerkSession.userId} (clerk-active)`,
      );

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

    console.info(
      `>>> tRPC User Request from ${source} by ${clerkSession.userId} (clerk-pending)`,
    );

    return {
      auth: {
        type: "clerk-pending" as const,
        userId: clerkSession.userId,
      },
      db,
      headers: opts.headers,
    };
  }

  // No authentication
  console.info(`>>> tRPC User Request from ${source} - unauthenticated`);
  return {
    auth: { type: "unauthenticated" as const },
    db,
    headers: opts.headers,
  };
};

/**
 * Create context for org-scoped procedures
 *
 * Used by /api/trpc/org/* endpoint
 * Only allows active users (authenticated + has org)
 * Pending users are treated as unauthenticated
 *
 * Procedures accessible:
 * - workspace.* (management, jobs, stats)
 * - integration.* (GitHub, connections)
 * - stores.* (vector stores)
 * - jobs.* (background jobs)
 * - sources.* (data sources)
 * - clerk.* (org utilities)
 * - search.*, contents.* (semantic search)
 */
export const createOrgTRPCContext = async (opts: { headers: Headers }) => {
  const source = opts.headers.get("x-trpc-source") ?? "unknown";

  // Check for M2M Bearer token (highest priority)
  const authHeader = opts.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");

    try {
      const verified = await verifyM2MToken(token);

      if (!verified.expired && !verified.revoked) {
        console.info(
          `>>> tRPC Org Request from ${source} - M2M token (machine: ${verified.subject})`,
        );
        return {
          auth: {
            type: "m2m" as const,
            machineId: verified.subject,
          },
          db,
          headers: opts.headers,
        };
      }
    } catch (error) {
      console.warn("[M2M Auth] Token verification error:", error);
    }
  }

  // Authenticate via Clerk - REQUIRE active org for org-scoped endpoint
  const clerkSession = await auth({
    treatPendingAsSignedOut: true, // Pending users blocked
  });

  if (clerkSession.userId && clerkSession.orgId) {
    console.info(
      `>>> tRPC Org Request from ${source} by ${clerkSession.userId} (clerk-active)`,
    );

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

  // No authentication or pending user
  console.info(`>>> tRPC Org Request from ${source} - unauthenticated`);
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
 * Note: Using createUserTRPCContext as the type reference since both
 * createUserTRPCContext and createOrgTRPCContext return the same context shape.
 * They only differ in auth validation (user-scoped vs org-scoped).
 */
const isProduction = process.env.NODE_ENV === "production";

const t = initTRPC.context<typeof createUserTRPCContext>().create({
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
  }),
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
        auth: ctx.auth as Extract<AuthContext, { type: "clerk-pending" | "clerk-active" }>,
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
        message: "Organization required. Please create or join an organization first.",
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
 * Webhook M2M Protected procedure
 *
 * For GitHub webhook handlers ONLY.
 * Validates that the M2M token was created by the webhook machine.
 *
 * This provides:
 * - Service-specific audit trail (know webhook handler made the call)
 * - Granular access control (revoke webhook tokens without affecting Inngest)
 * - Better security (separate credentials for separate services)
 *
 * @see https://clerk.com/docs/machine-auth/m2m-tokens
 */
export const webhookM2MProcedure = sentrifiedProcedure
  .use(timingMiddleware)
  .use(async ({ ctx, next }) => {
    // Require M2M token
    if (ctx.auth.type !== "m2m") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message:
          "Webhook M2M token required. This endpoint is for GitHub webhook handlers only.",
      });
    }

    // Machine ID validation removed - we create tokens on-demand now
    // The verified.subject contains the machine ID, but since we control token creation
    // via createM2MToken("webhook"), we know it's from the correct machine
    // Additional validation is redundant in our architecture

    return next({
      ctx: {
        ...ctx,
        auth: ctx.auth as Extract<AuthContext, { type: "m2m" }>,
      },
    });
  });

/**
 * Inngest M2M Protected procedure
 *
 * For Inngest background workflows ONLY.
 * Validates that the M2M token was created by the Inngest machine.
 *
 * This provides:
 * - Service-specific audit trail (know Inngest workflow made the call)
 * - Granular access control (revoke Inngest tokens without affecting webhooks)
 * - Better security (separate credentials for separate services)
 *
 * @see https://clerk.com/docs/machine-auth/m2m-tokens
 */
export const inngestM2MProcedure = sentrifiedProcedure
  .use(timingMiddleware)
  .use(async ({ ctx, next }) => {
    // Require M2M token (no legacy fallback for Inngest)
    if (ctx.auth.type !== "m2m") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message:
          "Inngest M2M token required. This endpoint is for Inngest workflows only.",
      });
    }

    // Machine ID validation removed - we create tokens on-demand now
    // The verified.subject contains the machine ID, but since we control token creation
    // via createM2MToken("inngest"), we know it's from the correct machine
    // Additional validation is redundant in our architecture

    return next({
      ctx: {
        ...ctx,
        auth: ctx.auth as Extract<AuthContext, { type: "m2m" }>,
      },
    });
  });

/**
 * API Key Protected procedure
 *
 * If you want a query or mutation to ONLY be accessible via API key authentication, use this.
 * This is used by public API endpoints (search, contents) that need workspace-scoped access.
 *
 * Verifies that a valid API key is provided and guarantees `ctx.auth` is of type "apiKey".
 *
 * Security:
 * - Extracts Bearer token from Authorization header
 * - Extracts workspace ID from X-Workspace-ID header
 * - Verifies key hash against database
 * - Checks expiration and active status
 * - Provides workspace context for tenant isolation
 *
 * @see https://trpc.io/docs/procedures
 */
export const apiKeyProcedure = sentrifiedProcedure
  .use(timingMiddleware)
  .use(async ({ ctx, next }) => {
    // Extract API key from Authorization header
    const authHeader = ctx.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message:
          "API key required. Provide 'Authorization: Bearer <api-key>' header.",
      });
    }

    const apiKey = authHeader.replace("Bearer ", "");

    // Extract workspace ID from header
    const workspaceId = ctx.headers.get("x-workspace-id");
    if (!workspaceId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Workspace ID required. Provide 'X-Workspace-ID: <workspace-id>' header.",
      });
    }

    // Verify API key and get workspace context
    const {
      workspaceId: verifiedWorkspaceId,
      userId,
      apiKeyId,
    } = await verifyApiKey({
      key: apiKey,
      workspaceId,
    });

    return next({
      ctx: {
        ...ctx,
        auth: {
          type: "apiKey" as const,
          workspaceId: verifiedWorkspaceId,
          userId,
          apiKeyId,
        },
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
    (m) => m.organizationId === params.clerkOrgId,
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

/**
 * Helper: Verify API key and load workspace context
 *
 * This centralizes the pattern of:
 * 1. Extracting workspace ID from header
 * 2. Verifying key hash in database
 * 3. Checking expiration and active status
 * 4. Updating last used timestamp
 *
 * Use this in apiKeyProcedure middleware
 *
 * @throws {TRPCError} UNAUTHORIZED if key is invalid, expired, or inactive
 * @throws {TRPCError} BAD_REQUEST if workspace ID header is missing
 */
async function verifyApiKey(params: {
  key: string;
  workspaceId: string;
}): Promise<{
  workspaceId: string;
  userId: string;
  apiKeyId: string;
}> {
  // Hash the provided key to compare with stored hash
  const keyHash = await hashApiKey(params.key);

  // Find API key in database
  const [apiKey] = await db
    .select({
      id: userApiKeys.id,
      userId: userApiKeys.userId,
      isActive: userApiKeys.isActive,
      expiresAt: userApiKeys.expiresAt,
    })
    .from(userApiKeys)
    .where(and(eq(userApiKeys.keyHash, keyHash), eq(userApiKeys.isActive, true)))
    .limit(1);

  if (!apiKey) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid API key",
    });
  }

  // Check expiration
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "API key expired",
    });
  }

  // Update last used timestamp (non-blocking)
  void db
    .update(userApiKeys)
    .set({ lastUsedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(userApiKeys.id, apiKey.id))
    .catch((error: unknown) => {
      console.error("Failed to update API key lastUsedAt", {
        error,
        apiKeyId: apiKey.id,
      });
    });

  return {
    workspaceId: params.workspaceId,
    userId: apiKey.userId,
    apiKeyId: apiKey.id,
  };
}
