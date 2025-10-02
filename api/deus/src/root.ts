/**
 * Deus application root router
 * This is the main router that combines all Deus-specific routers
 */

import { createTRPCRouter } from "./trpc";
import { repositoryRouter } from "./router/repository";

/**
 * Primary Deus app router - flattened structure
 */
export const deusAppRouter = createTRPCRouter({
  repository: repositoryRouter,
});

// Export type for use in client
export type DeusAppRouter = typeof deusAppRouter;
