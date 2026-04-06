/**
 * Internal platform router — in-process callers only.
 *
 * NOT served over HTTP. Accessed exclusively via createInternalCaller().
 * All procedures use internalProcedure (observability middleware, no auth).
 *
 * Sub-routers will be added as business logic is migrated from:
 * - Inngest function steps (DB calls, provider APIs, token management)
 * - Route handler lib calls (OAuth, webhook ingestion)
 */
import { createTRPCRouter, internalProcedure } from "./trpc";

// -- Internal Router ----------------------------------------------------------

export const internalRouter = createTRPCRouter({
  /**
   * Proof-of-concept procedure.
   * Validates the full chain: caller -> router -> procedure -> middleware -> response.
   * Remove once real sub-routers are added.
   */
  ping: internalProcedure.query(({ ctx }) => ({
    ok: true as const,
    timestamp: new Date().toISOString(),
    source: ctx.auth.type === "internal" ? ctx.auth.source : "unknown",
  })),
});

export type InternalRouter = typeof internalRouter;

// -- Internal Caller ----------------------------------------------------------

/**
 * Create a typed caller for the internal router.
 *
 * No JWT, no headers, no async — just a direct in-process call
 * with full observability middleware on every procedure.
 *
 * Note: This bypasses createPlatformTRPCContext entirely — context is built
 * inline. If you add fields to createPlatformTRPCContext's return type,
 * update PlatformContext and this function accordingly.
 *
 * Usage in Inngest functions:
 *   const platform = createInternalCaller();
 *   await step.run("some-step", () => platform.someRouter.someProc(input));
 *
 * Usage in route handlers:
 *   const platform = createInternalCaller();
 *   const result = await platform.someRouter.someProc(input);
 */
export function createInternalCaller(source = "unknown") {
  return internalRouter.createCaller({
    auth: { type: "internal" as const, source },
    headers: new Headers(),
  });
}
