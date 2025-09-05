/**
 * Cloud application root router
 * This is the main router for cloud-specific API endpoints
 */

import { apiKeyRouter } from "./routers/apiKey";
import { userRouter } from "./routers/auth/user";
import { organizationRouter } from "./routers/organization";
import { createCallerFactory, createTRPCRouter } from "./trpc";

/**
 * Primary cloud app router
 * Contains all cloud-specific API endpoints
 */
export const cloudAppRouter = createTRPCRouter({
  apiKey: apiKeyRouter,
  user: userRouter,
  organization: organizationRouter,
  // Additional routers will be added here
  // deployment: deploymentRouter,
});

// Create server-side caller
export const createCaller = createCallerFactory(cloudAppRouter);

// Export type for use in client
export type CloudAppRouter = typeof cloudAppRouter;
