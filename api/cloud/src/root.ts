/**
 * Cloud application root router
 * This is the main router for cloud-specific API endpoints
 */

import { apiKeyRouter } from "./routers/apiKey";
import { createTRPCRouter } from "./trpc";

/**
 * Primary cloud app router
 * Contains all cloud-specific API endpoints
 */
export const cloudAppRouter = createTRPCRouter({
  apiKey: apiKeyRouter,
  // Additional routers will be added here
  // deployment: deploymentRouter,
});

// Export type for use in client
export type CloudAppRouter = typeof cloudAppRouter;
