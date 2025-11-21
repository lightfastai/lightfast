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
      headers: opts.headers,
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
      headers: opts.headers,
    };
  }

  // No authentication
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
        message: "API key required. Provide 'Authorization: Bearer <api-key>' header.",
      });
    }

    const apiKey = authHeader.replace("Bearer ", "");

    // Extract workspace ID from header
    const workspaceId = ctx.headers.get("x-workspace-id");
    if (!workspaceId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Workspace ID required. Provide 'X-Workspace-ID: <workspace-id>' header.",
      });
    }

    // Verify API key and get workspace context
    const { workspaceId: verifiedWorkspaceId, userId, apiKeyId } = await verifyApiKey({
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

/**
 * Helper: Verify organization membership
 *
 * This centralizes the pattern of:
 * 1. Fetching organization membership list from Clerk
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
  const { clerkClient } = await import("@vendor/clerk/server");
  const clerk = await clerkClient();

  // Fetch organization membership list
  const membership = await clerk.organizations.getOrganizationMembershipList({
    organizationId: params.clerkOrgId,
  });

  // Find user's membership
  const userMembership = membership.data.find(
    (m) => m.publicUserData?.userId === params.userId,
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
      id: userMembership.organization.id,
      name: userMembership.organization.name,
      slug: userMembership.organization.slug,
      imageUrl: userMembership.organization.imageUrl,
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
export async function verifyApiKey(params: {
  key: string;
  workspaceId: string;
}): Promise<{
  workspaceId: string;
  userId: string;
  apiKeyId: string;
}> {
  const { hashApiKey } = await import("@repo/console-api-key");
  const { apiKeys } = await import("@db/console/schema");
  const { eq, and, sql } = await import("drizzle-orm");

  // Hash the provided key to compare with stored hash
  const keyHash = await hashApiKey(params.key);

  // Find API key in database
  const [apiKey] = await db
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      isActive: apiKeys.isActive,
      expiresAt: apiKeys.expiresAt,
    })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.keyHash, keyHash),
        eq(apiKeys.isActive, true),
      )
    )
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
    .update(apiKeys)
    .set({ lastUsedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(apiKeys.id, apiKey.id))
    .catch((error) => {
      console.error("Failed to update API key lastUsedAt", { error, apiKeyId: apiKey.id });
    });

  return {
    workspaceId: params.workspaceId,
    userId: apiKey.userId,
    apiKeyId: apiKey.id,
  };
}

/**
 * Standardized Error Handling Utilities
 *
 * These utilities provide consistent error handling patterns across all routers,
 * with proper logging, error classification, and user-friendly messages.
 */

type ErrorContext = {
  procedure: string;
  userId?: string;
  clerkOrgId?: string;
  workspaceId?: string;
  [key: string]: unknown;
};

/**
 * Handle errors in tRPC procedures with standardized logging and error messages
 *
 * This centralizes the pattern of:
 * 1. Logging the error with context
 * 2. Re-throwing TRPCErrors as-is
 * 3. Wrapping unknown errors in TRPCError
 *
 * Use this in try/catch blocks in procedures:
 *
 * @example
 * try {
 *   // ... operation
 * } catch (error) {
 *   handleProcedureError(error, {
 *     procedure: "repository.connect",
 *     userId: ctx.auth.userId,
 *     clerkOrgId: input.clerkOrgId,
 *   });
 * }
 */
export function handleProcedureError(
  error: unknown,
  context: ErrorContext,
  userMessage?: string,
): never {
  // Log error with context
  console.error(`[tRPC Error] ${context.procedure}`, {
    ...context,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  // Re-throw TRPCError as-is (already properly formatted)
  if (error instanceof TRPCError) {
    throw error;
  }

  // Wrap unknown errors in TRPCError
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: userMessage ?? "An unexpected error occurred",
    cause: error,
  });
}

/**
 * Create a standardized try/catch wrapper for procedure logic
 *
 * This provides a convenient way to wrap procedure logic with error handling:
 *
 * @example
 * connect: protectedProcedure
 *   .input(schema)
 *   .mutation(withErrorHandling(
 *     { procedure: "repository.connect" },
 *     async ({ ctx, input }) => {
 *       // ... procedure logic
 *       return result;
 *     }
 *   ))
 */
export function withErrorHandling<TContext, TInput, TOutput>(
  context: { procedure: string; [key: string]: unknown },
  handler: (params: { ctx: TContext; input: TInput }) => Promise<TOutput>,
  userMessage?: string,
) {
  return async (params: { ctx: TContext & { auth?: { userId?: string } }; input: TInput }): Promise<TOutput> => {
    try {
      return await handler(params);
    } catch (error) {
      handleProcedureError(
        error,
        {
          ...context,
          userId: params.ctx.auth?.userId,
        } as ErrorContext,
        userMessage,
      );
    }
  };
}

// Re-export for convenience
export { TRPCError } from "@trpc/server";
