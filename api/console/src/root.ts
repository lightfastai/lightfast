/**
 * Console application root router
 * This is the main router that combines all console-specific routers
 */

// Phase 1.3: Docs ingestion and search routers
import { searchRouter } from "./router/search";
import { contentsRouter } from "./router/contents";
import { createTRPCRouter } from "./trpc";

// Phase 1.5: Repository management
import { repositoryRouter } from "./router/repository";

// Phase 1.6: Stores, Clerk integration, and Workspaces
import { storesRouter } from "./router/stores";
import { clerkRouter } from "./router/clerk";
import { workspaceRouter } from "./router/workspace";
import { organizationRouter } from "./router/organization";
import { integrationRouter } from "./router/integration";

/**
 * Primary console app router
*/
export const consoleAppRouter = createTRPCRouter({
  // Phase 1.3: Docs search
  search: searchRouter,
  contents: contentsRouter,

  // Phase 1.5: Repository management
  repository: repositoryRouter,

  // Phase 1.6: Stores, Clerk integration, and Workspaces
  stores: storesRouter,
  clerk: clerkRouter,
  workspace: workspaceRouter,
  organization: organizationRouter,
  integration: integrationRouter,
});

// Export type for use in client
export type ConsoleAppRouter = typeof consoleAppRouter;
