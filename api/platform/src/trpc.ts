/**
 * Platform service tRPC initialization.
 *
 * Auth model: service-to-service JWT (not Clerk).
 * All callers are internal services (app, platform, inngest, cron).
 */
import { nanoid } from "@repo/lib";
import { trpcMiddleware } from "@sentry/core";
import { initTRPC, TRPCError } from "@trpc/server";
import { log } from "@vendor/observability/log/next";
import { emitJournal, withRequestContext } from "@vendor/observability/request";
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
  | { type: "inngest" }
  | { type: "cron" }
  | { type: "unauthenticated" };

// -- Context Creation ---------------------------------------------------------

/**
 * Create tRPC context for platform service requests.
 *
 * Auth resolution order:
 * 1. Bearer JWT in Authorization header -> service auth
 * 2. x-trpc-source header for internal identification
 * 3. Unauthenticated fallback
 */
export const createPlatformTRPCContext = async (opts: { headers: Headers }) => {
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
        error: error instanceof Error ? error.message : String(error),
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

const t = initTRPC.context<typeof createPlatformTRPCContext>().create({
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

const observabilityMiddleware = t.middleware(
  async ({ next, path, ctx, type }) => {
    if (t._config.isDev) {
      const waitMs = Math.floor(Math.random() * 400) + 100;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    const { result, journal, durationMs } = await withRequestContext(
      {
        requestId: nanoid(),
        ...(ctx.auth.type === "service" && { caller: ctx.auth.caller }),
      },
      () => next()
    );

    const meta = {
      path,
      type,
      durationMs,
      ok: result.ok,
      ...(!result.ok && { errorCode: result.error?.code }),
      ...(ctx.auth.type === "service" && { caller: ctx.auth.caller }),
    };

    if (result.ok) {
      log.info("[trpc] procedure completed", meta);
    } else {
      log.warn("[trpc] procedure failed", meta);
    }

    emitJournal(journal, { path, durationMs, ok: result.ok });

    return result;
  }
);

// -- Router & Procedure Exports -----------------------------------------------

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Public procedure -- no auth required.
 * Use for health checks or publicly accessible endpoints.
 */
export const publicProcedure = sentrifiedProcedure.use(observabilityMiddleware);

/**
 * Service procedure -- requires valid service JWT.
 * Used by app or other internal services calling platform.
 *
 * Guarantees `ctx.auth.type === "service"` and `ctx.auth.caller` is available.
 */
export const serviceProcedure = sentrifiedProcedure
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
export const adminProcedure = sentrifiedProcedure
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
