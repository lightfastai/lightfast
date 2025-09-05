/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */

import { db } from "@db/cloud/client";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { auth } from "@vendor/clerk/server";

import { authenticateApiKey } from "./middleware/apiKey";

/**
 * Session types for different authentication methods
 */
export type Session = 
  | {
      type: 'api-key';
      data: {
        userId: string;
        apiKeyId: string;
        organizationId: string;
        organizationRole?: string;
      };
    }
  | {
      type: 'clerk';
      data: Awaited<ReturnType<typeof auth>> & {
        organizationId?: string;
        organizationRole?: string;
      };
    }
  | null;

/**
 * Organization context for multi-tenant operations
 */
export type OrganizationContext = {
  id: string;
  role: string;
  permissions?: string[];
} | null;

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
  // Get the source header for logging
  const source = opts.headers.get("x-trpc-source") ?? "unknown";
  
  // First, try to authenticate via API key
  const apiKeyAuth = await authenticateApiKey(opts.headers, db);
  
  if (apiKeyAuth) {
    console.info(`>>> tRPC Request from ${source} by ${apiKeyAuth.userId} (API Key: ${apiKeyAuth.apiKeyId})`);
    
    const session: Session = {
      type: 'api-key',
      data: {
        userId: apiKeyAuth.userId,
        apiKeyId: apiKeyAuth.apiKeyId,
        organizationId: apiKeyAuth.organizationId,
        organizationRole: apiKeyAuth.organizationRole,
      },
    };
    
    const organization: OrganizationContext = apiKeyAuth.organizationId ? {
      id: apiKeyAuth.organizationId,
      role: apiKeyAuth.organizationRole || 'member',
    } : null;
    
    return {
      session,
      organization,
      db,
    };
  }
  
  // Fall back to Clerk session authentication
  const clerkSession = await auth();
  
  const session: Session = clerkSession?.userId
    ? {
        type: 'clerk',
        data: {
          ...clerkSession,
          organizationId: clerkSession.orgId,
          organizationRole: clerkSession.orgRole,
        } as typeof clerkSession & { 
          userId: string;
          organizationId?: string;
          organizationRole?: string;
        },
      }
    : null;

  const organization: OrganizationContext = clerkSession?.orgId ? {
    id: clerkSession.orgId,
    role: clerkSession.orgRole || 'member',
    permissions: clerkSession.orgPermissions,
  } : null;

  if (session?.data?.userId) {
    console.info(`>>> tRPC Request from ${source} by ${session.data.userId} (Session Auth)${organization ? ` in org ${organization.id}` : ''}`);
  } else {
    console.info(`>>> tRPC Request from ${source} by unknown`);
  }

  return {
    session,
    organization,
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
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.userId` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.data?.userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        // After check above, we know session exists and userId is non-null
        session: ctx.session as typeof ctx.session & { data: { userId: string } },
        organization: ctx.organization,
      },
    });
  });

/**
 * Organization-protected procedure
 *
 * Requires both authentication and organization membership.
 * Use this for operations that should be scoped to an organization.
 *
 * @see https://trpc.io/docs/procedures
 */
export const orgProtectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.data?.userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
    }
    if (!ctx.organization) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Organization membership required" });
    }
    return next({
      ctx: {
        session: ctx.session as typeof ctx.session & { data: { userId: string } },
        organization: ctx.organization,
      },
    });
  });

/**
 * Organization admin procedure
 *
 * Requires authentication, organization membership, and admin role.
 * Use this for administrative operations within an organization.
 *
 * @see https://trpc.io/docs/procedures
 */
export const orgAdminProcedure = orgProtectedProcedure
  .use(({ ctx, next }) => {
    if (!ctx.organization || !['admin', 'org:admin'].includes(ctx.organization.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Organization admin access required" });
    }
    return next({
      ctx: {
        ...ctx,
        organization: ctx.organization,
      },
    });
  });

// Re-export for convenience
export { TRPCError } from "@trpc/server";
