/**
 * Server-side memory caller for non-React contexts.
 *
 * Use this from backend packages (api/console, etc.) that don't have JSX enabled.
 * For React Server Components, use `@repo/memory-trpc/server` instead.
 */
import {
  createMemoryTRPCContext,
  memoryRouter,
  signServiceJWT,
} from "@api/memory";
import { cache } from "react";

/**
 * Create a server-side memory caller for service use.
 * Authenticated as the specified caller identity.
 *
 * @param caller - Service identity (e.g., "console", "platform", "inngest")
 */
export const createMemoryCaller = cache(async (caller = "console") => {
  const token = await signServiceJWT(caller);

  const heads = new Headers();
  heads.set("x-trpc-source", `${caller}-service`);
  heads.set("authorization", `Bearer ${token}`);

  const ctx = await createMemoryTRPCContext({ headers: heads });
  return memoryRouter.createCaller(ctx);
});
