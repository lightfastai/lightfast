/**
 * Console application root router
 * This is the main router that combines all console-specific routers
 */

import { organizationRouter } from "./router/organization";
import { repositoryRouter } from "./router/repository";
import { createTRPCRouter } from "./trpc";

/**
 * Primary console app router
*/
export const consoleAppRouter = createTRPCRouter({
  organization: organizationRouter,
  repository: repositoryRouter,
});

// Export type for use in client
export type ConsoleAppRouter = typeof consoleAppRouter;
