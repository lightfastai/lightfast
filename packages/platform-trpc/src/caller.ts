/**
 * Server-side memory caller for non-React contexts.
 *
 * Use this from backend packages (api/app, etc.) that don't have JSX enabled.
 * For React Server Components, use `@repo/platform-trpc/server` instead.
 */
import {
  createMemoryTRPCContext,
  memoryRouter,
  signServiceJWT,
} from "@api/platform";
import { cache } from "react";

/**
 * Create a server-side memory caller for service use.
 * Authenticated as the specified caller identity.
 *
 * @param caller - Service identity (e.g., "app", "platform", "inngest")
 */
export const createMemoryCaller = cache(async (caller = "app") => {
  const token = await signServiceJWT(caller);

  const heads = new Headers();
  heads.set("x-trpc-source", `${caller}-service`);
  heads.set("authorization", `Bearer ${token}`);

  const ctx = await createMemoryTRPCContext({ headers: heads });
  return memoryRouter.createCaller(ctx);
});
