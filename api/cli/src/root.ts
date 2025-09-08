/**
 * CLI application root router
 * This router contains only CLI-specific API endpoints
 */

import { apiKeyRouter } from "./routers/auth/apiKey";
import { deployRouter } from "./routers/deploy";
import { createCallerFactory, createTRPCRouter } from "./trpc";

/**
 * Primary CLI router
 * Contains only CLI-specific API endpoints
 */
export const cliRouter = createTRPCRouter({
  apiKey: apiKeyRouter,
  deploy: deployRouter,
});

// Create server-side caller
export const createCaller = createCallerFactory(cliRouter);

// Export type for use in client
export type CliRouter = typeof cliRouter;