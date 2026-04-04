/**
 * Memory service tRPC initialization.
 *
 * Auth model: service-to-service JWT (not Clerk).
 * All callers are internal services (console, platform, inngest, cron).
 */
import { trpcMiddleware } from "@sentry/core";
import { initTRPC, TRPCError } from "@trpc/server";
import { log } from "@vendor/observability/log/next";
import superjson from "superjson";
import { ZodError } from "zod";

import { verifyServiceJWT } from "./lib/jwt";

// -- Auth Context -------------------------------------------------------------

/**
 * Discriminated union for memory service authentication.
 * Every request resolves to exactly one variant.
 */
export type MemoryAuthContext =
  | { type: "service"; caller: string }
  | { type: "webhook"; provider: string }
  | { type: "inngest" }
  | { type: "cron" }
  | { type: "unauthenticated" };

// -- Context Creation ---------------------------------------------------------

/**
 * Create tRPC context for memory service requests.
 *
 * Auth resolution order:
 * 1. Bearer JWT in Authorization header -> service auth
 * 2. X-Memory-Source header for internal identification
 * 3. Unauthenticated fallback
 */
export const createMemoryTRPCContext = async (opts: { headers: Headers }) => {
  const source = opts.headers.get("x-trpc-source") ?? "unknown";

  // Check for service JWT in Authorization header
  const authHeader = opts.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");

    try {
      const verified = await verifyServiceJWT(token);
      log.info("[trpc] memory service request", {
        source,
        auth: "service",
        caller: verified.caller,
      });
      return {
        auth: {
          type: "service" as const,
          caller: verified.caller,
        },
        headers: opts.headers,
      };
    } catch (error) {
      log.warn("[trpc] JWT verification error", {
        source,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // No authentication
  log.info("[trpc] memory service request", {
    source,
    auth: "unauthenticated",
  });
  return {
    auth: { type: "unauthenticated" as const },
    headers: opts.headers,
  };
};

// -- tRPC Initialization ------------------------------------------------------

const isProduction = process.env.NODE_ENV === "production";

const t = initTRPC.context<typeof createMemoryTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => {
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

// -- Middleware ----------------------------------------------------------------

const sentryMiddleware = t.middleware(
  trpcMiddleware({
    attachRpcInput: true,
  })
);

const sentrifiedProcedure = t.procedure.use(sentryMiddleware);

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();
  const end = Date.now();
  log.info("[trpc] procedure timing", { path, durationMs: end - start });

  return result;
});

// -- Router & Procedure Exports -----------------------------------------------

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Public procedure -- no auth required.
 * Use for health checks or publicly accessible endpoints.
 */
export const publicProcedure = sentrifiedProcedure.use(timingMiddleware);

/**
 * Service procedure -- requires valid service JWT.
 * Used by console, platform, or other internal services calling memory.
 *
 * Guarantees `ctx.auth.type === "service"` and `ctx.auth.caller` is available.
 */
export const serviceProcedure = sentrifiedProcedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (ctx.auth.type !== "service") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message:
          "Service authentication required. Provide a valid service JWT in the Authorization header.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        auth: ctx.auth as Extract<MemoryAuthContext, { type: "service" }>,
      },
    });
  });

/**
 * Admin procedure -- requires service JWT from an admin caller.
 * Used for administrative operations (reindex, purge, etc.).
 *
 * Restricts `ctx.auth.caller` to "admin" only.
 */
export const adminProcedure = sentrifiedProcedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (ctx.auth.type !== "service") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Service authentication required.",
      });
    }

    if (ctx.auth.caller !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Admin access required. This endpoint is restricted to admin callers.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        auth: ctx.auth as Extract<MemoryAuthContext, { type: "service" }>,
      },
    });
  });
