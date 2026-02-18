/**
 * URL utilities for Lightfast apps
 * Each app should use its own related-projects.ts for cross-app URLs
 */

export type { CorsConfig } from "./cors";
export {
  getCorsConfig,
  applyCorsHeaders,
  handleCorsPreflightRequest,
  withCors,
} from "./cors";