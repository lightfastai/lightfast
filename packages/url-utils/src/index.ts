/**
 * URL utilities for Lightfast apps
 * Re-exports from @repo/vercel-config and adds app-specific helpers
 */

export {
  getAppUrl,
  getAllAppUrls,
  getAuthUrls,
  getCurrentAppUrl,
  getClerkSatelliteConfig,
  type AppUrls,
} from "@repo/vercel-config";

export * from "./clerk-helpers";
export * from "./navigation";