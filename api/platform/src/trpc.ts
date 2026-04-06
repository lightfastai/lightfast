/**
 * Platform service tRPC initialization.
 *
 * Auth model: service-to-service JWT (not Clerk).
 * All callers are internal services (app, platform, inngest, cron).
 */
import { initTRPC, TRPCError } from "@trpc/server";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { createObservabilityMiddleware } from "@vendor/observability/trpc";
import superjson from "superjson";
import { ZodError } from "zod";

import { verifyServiceJWT } from "./lib/jwt";

// -- Auth Context -------------------------------------------------------------

/**
 * Discriminated union for platform service authentication.
 * Every request resolves to exactly one variant.
 */
export type PlatformAuthContext =
  | { type: "service"; caller: string }
  | { type: "webhook"; provider: string }
  | { type: "internal"; source: string }
  | { type: "inngest" }
  | { type: "cron" }
  | { type: "unauthenticated" };

/** Explicit context type for tRPC initialization.
 *
 * Must be used instead of `typeof createPlatformTRPCContext` because the
 * context factory only returns "service" | "unauthenticated" — but in-process
 * callers (createInternalCaller) provide other auth variants directly.
 *
 * If you add fields to createPlatformTRPCContext's return type, add them here too.
 */
export interface PlatformContext {
  auth: PlatformAuthContext;
  headers: Headers;
}

// -- Context Creation ---------------------------------------------------------

/**
 * Create tRPC context for platform service requests.
 *
 * Auth resolution order:
 * 1. Bearer JWT in Authorization header -> service auth
 * 2. x-trpc-source header for internal identification
 * 3. Unauthenticated fallback
 */
export const createPlatformTRPCContext = async (opts: {
  headers: Headers;
}): Promise<PlatformContext> => {
  const source = opts.headers.get("x-trpc-source") ?? "unknown";

  // Check for service JWT in Authorization header
  const authHeader = opts.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");

    try {
      const verified = await verifyServiceJWT(token);
      log.info("[trpc] platform service request", {
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
        error: parseError(error),
      });
    }
  }

  // No authentication
  log.info("[trpc] platform service request", {
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

const t = initTRPC.context<PlatformContext>().create({
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

const observabilityMiddleware = t.middleware(
  createObservabilityMiddleware({
    isDev: t._config.isDev,
    extractAuth: (ctx) => ({
      ...(ctx.auth.type === "service" && { caller: ctx.auth.caller }),
      ...(ctx.auth.type === "internal" && { source: ctx.auth.source }),
    }),
  })
);

// -- Router & Procedure Exports -----------------------------------------------

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Public procedure -- no auth required.
 * Use for health checks or publicly accessible endpoints.
 */
export const publicProcedure = t.procedure.use(observabilityMiddleware);

/**
 * Service procedure -- requires valid service JWT.
 * Used by app or other internal services calling platform.
 *
 * Guarantees `ctx.auth.type === "service"` and `ctx.auth.caller` is available.
 */
export const serviceProcedure = t.procedure
  .use(observabilityMiddleware)
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
        auth: ctx.auth as Extract<PlatformAuthContext, { type: "service" }>,
      },
    });
  });

/**
 * Admin procedure -- requires service JWT from an admin caller.
 * Used for administrative operations (reindex, purge, etc.).
 *
 * Restricts `ctx.auth.caller` to "admin" only.
 */
export const adminProcedure = t.procedure
  .use(observabilityMiddleware)
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
        auth: ctx.auth as Extract<PlatformAuthContext, { type: "service" }>,
      },
    });
  });

/**
 * Internal procedure -- trusted in-process callers only.
 * Used by Inngest functions and platform route handlers via createInternalCaller().
 *
 * NOT exposed over HTTP. Applies observability middleware without auth checks.
 */
export const internalProcedure = t.procedure.use(observabilityMiddleware);
