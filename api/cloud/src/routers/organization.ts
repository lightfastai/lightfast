/**
 * Organization management router for Lightfast Cloud
 *
 * Currently unused - placeholder for future organization management features.
 * All organization context is handled through Clerk integration in tRPC middleware.
 */

import { createTRPCRouter } from "../trpc";

export const organizationRouter = createTRPCRouter({
  // Empty router - all organization functionality handled by Clerk
  // Add endpoints here when organization-specific features are needed
});