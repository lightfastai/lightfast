/**
 * Console application root router
 * This is the main router that combines all console-specific routers
 */

// Phase 1.3: Docs ingestion and search routers
import { searchRouter } from "./router/search";
import { contentsRouter } from "./router/contents";
import { createTRPCRouter } from "./trpc";

// Phase 1.5: Organization and repository management
import { organizationRouter } from "./router/organization";
import { repositoryRouter } from "./router/repository";

// Phase 1.6: Stores and Clerk integration
import { storesRouter } from "./router/stores";
import { clerkRouter } from "./router/clerk";

/**
 * Primary console app router
*/
export const consoleAppRouter = createTRPCRouter({
  // Phase 1.3: Docs search
  search: searchRouter,
  contents: contentsRouter,

  // Phase 1.5: Organization and repository management
  organization: organizationRouter,
  repository: repositoryRouter,

  // Phase 1.6: Stores and Clerk integration
  stores: storesRouter,
  clerk: clerkRouter,
});

// Export type for use in client
export type ConsoleAppRouter = typeof consoleAppRouter;
