/**
 * Platform service tRPC initialization.
 *
 * Auth model: service-to-service JWT (not Clerk).
 * All callers are internal services (app, platform, inngest, cron).
 *
 * Auth resolution lives in `./auth` — this file consumes the resolved
 * `PlatformAuthContext` and wires it into tRPC middleware.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import { log } from "@vendor/observability/log/next";
import { createObservabilityMiddleware } from "@vendor/observability/trpc";
import superjson from "superjson";
import { ZodError } from "zod";

import type { PlatformContext } from "./auth/context";
import { UNAUTH } from "./auth/context";
import { resolveAuth } from "./auth/resolve";

export type { PlatformAuthContext, PlatformContext } from "./auth/context";

// -- Context Creation ---------------------------------------------------------

/**
 * Create tRPC context for platform service requests.
 *
 * Auth resolution is delegated to `resolveAuth`; this layer adds the
 * boundary log line and the unauth fallback.
 */
export const createTRPCContext = async (opts: {
  headers: Headers;
}): Promise<PlatformContext> => {
  const source = opts.headers.get("x-trpc-source") ?? "unknown";
  const auth = (await resolveAuth(opts.headers, source)) ?? UNAUTH;

  log.info("[trpc] platform service request", {
    source,
    auth: auth.type,
    ...(auth.type === "service" && { caller: auth.caller }),
  });

  return { auth, headers: opts.headers };
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
    extractAuth: (ctx) => {
      switch (ctx.auth.type) {
        case "service":
          return { caller: ctx.auth.caller };
        case "internal":
          return { source: ctx.auth.source };
        case "unauthenticated":
          return {};
      }
    },
  })
);

/**
 * Service-auth gate — required by `serviceProcedure`.
 *
 * Mirrors the requireAuth / requireOrg pattern in api/app: the runtime
 * type guard plus `{ ...ctx, auth: ctx.auth }` re-binding narrows
 * downstream `ctx.auth` to the service variant without a manual cast.
 */
const requireService = t.middleware(({ ctx, next }) => {
  if (ctx.auth.type !== "service") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message:
        "Service authentication required. Provide a valid service JWT in the Authorization header.",
    });
  }
  return next({ ctx: { ...ctx, auth: ctx.auth } });
});

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
  .use(requireService);

/**
 * Internal procedure -- trusted in-process callers only.
 * Used by Inngest functions and platform route handlers via createInternalCaller().
 *
 * NOT exposed over HTTP. Applies observability middleware without auth checks.
 */
export const internalProcedure = t.procedure.use(observabilityMiddleware);
