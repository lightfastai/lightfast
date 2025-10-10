/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */

import { db } from "@db/deus/client";
import { DeusApiKey } from "@db/deus/schema";
import { initTRPC, TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
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
      type: "apiKey";
      userId: string;
      organizationId: string;
      scopes: string[];
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
 * Verify API key from Authorization header
 * Returns API key auth context if valid, null otherwise
 */
async function verifyApiKey(
  authHeader: string | null,
): Promise<Extract<AuthContext, { type: "apiKey" }> | null> {
  if (!authHeader?.startsWith("Bearer deus_sk_")) return null;

  const key = authHeader.replace("Bearer ", "");

  try {
    // Hash the provided key
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Find the API key by hash
    const keyResult = await db
      .select({
        id: DeusApiKey.id,
        userId: DeusApiKey.userId,
        organizationId: DeusApiKey.organizationId,
        scopes: DeusApiKey.scopes,
        expiresAt: DeusApiKey.expiresAt,
        revokedAt: DeusApiKey.revokedAt,
      })
      .from(DeusApiKey)
      .where(eq(DeusApiKey.keyHash, keyHash))
      .limit(1);

    const apiKey = keyResult[0];

    // Validate the API key
    if (!apiKey || apiKey.revokedAt) return null;

    const isExpired =
      apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
    if (isExpired) return null;

    // Update lastUsedAt asynchronously (don't block request)
    void db
      .update(DeusApiKey)
      .set({ lastUsedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(DeusApiKey.id, apiKey.id));

    return {
      type: "apiKey",
      userId: apiKey.userId,
      organizationId: apiKey.organizationId,
      scopes: apiKey.scopes,
    };
  } catch (error) {
    console.error("Error verifying API key:", error);
    return null;
  }
}

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const source = opts.headers.get("x-trpc-source") ?? "unknown";

  // Try API key authentication first (takes precedence)
  const apiKeyAuth = await verifyApiKey(opts.headers.get("authorization"));
  if (apiKeyAuth) {
    console.info(
      `>>> tRPC Request from ${source} by API key (user: ${apiKeyAuth.userId}, org: ${apiKeyAuth.organizationId})`,
    );
    return { auth: apiKeyAuth, db };
  }

  // Try Clerk session authentication
  const clerkSession = await auth();
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
 * the session is valid (either Clerk or API key) and guarantees authentication.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (ctx.auth.type === "unauthenticated") {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return next({
      ctx: {
        ...ctx,
        // After check above, auth is either clerk or apiKey
        auth: ctx.auth as Extract<AuthContext, { type: "clerk" | "apiKey" }>,
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
export const clerkProtectedProcedure = t.procedure
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
export const apiKeyProtectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (ctx.auth.type !== "apiKey") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message:
          "API key required. Provide a valid API key in the Authorization header: 'Bearer deus_sk_...'",
      });
    }

    return next({
      ctx: {
        ...ctx,
        // Type-safe apiKey auth (guaranteed to be type "apiKey")
        auth: ctx.auth as Extract<AuthContext, { type: "apiKey" }>,
      },
    });
  });

// Re-export for convenience
export { TRPCError } from "@trpc/server";
