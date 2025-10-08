/**
 * Deus application root router
 * This is the main router that combines all deus-specific routers
 */

import { createTRPCRouter } from "./trpc";
import { repositoryRouter } from "./router/repository";
import { codeReviewRouter } from "./router/code-review";

/**
 * Primary deus app router
 */
export const deusAppRouter = createTRPCRouter({
  repository: repositoryRouter,
  codeReview: codeReviewRouter,
});

// Export type for use in client
export type DeusAppRouter = typeof deusAppRouter;
