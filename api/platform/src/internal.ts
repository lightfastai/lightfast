/**
 * Internal platform router — in-process callers only.
 *
 * NOT served over HTTP. Accessed exclusively via createInternalCaller().
 * All procedures use internalProcedure (observability middleware, no auth).
 */

import { oauthInternalRouter } from "./router/internal/oauth";
import { webhooksInternalRouter } from "./router/internal/webhooks";
import { createTRPCRouter } from "./trpc";

// -- Internal Router ----------------------------------------------------------

export const internalRouter = createTRPCRouter({
  webhooks: webhooksInternalRouter,
  oauth: oauthInternalRouter,
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
