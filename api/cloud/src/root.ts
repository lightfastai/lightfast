/**
 * Cloud application root router
 * This is the main router for cloud-specific API endpoints
 */

import { createTRPCRouter } from "./trpc";

/**
 * Primary cloud app router
 * TODO: Add cloud-specific routers (deployments, API keys, etc.)
 */
export const cloudAppRouter = createTRPCRouter({
  // Cloud routers will be added here
  // Example structure:
  // deployment: deploymentRouter,
  // apiKey: apiKeyRouter,
});

// Export type for use in client
export type CloudAppRouter = typeof cloudAppRouter;