/**
 * Deus application root router
 * This is the main router that combines all deus-specific routers
 */

import { apiKeyRouter } from "./router/api-key";
import { codeReviewRouter } from "./router/code-review";
import { organizationRouter } from "./router/organization";
import { repositoryRouter } from "./router/repository";
import { sessionRouter } from "./router/session";
import { userRouter } from "./router/user";
import { createTRPCRouter } from "./trpc";

/**
 * Primary deus app router
 */
export const deusAppRouter = createTRPCRouter({
  organization: organizationRouter,
  repository: repositoryRouter,
  codeReview: codeReviewRouter,
  session: sessionRouter,
  apiKey: apiKeyRouter,
  user: userRouter,
});

// Export type for use in client
export type DeusAppRouter = typeof deusAppRouter;
